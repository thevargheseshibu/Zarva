import React, { useState, useCallback } from 'react';
import { useTokens } from '../../design-system';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useT } from '../../hooks/useT';
import apiClient from '@infra/api/client';
import FadeInView from '../../components/FadeInView';
import PremiumButton from '../../components/PremiumButton';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import Card from '../../components/Card';



export default function EarningsScreen({ navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const TABS = [t('today'), t('this_week'), t('this_month')];
    const [activeTab, setActiveTab] = useState(t('today'));
    const [overview, setOverview] = useState({ [t('today')]: 0, [t('this_week')]: 0, [t('this_month')]: 0 });
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            apiClient.get('/api/worker/earnings')
                .then(res => {
                    const mappedOverview = {
                        [t('today')]: res.data?.overview?.Today || 0,
                        [t('this_week')]: res.data?.overview?.['This Week'] || 0,
                        [t('this_month')]: res.data?.overview?.['This Month'] || 0
                    };
                    setOverview(mappedOverview);
                    setTransactions(res.data?.transactions || []);
                })
                .catch(err => console.error('Failed to pull earnings', err))
                .finally(() => setLoading(false));
        }, [])
    );

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        Haptics.selectionAsync();
    };

    const renderTx = ({ item, index }) => (
        <FadeInView delay={400 + index * 50}>
            <View style={styles.txRow}>
                <View style={[styles.txIconBox, item.type === 'credit' ? styles.txIconCredit : styles.txIconDebit]}>
                    <Text style={styles.txIconTxt}>{item.type === 'credit' ? '↙' : '↗'}</Text>
                </View>
                <View style={styles.txInfo}>
                    <Text style={styles.txTitle}>{item.title}</Text>
                    <Text style={styles.txTime}>{item.time}</Text>
                </View>
                <View style={styles.txAmtBox}>
                    <Text style={[styles.txAmt, item.type === 'debit' && styles.txAmtDebit]}>
                        {item.type === 'credit' ? '+' : '-'} ₹{item.amt}
                    </Text>
                    {item.type === 'credit' && <View style={styles.settledBadge}><Text style={styles.settledTxt}>{t('settled')}</Text></View>}
                </View>
            </View>
        </FadeInView>
    );

    return (
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <PressableAnimated onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Text style={styles.headerBtnTxt}>←</Text>
                </PressableAnimated>
                <Text style={styles.headerTitle}>{t('financial_portfolio')}</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* Tab Selector */}
                <FadeInView delay={50} style={styles.tabBar}>
                    {TABS.map(tab => {
                        const active = activeTab === tab;
                        return (
                            <TouchableOpacity
                                key={tab}
                                style={[styles.tab, active && styles.tabActive]}
                                onPress={() => handleTabChange(tab)}
                            >
                                <Text style={[styles.tabTxt, active && styles.tabTxtActive]}>{tab}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </FadeInView>

                {/* Main Hero Metric */}
                <FadeInView delay={150}>
                    <Card style={styles.heroCard}>
                        <Text style={styles.heroLabel}>{activeTab.toUpperCase()}{t('revenue_suffix')}</Text>
                        <View style={styles.valueRow}>
                            <Text style={styles.currency}>₹</Text>
                            <Text style={styles.heroValue}>{overview[activeTab] || 0}</Text>
                        </View>
                        <View style={styles.availableBadge}>
                            <Text style={styles.availableTxt}>{t('liquidity')}{overview[activeTab] || 0}</Text>
                        </View>
                    </Card>
                </FadeInView>

                {/* Action Card */}
                <FadeInView delay={250}>
                    <Card style={styles.withdrawCard}>
                        <View style={styles.withdrawInfo}>
                            <Text style={styles.withdrawTitle}>{t('settlement_funds')}</Text>
                            <Text style={styles.withdrawSub}>{t('settlement_desc')}</Text>
                        </View>
                        <PremiumButton
                            variant="ghost"
                            title={t('instant_payout')}
                            disabled={true}
                            style={styles.withdrawBtn}
                            textStyle={{ fontSize: 10 }}
                        />
                    </Card>
                </FadeInView>

                {/* History Section */}
                <View style={styles.section}>
                    <FadeInView delay={350} style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeader}>{t('transaction_history')}</Text>
                        <Text style={styles.historyMeta}>{t('recent_20')}</Text>
                    </FadeInView>

                    {loading ? (
                        <View style={styles.loaderBox}>
                            <ActivityIndicator color={t.brand.primary} />
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
                                <FadeInView delay={500} style={styles.emptyBox}>
                                    <Text style={styles.emptyTxt}>{t('no_historical_tx')}</Text>
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
        paddingTop: 60,
        paddingHorizontal: t.spacing['2xl'],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: t.spacing.lg
    },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.background.surface, justifyContent: 'center', alignItems: 'center' },
    headerBtnTxt: { color: t.text.primary, fontSize: 20 },
    headerTitle: { color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.bold, letterSpacing: t.typography.tracking.body },

    scrollContent: { padding: t.spacing['2xl'], paddingBottom: 120 },

    tabBar: {
        flexDirection: 'row',
        backgroundColor: t.background.surface,
        padding: 4,
        borderRadius: t.radius.xl,
        marginBottom: t.spacing[32],
        borderWidth: 1,
        borderColor: t.border.default + '11'
    },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: t.radius.lg },
    tabActive: { backgroundColor: t.background.surfaceRaised, ...t.shadows.premium },
    tabTxt: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 0.5 },
    tabTxtActive: { color: t.brand.primary },

    heroCard: { padding: t.spacing[32], alignItems: 'center', backgroundColor: t.background.surface, borderWidth: 1, borderColor: t.border.default + '11', marginBottom: t.spacing['2xl'] },
    heroLabel: { color: t.brand.primary, fontSize: 9, fontWeight: t.typography.weight.bold, letterSpacing: 2 },
    valueRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 },
    currency: { color: t.text.primary, fontSize: 24, fontWeight: '900', marginTop: 12, marginRight: 4 },
    heroValue: { color: t.text.primary, fontSize: 64, fontWeight: '900', letterSpacing: -1 },
    availableBadge: { backgroundColor: t.brand.primary + '11', paddingHorizontal: 12, paddingVertical: 4, borderRadius: t.radius.full, marginTop: 16 },
    availableTxt: { color: t.brand.primary, fontSize: 9, fontWeight: t.typography.weight.bold },

    withdrawCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: t.spacing[20],
        backgroundColor: t.background.surfaceRaised,
        borderWidth: 1,
        borderColor: t.background.surface,
        marginBottom: t.spacing[48]
    },
    withdrawInfo: { flex: 1, gap: 4 },
    withdrawTitle: { color: t.text.primary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.bold },
    withdrawSub: { color: t.text.tertiary, fontSize: 10, lineHeight: 12 },
    withdrawBtn: { width: 100, height: 40, borderRadius: t.radius.md },

    section: { gap: t.spacing.lg },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    sectionHeader: { color: t.brand.primary, fontSize: 9, fontWeight: t.typography.weight.bold, letterSpacing: 2 },
    historyMeta: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.medium },

    txList: { gap: t.spacing.lg },
    txRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    txIconBox: { width: 44, height: 44, borderRadius: t.radius.lg, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
    txIconCredit: { backgroundColor: t.brand.primary + '11', borderColor: t.brand.primary + '22' },
    txIconDebit: { backgroundColor: t.background.surfaceRaised, borderColor: t.background.surface },
    txIconTxt: { color: t.text.primary, fontSize: 18, fontWeight: 'bold' },
    txInfo: { flex: 1, gap: 2 },
    txTitle: { color: t.text.primary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.bold },
    txTime: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.medium },
    txAmtBox: { alignItems: 'flex-end', gap: 4 },
    txAmt: { color: t.brand.primary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.bold },
    txAmtDebit: { color: t.text.primary, opacity: 0.6 },
    settledBadge: { backgroundColor: t.brand.primary + '11', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    settledTxt: { color: t.brand.primary, fontSize: 6, fontWeight: '900' },

    divider: { height: 1, backgroundColor: t.background.surfaceRaised, opacity: 0.5 },
    loaderBox: { padding: 40 },
    emptyBox: { padding: 40, alignItems: 'center' },
    emptyTxt: { color: t.text.tertiary, fontSize: t.typography.size.caption, fontStyle: 'italic' }
});
