import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useT } from '../../hooks/useT';
import apiClient from '../../services/api/client';
import FadeInView from '../../components/FadeInView';
import PremiumButton from '../../components/PremiumButton';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import Card from '../../components/Card';
import { colors, radius, spacing, shadows } from '../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../design-system/typography';

const TABS = ['Today', 'This Week', 'This Month'];

export default function EarningsScreen({ navigation }) {
    const t = useT();
    const [activeTab, setActiveTab] = useState('Today');
    const [overview, setOverview] = useState({ Today: 0, 'This Week': 0, 'This Month': 0 });
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            apiClient.get('/api/worker/earnings')
                .then(res => {
                    setOverview(res.data?.overview || { Today: 0, 'This Week': 0, 'This Month': 0 });
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
                    {item.type === 'credit' && <View style={styles.settledBadge}><Text style={styles.settledTxt}>SETTLED</Text></View>}
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
                <Text style={styles.headerTitle}>Financial Portfolio</Text>
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
                        <Text style={styles.heroLabel}>{activeTab.toUpperCase()} REVENUE</Text>
                        <View style={styles.valueRow}>
                            <Text style={styles.currency}>₹</Text>
                            <Text style={styles.heroValue}>{overview[activeTab] || 0}</Text>
                        </View>
                        <View style={styles.availableBadge}>
                            <Text style={styles.availableTxt}>Liquidity: ₹{overview[activeTab] || 0}</Text>
                        </View>
                    </Card>
                </FadeInView>

                {/* Action Card */}
                <FadeInView delay={250}>
                    <Card style={styles.withdrawCard}>
                        <View style={styles.withdrawInfo}>
                            <Text style={styles.withdrawTitle}>Settlement Funds</Text>
                            <Text style={styles.withdrawSub}>Transactions are automatically settled to your registered bank account weekly.</Text>
                        </View>
                        <PremiumButton
                            variant="ghost"
                            title="Instant Payout"
                            disabled={true}
                            style={styles.withdrawBtn}
                            textStyle={{ fontSize: 10 }}
                        />
                    </Card>
                </FadeInView>

                {/* History Section */}
                <View style={styles.section}>
                    <FadeInView delay={350} style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeader}>TRANSACTION HISTORY</Text>
                        <Text style={styles.historyMeta}>Recent 20</Text>
                    </FadeInView>

                    {loading ? (
                        <View style={styles.loaderBox}>
                            <ActivityIndicator color={colors.accent.primary} />
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
                                    <Text style={styles.emptyTxt}>No historical transactions recorded.</Text>
                                </FadeInView>
                            }
                        />
                    )}
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
        paddingTop: 60,
        paddingHorizontal: spacing[24],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: spacing[16]
    },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
    headerBtnTxt: { color: colors.text.primary, fontSize: 20 },
    headerTitle: { color: colors.text.primary, fontSize: fontSize.body, fontWeight: fontWeight.bold, letterSpacing: tracking.body },

    scrollContent: { padding: spacing[24], paddingBottom: 120 },

    tabBar: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        padding: 4,
        borderRadius: radius.xl,
        marginBottom: spacing[32],
        borderWidth: 1,
        borderColor: colors.accent.border + '11'
    },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.lg },
    tabActive: { backgroundColor: colors.elevated, ...shadows.premium },
    tabTxt: { color: colors.text.muted, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 0.5 },
    tabTxtActive: { color: colors.accent.primary },

    heroCard: { padding: spacing[32], alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accent.border + '11', marginBottom: spacing[24] },
    heroLabel: { color: colors.accent.primary, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 2 },
    valueRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 },
    currency: { color: colors.text.primary, fontSize: 24, fontWeight: '900', marginTop: 12, marginRight: 4 },
    heroValue: { color: colors.text.primary, fontSize: 64, fontWeight: '900', letterSpacing: -1 },
    availableBadge: { backgroundColor: colors.accent.primary + '11', paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.full, marginTop: 16 },
    availableTxt: { color: colors.accent.primary, fontSize: 9, fontWeight: fontWeight.bold },

    withdrawCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing[20],
        backgroundColor: colors.elevated,
        borderWidth: 1,
        borderColor: colors.surface,
        marginBottom: spacing[48]
    },
    withdrawInfo: { flex: 1, gap: 4 },
    withdrawTitle: { color: colors.text.primary, fontSize: fontSize.caption, fontWeight: fontWeight.bold },
    withdrawSub: { color: colors.text.muted, fontSize: 8, lineHeight: 12 },
    withdrawBtn: { width: 100, height: 40, borderRadius: radius.md },

    section: { gap: spacing[16] },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    sectionHeader: { color: colors.accent.primary, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 2 },
    historyMeta: { color: colors.text.muted, fontSize: 8, fontWeight: fontWeight.medium },

    txList: { gap: spacing[16] },
    txRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    txIconBox: { width: 44, height: 44, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
    txIconCredit: { backgroundColor: colors.accent.primary + '11', borderColor: colors.accent.primary + '22' },
    txIconDebit: { backgroundColor: colors.elevated, borderColor: colors.surface },
    txIconTxt: { color: colors.text.primary, fontSize: 18, fontWeight: 'bold' },
    txInfo: { flex: 1, gap: 2 },
    txTitle: { color: colors.text.primary, fontSize: fontSize.caption, fontWeight: fontWeight.bold },
    txTime: { color: colors.text.muted, fontSize: 8, fontWeight: fontWeight.medium },
    txAmtBox: { alignItems: 'flex-end', gap: 4 },
    txAmt: { color: colors.accent.primary, fontSize: fontSize.caption, fontWeight: fontWeight.bold },
    txAmtDebit: { color: colors.text.primary, opacity: 0.6 },
    settledBadge: { backgroundColor: colors.accent.primary + '11', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    settledTxt: { color: colors.accent.primary, fontSize: 6, fontWeight: '900' },

    divider: { height: 1, backgroundColor: colors.elevated, opacity: 0.5 },
    loaderBox: { padding: 40 },
    emptyBox: { padding: 40, alignItems: 'center' },
    emptyTxt: { color: colors.text.muted, fontSize: fontSize.caption, fontStyle: 'italic' }
});
