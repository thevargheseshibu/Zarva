import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useT } from '../../hooks/useT';
import FadeInView from '../../components/FadeInView';
import PremiumButton from '../../components/PremiumButton';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import Card from '../../components/Card';
import { colors, radius, spacing, shadows } from '../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../design-system/typography';

export default function PriceEstimateScreen({ route, navigation }) {
    const t = useT();
    const { category, label, answers, structuredAnswers, basePrice, breakdown } = route.params || {
        category: 'unknown', label: 'Service', answers: {}, structuredAnswers: [], basePrice: 300, breakdown: null
    };

    const labour = breakdown?.base_amount || basePrice;
    const travel = breakdown?.travel_charge || 0;
    const nightSurcharge = breakdown?.night_surcharge || 0;
    const emergencySurcharge = breakdown?.emergency_surcharge || 0;
    const subtotal = breakdown?.subtotal || (labour + travel + nightSurcharge + emergencySurcharge);
    const platformFee = breakdown?.platform_fee || 0;
    const advance = breakdown?.advance_amount || platformFee;
    const balance = breakdown?.balance_due || subtotal;
    const total = breakdown?.total_amount || (subtotal + platformFee);

    const handleContinue = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        navigation.navigate('LocationSchedule', { category, label, answers, structuredAnswers, basePrice });
    };

    return (
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <PressableAnimated onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Text style={styles.headerBtnTxt}>←</Text>
                </PressableAnimated>
                <Text style={styles.headerTitle}>Estimate</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <FadeInView delay={50}>
                    <Text style={styles.introTitle}>Pricing breakdown</Text>
                    <Text style={styles.introSub}>Transparent estimate based on your service requirements and local distance.</Text>
                </FadeInView>

                {/* Estimate Detail Card */}
                <FadeInView delay={200}>
                    <Card style={styles.detailCard}>
                        <Text style={styles.sectionLabel}>SERVICE COST</Text>

                        <View style={styles.costRow}>
                            <Text style={styles.costLabel}>Base Labour</Text>
                            <Text style={styles.costValue}>₹{labour}</Text>
                        </View>

                        {travel > 0 && (
                            <View style={styles.costRow}>
                                <Text style={styles.costLabel}>Travel Allowance</Text>
                                <Text style={styles.costValue}>₹{travel}</Text>
                            </View>
                        )}

                        {(nightSurcharge > 0 || emergencySurcharge > 0) && (
                            <View style={styles.surchargeBox}>
                                {nightSurcharge > 0 && (
                                    <View style={styles.costRow}>
                                        <Text style={styles.surchargeLabel}>Night Surcharge</Text>
                                        <Text style={styles.surchargeValue}>₹{nightSurcharge}</Text>
                                    </View>
                                )}
                                {emergencySurcharge > 0 && (
                                    <View style={styles.costRow}>
                                        <Text style={styles.surchargeLabel}>Emergency Fee</Text>
                                        <Text style={styles.surchargeValue}>₹{emergencySurcharge}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        <View style={styles.divider} />

                        <View style={styles.costRow}>
                            <Text style={styles.subtotalLabel}>Subtotal</Text>
                            <Text style={styles.subtotalValue}>₹{subtotal}</Text>
                        </View>

                        <View style={styles.costRow}>
                            <Text style={styles.costLabel}>Service Access Fee</Text>
                            <Text style={styles.costValue}>₹{platformFee}</Text>
                        </View>

                        <View style={styles.totalRow}>
                            <View>
                                <Text style={styles.totalLabel}>TOTAL ESTIMATE</Text>
                                <Text style={styles.totalHint}>Final cost depends on work duration</Text>
                            </View>
                            <Text style={styles.totalValue}>₹{total}</Text>
                        </View>
                    </Card>
                </FadeInView>

                {/* Secure Payment Note */}
                <FadeInView delay={350}>
                    <Card style={styles.paymentCard}>
                        <View style={styles.paymentHeader}>
                            <Text style={styles.paymentTitle}>Payment Terms</Text>
                        </View>

                        <View style={styles.paymentSplit}>
                            <View style={styles.splitBox}>
                                <Text style={styles.splitLabel}>ADVANCE</Text>
                                <Text style={styles.splitValue}>₹{advance}</Text>
                                <Text style={styles.splitHint}>Payable now</Text>
                            </View>
                            <View style={styles.splitDivider} />
                            <View style={styles.splitBox}>
                                <Text style={styles.splitLabel}>BALANCE</Text>
                                <Text style={styles.splitValue}>₹{balance}</Text>
                                <Text style={styles.splitHint}>Pay after work</Text>
                            </View>
                        </View>
                    </Card>
                </FadeInView>

                <View style={styles.footer}>
                    <PremiumButton
                        title="Proceed to Location"
                        onPress={handleContinue}
                    />
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

    introTitle: { color: colors.text.primary, fontSize: fontSize.hero, fontWeight: fontWeight.bold, letterSpacing: tracking.hero },
    introSub: { color: colors.text.secondary, fontSize: fontSize.body, marginTop: 4, marginBottom: spacing[32], letterSpacing: tracking.body },

    detailCard: { padding: spacing[24], gap: spacing[12] },
    sectionLabel: { color: colors.accent.primary, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 2, marginBottom: 8 },

    costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    costLabel: { color: colors.text.secondary, fontSize: fontSize.caption, fontWeight: fontWeight.medium },
    costValue: { color: colors.text.primary, fontSize: fontSize.caption, fontWeight: fontWeight.semibold },

    surchargeBox: {
        padding: spacing[12],
        backgroundColor: colors.elevated,
        borderRadius: radius.md,
        gap: 8,
        marginVertical: 4
    },
    surchargeLabel: { color: colors.accent.primary, fontSize: 11, fontWeight: fontWeight.medium },
    surchargeValue: { color: colors.text.primary, fontSize: 11, fontWeight: fontWeight.bold },

    divider: { height: 1, backgroundColor: colors.surface, marginVertical: spacing[8] },

    subtotalLabel: { color: colors.text.primary, fontSize: fontSize.body, fontWeight: fontWeight.bold },
    subtotalValue: { color: colors.text.primary, fontSize: fontSize.body, fontWeight: fontWeight.bold },

    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: spacing[16],
        padding: spacing[16],
        backgroundColor: colors.accent.primary + '11',
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.accent.primary + '22'
    },
    totalLabel: { color: colors.accent.primary, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1.5 },
    totalHint: { color: colors.text.muted, fontSize: 8, marginTop: 2 },
    totalValue: { color: colors.text.primary, fontSize: 28, fontWeight: '900' },

    paymentCard: { padding: spacing[24], marginTop: spacing[24], backgroundColor: colors.surface },
    paymentHeader: { marginBottom: spacing[16] },
    paymentTitle: { color: colors.text.primary, fontSize: fontSize.cardTitle, fontWeight: fontWeight.bold, letterSpacing: tracking.cardTitle },

    paymentSplit: { flexDirection: 'row', alignItems: 'center' },
    splitBox: { flex: 1, alignItems: 'center', gap: 4 },
    splitLabel: { color: colors.accent.primary, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 1 },
    splitValue: { color: colors.text.primary, fontSize: 20, fontWeight: '800' },
    splitHint: { color: colors.text.muted, fontSize: 9, fontStyle: 'italic' },
    splitDivider: { width: 1, height: '70%', backgroundColor: colors.accent.border + '22' },

    footer: { marginTop: spacing[40] }
});
