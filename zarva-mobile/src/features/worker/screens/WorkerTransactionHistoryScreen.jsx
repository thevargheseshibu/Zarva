/**
 * src/screens/worker/WorkerTransactionHistoryScreen.jsx
 * Paginated earnings and withdrawals history.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useTokens } from '../../design-system';
import { useT } from '../../hooks/useT';
import { useWorkerWalletStore } from '@payment/workerWalletStore';
import { paiseToINR } from '../../utils/paiseToINR';
import PressableAnimated from '../../design-system/components/PressableAnimated';

const FILTERS = ['all', 'earnings', 'withdrawals'];

export default function WorkerTransactionHistoryScreen({ navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const { transactions, loading, fetchTransactions } = useWorkerWalletStore();
    const [filter, setFilter] = useState('all');
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);

    const load = useCallback(async (p = 1, append = false) => {
        const f = filter === 'earnings' ? 'earnings' : filter === 'withdrawals' ? 'withdrawals' : undefined;
        await fetchTransactions({ page: p, limit: 20, filter: f });
    }, [filter, fetchTransactions]);

    useFocusEffect(
        useCallback(() => {
            setPage(1);
            load(1);
        }, [load])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await load(1);
        setRefreshing(false);
    };

    const onFilterChange = (f) => {
        Haptics.selectionAsync();
        setFilter(f);
        setPage(1);
        load(1);
    };

    const renderItem = ({ item }) => (
        <View style={styles.txRow}>
            <View style={[styles.txIcon, item.entry_type === 'credit' ? styles.txIconCredit : styles.txIconDebit]}>
                <Text style={styles.txIconTxt}>{item.entry_type === 'credit' ? '+' : '−'}</Text>
            </View>
            <View style={styles.txInfo}>
                <Text style={styles.txDesc}>{item.event_type || t('transaction')}</Text>
                <Text style={styles.txTime}>{item.posted_at ? new Date(item.posted_at).toLocaleString() : ''}</Text>
                {item.job_id && <Text style={styles.txJob}>#{item.job_id}</Text>}
            </View>
            <Text style={[styles.txAmt, item.entry_type === 'credit' && styles.txAmtCredit]}>
                {item.entry_type === 'credit' ? '+' : '−'}{item.amount_inr || paiseToINR(item.amount_paise)}
            </Text>
        </View>
    );

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <PressableAnimated onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Text style={styles.headerBtnTxt}>←</Text>
                </PressableAnimated>
                <Text style={styles.headerTitle}>{t('transaction_history')}</Text>
                <View style={{ width: 44 }} />
            </View>

            <View style={styles.filterRow}>
                {FILTERS.map((f) => (
                    <TouchableOpacity
                        key={f}
                        style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
                        onPress={() => onFilterChange(f)}
                    >
                        <Text style={[styles.filterTxt, filter === f && styles.filterTxtActive]}>{t(f)}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={transactions || []}
                keyExtractor={(i) => String(i.id)}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tTheme.brand.primary} />}
                ListEmptyComponent={loading ? <ActivityIndicator color={tTheme.brand.primary} style={styles.loader} /> : <Text style={styles.empty}>{t('no_transactions_yet')}</Text>}
            />
        </View>
    );
}

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.app },
    header: { paddingTop: 60, paddingHorizontal: t.spacing['2xl'], paddingBottom: t.spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.background.surface, justifyContent: 'center', alignItems: 'center' },
    headerBtnTxt: { color: t.text.primary, fontSize: 20 },
    headerTitle: { color: t.text.primary, fontSize: 18, fontWeight: '700' },
    filterRow: { flexDirection: 'row', paddingHorizontal: t.spacing['2xl'], gap: 8, marginBottom: 16 },
    filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    filterBtnActive: { backgroundColor: t.brand.primary + '33' },
    filterTxt: { color: t.text.tertiary, fontSize: 13 },
    filterTxtActive: { color: t.brand.primary, fontWeight: '600' },
    list: { padding: t.spacing['2xl'], paddingBottom: 120 },
    txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: (t.border?.default || t.border || '#333') + '22' },
    txIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    txIconCredit: { backgroundColor: t.brand.primary + '22' },
    txIconDebit: { backgroundColor: t.background.surfaceRaised },
    txIconTxt: { color: t.text.primary, fontSize: 18, fontWeight: 'bold' },
    txInfo: { flex: 1 },
    txDesc: { color: t.text.primary, fontSize: 14 },
    txTime: { color: t.text.tertiary, fontSize: 11 },
    txJob: { color: t.text.tertiary, fontSize: 10, marginTop: 2 },
    txAmt: { color: t.text.primary, fontWeight: '600' },
    txAmtCredit: { color: t.status?.success?.base || '#10B981' },
    loader: { padding: 40 },
    empty: { color: t.text.tertiary, fontSize: 14, fontStyle: 'italic', padding: 20 }
});
