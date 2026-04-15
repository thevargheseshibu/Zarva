import React, { useState, useCallback } from 'react';
import { useTokens } from '@shared/design-system';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useT } from '@shared/i18n/useTranslation';
import apiClient from '@infra/api/client';
import FadeInView from '@shared/ui/FadeInView';
import PremiumButton from '@shared/ui/PremiumButton';
import PressableAnimated from '@shared/design-system/components/PressableAnimated';
import Card from '@shared/ui/ZCard';
import { useWorkerWalletStore } from '@payment/workerWalletStore'; 
import { paiseToINR } from '@shared/utils/paiseToINR';

export default function EarningsScreen({ navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    
    const { availablePaise, pendingPaise, transactions, fetchBalance, fetchTransactions } = useWorkerWalletStore();

    const TABS = [t('today', { defaultValue: 'Today' }), t('this_week', { defaultValue: 'This Week' }), t('this_month', { defaultValue: 'This Month' })];
    const [activeTab, setActiveTab] = useState(TABS[0]);
    const [overview, setOverview] = useState({ [TABS[0]]: 0, [TABS[1]]: 0, [TABS[2]]: 0 });
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            apiClient.get('/api/worker/earnings')
                .then(res => {
                    const earnings = res.data?.earnings || {};
                    setOverview({
                        [TABS[0]]: earnings.today || 0,
                        [TABS[1]]: earnings.this_week || 0,
                        [TABS[2]]: earnings.this_month || 0
                    });
                })
                .catch(err => console.error('Failed to pull earnings', err));

            Promise.all([fetchBalance(), fetchTransactions({ limit: 20 })])
                .finally(() => setLoading(false));

        }, [fetchBalance, fetchTransactions])
    );

    const MIN_THRESHOLD_PAISE = 100000; // ₹1,000

    const getWithdrawButtonTitle = () => {
        if (pendingPaise > 0) return 'Processing...';
        if (availablePaise < MIN_THRESHOLD_PAISE) return `Min. ₹1,000.00`;
        return t('instant_payout', { defaultValue: 'Withdraw Now' });
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        Haptics.selectionAsync();
    };

    const renderTx = ({ item, index }) => {
        const isCredit = item.type === 'credit';
        const title = item.event_type === 'job_complete' 
            ? 'Job Earnings' 
            : item.event_type === 'worker_withdrawal' 
                ? 'Bank Payout' 
                : 'Transaction';

        return (
            <FadeInView delay={100 + index * 50}>
                <View style={styles.txRow}>
                    <View style={[styles.txIconBox, isCredit ? styles.txIconCredit : styles.txIconDebit]}>
                        <Text style={styles.txIconTxt}>{isCredit ? '↙' : '↗'}</Text>
                    </View>
                    <View style={styles.txInfo}>
                        <Text style={styles.txTitle}>{title}</Text>
                        <Text style={styles.txTime}>{new Date(item.posted_at).toLocaleDateString()}</Text>
                    </View>
                    <View style={styles.txAmtBox}>
                        <Text style={[styles.txAmt, !isCredit && styles.txAmtDebit]}>
                            {isCredit ? '+' : '-'} {item.amount_inr}
                        </Text>
                        <View style={[styles.settledBadge, !isCredit && { backgroundColor: tTheme.status.warning.base + '22' }]}>
                            <Text style={[styles.settledTxt, !isCredit && { color: tTheme.status.warning.base }]}>
                                {isCredit ? t('settled', { defaultValue: 'Settled' }) : 'Transferred'}
                            </Text>
                        </View>
                    </View>
                </View>
            </FadeInView>
        );
    };

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <PressableAnimated onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Text style={styles.headerBtnTxt}>←</Text>
                </PressableAnimated>
                <Text style={styles.headerTitle}>{t('financial_portfolio', { defaultValue: 'Financial Portfolio' })}</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                <FadeInView delay={50} style={styles.tabBar}>
                    {TABS.map(tab => {
                        const active = activeTab === tab;
                        return (
                            <TouchableOpacity key={tab} style={[styles.tab, active && styles.tabActive]} onPress={() => handleTabChange(tab)}>
                                <Text style={[styles.tabTxt, active && styles.tabTxtActive]}>{tab}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </FadeInView>

                <FadeInView delay={100}>
                    <Card style={styles.heroCard}>
                        <Text style={styles.heroLabel}>{activeTab.toUpperCase()} REVENUE</Text>
                        <View style={styles.valueRow}>
                            <Text style={styles.currency}>₹</Text>
                            <Text style={styles.heroValue}>{overview[activeTab] || 0}</Text>
                        </View>
                        <View style={styles.availableBadge}>
                            <Text style={styles.availableTxt}>Available: {paiseToINR(availablePaise)}</Text>
                        </View>
                    </Card>
                </FadeInView>

                {/* ⭐ DYNAMIC ACTION CARD */}
                <FadeInView delay={150}>
                    <Card style={[styles.withdrawCard, (pendingPaise > 0 || availablePaise < MIN_THRESHOLD_PAISE) && { borderColor: tTheme.background.surfaceRaised, backgroundColor: tTheme.background.app }]}>
                        <View style={styles.withdrawInfo}>
                            <Text style={styles.withdrawTitle}>
                                {pendingPaise > 0 ? 'Payout Processing ⏳' : t('settlement_funds', { defaultValue: 'Settlement Funds' })}
                            </Text>
                            <Text style={styles.withdrawSub}>
                                {pendingPaise > 0 
                                    ? `${paiseToINR(pendingPaise)} is on the way to your bank.` 
                                    : availablePaise < MIN_THRESHOLD_PAISE 
                                        ? `Earn ${paiseToINR(MIN_THRESHOLD_PAISE - availablePaise)} more to unlock withdrawals.`
                                        : t('settlement_desc', { defaultValue: 'Withdraw your available earnings instantly.' })}
                            </Text>
                        </View>
                        <PremiumButton
                            variant={pendingPaise > 0 || availablePaise < MIN_THRESHOLD_PAISE ? "secondary" : "primary"}
                            title={getWithdrawButtonTitle()}
                            disabled={pendingPaise > 0 || availablePaise < MIN_THRESHOLD_PAISE}
                            onPress={() => navigation.navigate('WorkerWithdraw')}
                            style={[styles.withdrawBtn, { width: 125 }]}
                            textStyle={{ fontSize: 10, fontWeight: '900' }}
                        />
                    </Card>
                </FadeInView>

                <View style={styles.section}>
                    <FadeInView delay={200} style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeader}>{t('transaction_history', { defaultValue: 'TRANSACTION HISTORY' })}</Text>
                        <Text style={styles.historyMeta}>Recent 20</Text>
                    </FadeInView>

                    {loading ? (
                        <View style={styles.loaderBox}>
                            <ActivityIndicator color={tTheme.brand.primary} />
                        </View>
                    ) : (
                        <FlatList
                            scrollEnabled={false}
                            data={transactions}
                            keyExtractor={i => String(i.id)}
                            renderItem={renderTx}
                            contentContainerStyle={styles.txList}
                            ItemSeparatorComponent={() => <View style={styles.divider} />}
                            ListEmptyComponent={
                                <FadeInView delay={300} style={styles.emptyBox}>
                                    <Text style={styles.emptyTxt}>{t('no_historical_tx', { defaultValue: 'No historical transactions recorded.' })}</Text>
                                </FadeInView>
                            }
                        />
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.app },
    header: {
        paddingTop: 60, paddingHorizontal: t.spacing['2xl'], flexDirection: 'row',
        alignItems: 'center', justifyContent: 'space-between', paddingBottom: t.spacing.lg
    },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.background.surface, justifyContent: 'center', alignItems: 'center' },
    headerBtnTxt: { color: t.text.primary, fontSize: 20 },
    headerTitle: { color: t.text.primary, fontSize: 16, fontWeight: '700', letterSpacing: 1 },
    scrollContent: { padding: t.spacing['2xl'], paddingBottom: 120 },
    tabBar: { flexDirection: 'row', backgroundColor: t.background.surface, padding: 4, borderRadius: t.radius.xl, marginBottom: 24, borderWidth: 1, borderColor: t.border.default + '11' },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: t.radius.lg },
    tabActive: { backgroundColor: t.background.surfaceRaised, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
    tabTxt: { color: t.text.tertiary, fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
    tabTxtActive: { color: t.brand.primary },
    heroCard: { padding: 32, alignItems: 'center', backgroundColor: t.background.surface, borderWidth: 1, borderColor: t.border.default + '11', marginBottom: 24 },
    heroLabel: { color: t.brand.primary, fontSize: 9, fontWeight: 'bold', letterSpacing: 2 },
    valueRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 },
    currency: { color: t.text.primary, fontSize: 24, fontWeight: '900', marginTop: 12, marginRight: 4 },
    heroValue: { color: t.text.primary, fontSize: 64, fontWeight: '900', letterSpacing: -1 },
    availableBadge: { backgroundColor: t.brand.primary + '11', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 16 },
    availableTxt: { color: t.brand.primary, fontSize: 10, fontWeight: 'bold' },
    withdrawCard: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: t.background.surfaceRaised, borderWidth: 1, borderColor: t.background.surface, marginBottom: 40, borderRadius: 16 },
    withdrawInfo: { flex: 1, gap: 4, paddingRight: 10 },
    withdrawTitle: { color: t.text.primary, fontSize: 14, fontWeight: 'bold' },
    withdrawSub: { color: t.text.tertiary, fontSize: 10, lineHeight: 14 },
    withdrawBtn: { height: 40, borderRadius: 12 },
    section: { gap: 16 },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    sectionHeader: { color: t.brand.primary, fontSize: 9, fontWeight: 'bold', letterSpacing: 2 },
    historyMeta: { color: t.text.tertiary, fontSize: 10, fontWeight: '500' },
    txList: { gap: 16 },
    txRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    txIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
    txIconCredit: { backgroundColor: t.brand.primary + '11', borderColor: t.brand.primary + '22' },
    txIconDebit: { backgroundColor: t.background.surfaceRaised, borderColor: t.background.surface },
    txIconTxt: { color: t.text.primary, fontSize: 18, fontWeight: 'bold' },
    txInfo: { flex: 1, gap: 2 },
    txTitle: { color: t.text.primary, fontSize: 14, fontWeight: 'bold' },
    txTime: { color: t.text.tertiary, fontSize: 10, fontWeight: '500' },
    txAmtBox: { alignItems: 'flex-end', gap: 4 },
    txAmt: { color: t.brand.primary, fontSize: 14, fontWeight: 'bold' },
    txAmtDebit: { color: t.text.primary, opacity: 0.8 },
    settledBadge: { backgroundColor: t.brand.primary + '11', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    settledTxt: { color: t.brand.primary, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
    divider: { height: 1, backgroundColor: t.background.surfaceRaised, opacity: 0.5 },
    loaderBox: { padding: 40 },
    emptyBox: { padding: 40, alignItems: 'center' },
    emptyTxt: { color: t.text.tertiary, fontSize: 14, fontStyle: 'italic' }
});
