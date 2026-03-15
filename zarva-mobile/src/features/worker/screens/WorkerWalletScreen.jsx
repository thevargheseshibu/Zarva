/**
 * src/screens/worker/WorkerWalletScreen.jsx
 * Worker wallet: available balance, pending, lifetime earnings, withdraw, recent transactions.
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useTokens } from '@shared/design-system';
import { useT } from '@shared/i18n/useTranslation';
import { useWorkerWalletStore } from '@payment/workerWalletStore';
import { paiseToINR } from '../../utils/paiseToINR';
import Card from '@shared/ui/ZCard';
import PremiumButton from '@shared/ui/PremiumButton';
import PressableAnimated from '@shared/design-system/components/PressableAnimated';
import FadeInView from '@shared/ui/FadeInView';

export default function WorkerWalletScreen({ navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const { availablePaise, pendingPaise, totalPaise, transactions, loading, fetchBalance, fetchTransactions } = useWorkerWalletStore();
    const [refreshing, setRefreshing] = React.useState(false);

    const load = useCallback(async () => {
        await Promise.all([fetchBalance(), fetchTransactions({ limit: 5 })]);
    }, [fetchBalance, fetchTransactions]);

    useFocusEffect(
        useCallback(() => {
            load();
            return () => {};
        }, [load])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await load();
        setRefreshing(false);
    };

    const recent = (transactions || []).slice(0, 5);

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <PressableAnimated onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Text style={styles.headerBtnTxt}>←</Text>
                </PressableAnimated>
                <Text style={styles.headerTitle}>{t('wallet')}</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tTheme.brand.primary} />}
            >
                <FadeInView delay={50}>
                    <Card style={styles.balanceCard}>
                        <Text style={styles.label}>{t('available_balance')}</Text>
                        <Text style={styles.amount}>{paiseToINR(availablePaise)}</Text>
                        <View style={styles.row}>
                            <View style={styles.badge}>
                                <Text style={styles.badgeTxt}>{t('pending')}: {paiseToINR(pendingPaise)}</Text>
                            </View>
                            <View style={styles.badge}>
                                <Text style={styles.badgeTxt}>{t('lifetime_earnings')}: {paiseToINR(totalPaise)}</Text>
                            </View>
                        </View>
                    </Card>
                </FadeInView>

                <FadeInView delay={100}>
                    <PremiumButton
                        title={t('withdraw')}
                        onPress={() => navigation.navigate('WorkerWithdraw')}
                        disabled={availablePaise <= 0}
                        style={styles.withdrawBtn}
                    />
                    <TouchableOpacity style={styles.bankLink} onPress={() => navigation.navigate('WorkerBankAccounts')}>
                        <Text style={styles.bankLinkTxt}>{t('manage_bank_accounts', { defaultValue: 'Manage Bank Accounts' })}</Text>
                        <Text style={styles.bankLinkChevron}>›</Text>
                    </TouchableOpacity>
                </FadeInView>

                <FadeInView delay={150} style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>{t('recent_transactions')}</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('WorkerTransactionHistory')}>
                            <Text style={styles.viewAll}>{t('view_all')}</Text>
                        </TouchableOpacity>
                    </View>

                    {loading && recent.length === 0 ? (
                        <View style={styles.loaderBox}><ActivityIndicator color={tTheme.brand.primary} /></View>
                    ) : recent.length === 0 ? (
                        <Text style={styles.empty}>{t('no_transactions_yet')}</Text>
                    ) : (
                        recent.map((tx, i) => (
                            <View key={tx.id || i} style={styles.txRow}>
                                <View style={[styles.txIcon, tx.entry_type === 'credit' ? styles.txIconCredit : styles.txIconDebit]}>
                                    <Text style={styles.txIconTxt}>{tx.entry_type === 'credit' ? '+' : '−'}</Text>
                                </View>
                                <View style={styles.txInfo}>
                                    <Text style={styles.txDesc}>{tx.event_type || t('transaction')}</Text>
                                    <Text style={styles.txTime}>{tx.posted_at ? new Date(tx.posted_at).toLocaleDateString() : ''}</Text>
                                </View>
                                <Text style={[styles.txAmt, tx.entry_type === 'credit' && styles.txAmtCredit]}>
                                    {tx.entry_type === 'credit' ? '+' : '−'}{tx.amount_inr || paiseToINR(tx.amount_paise)}
                                </Text>
                            </View>
                        ))
                    )}
                </FadeInView>
            </ScrollView>
        </View>
    );
}

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.app },
    header: {
        paddingTop: 60, paddingHorizontal: t.spacing['2xl'], paddingBottom: t.spacing.lg,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
    },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.background.surface, justifyContent: 'center', alignItems: 'center' },
    headerBtnTxt: { color: t.text.primary, fontSize: 20 },
    headerTitle: { color: t.text.primary, fontSize: 18, fontWeight: '700' },
    scrollContent: { padding: t.spacing['2xl'], paddingBottom: 120 },
    balanceCard: { padding: t.spacing['2xl'], marginBottom: t.spacing.xl, alignItems: 'center' },
    label: { color: t.brand.primary, fontSize: 12, fontWeight: '600', letterSpacing: 1 },
    amount: { color: t.text.primary, fontSize: 36, fontWeight: '900', marginTop: 8 },
    row: { flexDirection: 'row', gap: 12, marginTop: 16 },
    badge: { backgroundColor: t.brand.primary + '22', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    badgeTxt: { color: t.text.secondary, fontSize: 11 },
    withdrawBtn: { marginBottom: 12 },
    bankLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginBottom: t.spacing['2xl'] },
    bankLinkTxt: { color: t.brand.primary, fontSize: 14 },
    bankLinkChevron: { color: t.brand.primary, fontSize: 18, marginLeft: 4 },
    section: { marginTop: t.spacing.lg },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { color: t.brand.primary, fontSize: 12, fontWeight: '600' },
    viewAll: { color: t.brand.primary, fontSize: 12 },
    txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: (t.border?.default || t.border || '#333') + '22' },
    txIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    txIconCredit: { backgroundColor: t.brand.primary + '22' },
    txIconDebit: { backgroundColor: t.background.surfaceRaised },
    txIconTxt: { color: t.text.primary, fontSize: 18, fontWeight: 'bold' },
    txInfo: { flex: 1 },
    txDesc: { color: t.text.primary, fontSize: 14 },
    txTime: { color: t.text.tertiary, fontSize: 11 },
    txAmt: { color: t.text.primary, fontWeight: '600' },
    txAmtCredit: { color: t.status?.success?.base || '#10B981' },
    loaderBox: { padding: 40, alignItems: 'center' },
    empty: { color: t.text.tertiary, fontSize: 14, fontStyle: 'italic', padding: 20 }
});
