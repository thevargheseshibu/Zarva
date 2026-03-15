/**
 * src/screens/worker/WorkerBankAccountsScreen.jsx
 * List saved bank accounts, add new.
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useTokens } from '../../design-system';
import { useT } from '../../hooks/useT';
import { useWorkerWalletStore } from '../@payment/workerWalletStore';
import PressableAnimated from '../../design-system/components/PressableAnimated';

export default function WorkerBankAccountsScreen({ navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const { bankAccounts, loading, fetchBankAccounts } = useWorkerWalletStore();
    const [refreshing, setRefreshing] = React.useState(false);

    useFocusEffect(
        useCallback(() => {
            fetchBankAccounts();
        }, [fetchBankAccounts])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await fetchBankAccounts();
        setRefreshing(false);
    };

    const handleDelete = (acc) => {
        Alert.alert(t('remove_account'), t('remove_account_confirm'), [
            { text: t('cancel'), style: 'cancel' },
            {
                text: t('remove'),
                style: 'destructive',
                onPress: async () => {
                    try {
                        const { removeBankAccount } = await import('../@payment/api');
                        await removeBankAccount(acc.id);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        fetchBankAccounts();
                    } catch (err) {
                        Alert.alert(t('error'), err?.response?.data?.message || err.message);
                    }
                }
            }
        ]);
    };

    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardContent}>
                <Text style={styles.accountName}>{item.account_holder_name}</Text>
                <Text style={styles.accountDetail}>{item.ifsc_code} • {item.bank_name || '—'}</Text>
                <View style={styles.badges}>
                    {item.is_primary && <View style={styles.primaryBadge}><Text style={styles.primaryTxt}>{t('primary')}</Text></View>}
                    {item.is_verified ? (
                        <View style={styles.verifiedBadge}><Text style={styles.verifiedTxt}>✓ {t('verified')}</Text></View>
                    ) : (
                        <View style={styles.pendingBadge}><Text style={styles.pendingTxt}>{t('verification_pending')}</Text></View>
                    )}
                </View>
            </View>
            <TouchableOpacity style={styles.removeBtn} onPress={() => handleDelete(item)}>
                <Text style={styles.removeTxt}>{t('remove')}</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <PressableAnimated onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Text style={styles.headerBtnTxt}>←</Text>
                </PressableAnimated>
                <Text style={styles.headerTitle}>{t('bank_accounts')}</Text>
                <View style={{ width: 44 }} />
            </View>

            <TouchableOpacity
                style={styles.addBtn}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.navigate('AddBankAccount');
                }}
            >
                <Text style={styles.addBtnTxt}>+ {t('add_new_account')}</Text>
            </TouchableOpacity>

            <FlatList
                data={bankAccounts || []}
                keyExtractor={(i) => i.id}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tTheme.brand.primary} />}
                ListEmptyComponent={<Text style={styles.empty}>{t('no_bank_accounts')}</Text>}
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
    addBtn: { marginHorizontal: t.spacing['2xl'], marginBottom: 16, backgroundColor: t.brand.primary + '22', borderWidth: 1, borderColor: t.brand.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
    addBtnTxt: { color: t.brand.primary, fontWeight: '600', fontSize: 16 },
    list: { padding: t.spacing['2xl'], paddingBottom: 120 },
    card: { backgroundColor: t.background.surface, borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardContent: { flex: 1 },
    accountName: { color: t.text.primary, fontSize: 16, fontWeight: '600' },
    accountDetail: { color: t.text.tertiary, fontSize: 12, marginTop: 4 },
    badges: { flexDirection: 'row', gap: 8, marginTop: 8 },
    primaryBadge: { backgroundColor: t.brand.primary + '33', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    primaryTxt: { color: t.brand.primary, fontSize: 10, fontWeight: '600' },
    verifiedBadge: { backgroundColor: (t.status?.success || '#10B981') + '33', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    verifiedTxt: { color: t.status?.success || '#10B981', fontSize: 10, fontWeight: '600' },
    pendingBadge: { backgroundColor: t.text.tertiary + '33', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    pendingTxt: { color: t.text.tertiary, fontSize: 10 },
    removeBtn: { padding: 8 },
    removeTxt: { color: '#EF4444', fontSize: 14 },
    empty: { color: t.text.tertiary, fontSize: 14, fontStyle: 'italic', textAlign: 'center', padding: 40 }
});
