import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { colors, spacing, radius } from '../../design-system/tokens';
import GoldButton from '../../components/GoldButton';

export default function PriceEstimateScreen({ route, navigation }) {
    // Read passed params or use mock data for testing
    const { category, label, answers, structuredAnswers, basePrice } = route.params || {
        category: 'plumber', label: 'Plumber', answers: {}, structuredAnswers: [], basePrice: 300
    };

    const [loading, setLoading] = useState(false);

    // Hardcoded logic for MVP pricing rendering
    const labour = basePrice;
    const travel = 50;
    const subtotal = labour + travel;
    const platformFee = Math.round(subtotal * 0.1); // 10% config
    const total = subtotal + platformFee;
    const advance = platformFee; // Advance is usually the platform fee
    const balance = subtotal; // Balance to be paid directly to worker in cash or UPI

    const handleFindWorker = () => {
        navigation.navigate('LocationSchedule', { category, label, answers, structuredAnswers, basePrice });
    };

    return (
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backTxt}>←</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Price Estimate</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.serviceName}>{label} Service</Text>
                <Text style={styles.subtitle}>Final price based on actual hours worked</Text>

                <View style={styles.card}>
                    <View style={styles.row}>
                        <Text style={styles.label}>Labour (1 hr base)</Text>
                        <Text style={styles.value}>₹{labour}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Travel Allowance</Text>
                        <Text style={styles.value}>₹{travel}</Text>
                    </View>
                    <View style={styles.divider} />

                    <View style={styles.row}>
                        <Text style={styles.labelBold}>Subtotal</Text>
                        <Text style={styles.valueBold}>₹{subtotal}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Platform Fee (10%)</Text>
                        <Text style={styles.value}>₹{platformFee}</Text>
                    </View>
                    <View style={styles.divider} />

                    <View style={styles.row}>
                        <Text style={styles.totalLabel}>Total Estimate</Text>
                        <Text style={styles.totalValue}>₹{total}</Text>
                    </View>
                </View>

                <View style={styles.advanceCard}>
                    <Text style={styles.advanceTitle}>Payment Breakdown</Text>
                    <View style={styles.row}>
                        <Text style={styles.label}>Advance Now (Fee)</Text>
                        <Text style={styles.advanceValue}>₹{advance}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Balance After Work</Text>
                        <Text style={styles.value}>₹{balance}</Text>
                    </View>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <GoldButton
                    title="Next →"
                    loading={loading}
                    onPress={handleFindWorker}
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
        borderBottomWidth: 1, borderBottomColor: colors.bg.surface
    },
    backBtn: { padding: spacing.sm },
    backTxt: { color: colors.text.primary, fontSize: 24 },
    title: { color: colors.text.primary, fontSize: 20, fontWeight: '700' },

    content: { padding: spacing.lg, gap: spacing.md },
    serviceName: { color: colors.text.primary, fontSize: 24, fontWeight: '800' },
    subtitle: { color: colors.gold.muted, fontSize: 13, marginBottom: spacing.sm },

    card: {
        backgroundColor: colors.bg.elevated, borderRadius: radius.lg,
        padding: spacing.xl, gap: spacing.md, borderWidth: 1, borderColor: colors.bg.surface
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { color: colors.text.secondary, fontSize: 15 },
    value: { color: colors.text.primary, fontSize: 15, fontWeight: '600' },
    labelBold: { color: colors.text.primary, fontSize: 16, fontWeight: '700' },
    valueBold: { color: colors.text.primary, fontSize: 16, fontWeight: '700' },

    divider: { height: 1, backgroundColor: colors.bg.surface, my: spacing.xs },

    totalLabel: { color: colors.text.primary, fontSize: 18, fontWeight: '800' },
    totalValue: { color: colors.gold.primary, fontSize: 22, fontWeight: '800' },

    advanceCard: {
        backgroundColor: colors.gold.primary + '11', borderRadius: radius.lg,
        padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: colors.gold.primary + '44'
    },
    advanceTitle: { color: colors.gold.primary, fontSize: 15, fontWeight: '700', marginBottom: spacing.xs },
    advanceValue: { color: colors.gold.primary, fontSize: 16, fontWeight: '700' },

    footer: { padding: spacing.lg, paddingBottom: spacing.xl * 2, borderTopWidth: 1, borderTopColor: colors.bg.surface }
});
