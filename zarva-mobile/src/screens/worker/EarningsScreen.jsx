import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { colors, spacing, radius } from '../../design-system/tokens';
import Card from '../../components/Card';
import GoldButton from '../../components/GoldButton';

const TABS = ['Today', 'This Week', 'This Month'];

export default function EarningsScreen({ navigation }) {
    const [activeTab, setActiveTab] = React.useState('Today');

    const overview = { Today: 1450, 'This Week': 8400, 'This Month': 32400 };

    const transactions = [
        { id: '1', title: 'Plumbing Repair', amt: '+₹800', type: 'credit', time: '10:30 AM' },
        { id: '2', title: 'Platform Fee Advance', amt: '-₹50', type: 'debit', time: '10:30 AM' },
        { id: '3', title: 'Pipe Fixing', amt: '+₹700', type: 'credit', time: '1:15 PM' },
    ];

    const renderTx = ({ item }) => (
        <View style={styles.txRow}>
            <View style={styles.txIconBox}>
                <Text style={styles.txIcon}>{item.type === 'credit' ? '↓' : '↑'}</Text>
            </View>
            <View style={styles.txDetails}>
                <Text style={styles.txTitle}>{item.title}</Text>
                <Text style={styles.txTime}>{item.time}</Text>
            </View>
            <Text style={[styles.txAmt, item.type === 'debit' && styles.txAmtDebit]}>
                {item.amt}
            </Text>
        </View>
    );

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backTxt}>←</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Earnings</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Timeframe Tabs */}
            <View style={styles.tabWrap}>
                {TABS.map(tab => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.tabActive]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabTxt, activeTab === tab && styles.tabTxtActive]}>{tab}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Big Numbers */}
            <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>{activeTab.toUpperCase()} EARNINGS</Text>
                <Text style={styles.metricValue}>₹{overview[activeTab]}</Text>
                <Text style={styles.pendingTxt}>Pending Payout: ₹0</Text>
            </View>

            <View style={styles.withdrawWrap}>
                <GoldButton title="Withdraw to Bank" onPress={() => { }} disabled={true} />
            </View>

            {/* Transactions List */}
            <View style={styles.txContainer}>
                <Text style={styles.txHeader}>Transactions</Text>
                <FlatList
                    data={transactions}
                    keyExtractor={i => i.id}
                    renderItem={renderTx}
                    contentContainerStyle={styles.txList}
                    ItemSeparatorComponent={() => <View style={styles.divider} />}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: spacing.xl + 20, paddingHorizontal: spacing.sm, paddingBottom: spacing.lg,
    },
    backBtn: { padding: spacing.sm },
    backTxt: { color: colors.text.primary, fontSize: 24 },
    title: { color: colors.text.primary, fontSize: 20, fontWeight: '700' },

    tabWrap: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.md, marginBottom: spacing.xl },
    tab: { borderBottomWidth: 2, borderBottomColor: 'transparent', paddingVertical: spacing.sm },
    tabActive: { borderBottomColor: colors.gold.primary },
    tabTxt: { color: colors.text.muted, fontSize: 15, fontWeight: '600' },
    tabTxtActive: { color: colors.gold.primary },

    metricBox: { alignItems: 'center', marginVertical: spacing.lg },
    metricLabel: { color: colors.text.secondary, fontSize: 13, letterSpacing: 1, fontWeight: '600' },
    metricValue: { color: colors.gold.primary, fontSize: 56, fontWeight: '800', fontFamily: 'Courier', marginVertical: spacing.sm },
    pendingTxt: { color: colors.text.muted, fontSize: 13 },

    withdrawWrap: { paddingHorizontal: spacing.xl, marginTop: spacing.md, marginBottom: spacing.xl },

    txContainer: { flex: 1, backgroundColor: colors.bg.elevated, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg },
    txHeader: { color: colors.text.primary, fontSize: 18, fontWeight: '700', marginBottom: spacing.lg },
    txList: { paddingBottom: spacing.xl },

    txRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    txIconBox: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bg.surface,
        justifyContent: 'center', alignItems: 'center'
    },
    txIcon: { color: colors.text.secondary, fontSize: 18, fontWeight: '800' },
    txDetails: { flex: 1 },
    txTitle: { color: colors.text.primary, fontSize: 15, fontWeight: '600' },
    txTime: { color: colors.text.muted, fontSize: 12, marginTop: 2 },
    txAmt: { color: colors.success, fontSize: 16, fontWeight: '700' },
    txAmtDebit: { color: colors.error },

    divider: { height: 1, backgroundColor: colors.bg.surface, marginVertical: spacing.md }
});
