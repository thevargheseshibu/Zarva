import React, { useState } from 'react';
import { useTokens } from '@shared/design-system';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useT } from '@shared/i18n/useTranslation';
import FadeInView from '@shared/ui/FadeInView';
import PremiumButton from '@shared/ui/PremiumButton';
import PressableAnimated from '@shared/design-system/components/PressableAnimated';
import Card from '@shared/ui/ZCard';



export default function PriceEstimateScreen({ route, navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
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
                <Text style={styles.headerTitle}>{t('pricing_breakdown')}</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <FadeInView delay={50}>
                    <Text style={styles.introTitle}>{t('pricing_breakdown')}</Text>
                    <Text style={styles.introSub}>{t('transparent_estimate')}</Text>
                </FadeInView>

                {/* Estimate Detail Card */}
                <FadeInView delay={200}>
                    <Card style={styles.detailCard}>
                        <Text style={styles.sectionLabel}>{t('service_cost_caps')}</Text>

                        <View style={styles.costRow}>
                            <Text style={styles.costLabel}>{t('base_labour')}</Text>
                            <Text style={styles.costValue}>₹{labour}</Text>
                        </View>

                        {travel > 0 && (
                            <View style={styles.costRow}>
                                <Text style={styles.costLabel}>{t('travel_allowance')}</Text>
                                <Text style={styles.costValue}>₹{travel}</Text>
                            </View>
                        )}

                        {(nightSurcharge > 0 || emergencySurcharge > 0) && (
                            <View style={styles.surchargeBox}>
                                {nightSurcharge > 0 && (
                                    <View style={styles.costRow}>
                                        <Text style={styles.surchargeLabel}>{t('night_surcharge')}</Text>
                                        <Text style={styles.surchargeValue}>₹{nightSurcharge}</Text>
                                    </View>
                                )}
                                {emergencySurcharge > 0 && (
                                    <View style={styles.costRow}>
                                        <Text style={styles.surchargeLabel}>{t('emergency_fee')}</Text>
                                        <Text style={styles.surchargeValue}>₹{emergencySurcharge}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        <View style={styles.divider} />

                        <View style={styles.costRow}>
                            <Text style={styles.subtotalLabel}>{t('subtotal')}</Text>
                            <Text style={styles.subtotalValue}>₹{subtotal}</Text>
                        </View>

                        <View style={styles.costRow}>
                            <Text style={styles.costLabel}>{t('service_access_fee')}</Text>
                            <Text style={styles.costValue}>₹{platformFee}</Text>
                        </View>

                        <View style={styles.totalRow}>
                            <View>
                                <Text style={styles.totalLabel}>{t('total_estimate_caps')}</Text>
                                <Text style={styles.totalHint}>{t('final_cost_depends')}</Text>
                            </View>
                            <Text style={styles.totalValue}>₹{total}</Text>
                        </View>
                    </Card>
                </FadeInView>

                {/* Secure Payment Note */}
                <FadeInView delay={350}>
                    <Card style={styles.paymentCard}>
                        <View style={styles.paymentHeader}>
                            <Text style={styles.paymentTitle}>{t('payment_terms')}</Text>
                        </View>

                        <View style={styles.paymentSplit}>
                            <View style={styles.splitBox}>
                                <Text style={styles.splitLabel}>{t('advance')}</Text>
                                <Text style={styles.splitValue}>₹{advance}</Text>
                                <Text style={styles.splitHint}>{t('payable_now')}</Text>
                            </View>
                            <View style={styles.splitDivider} />
                            <View style={styles.splitBox}>
                                <Text style={styles.splitLabel}>{t('balance')}</Text>
                                <Text style={styles.splitValue}>₹{balance}</Text>
                                <Text style={styles.splitHint}>{t('pay_after_work')}</Text>
                            </View>
                        </View>
                    </Card>
                </FadeInView>

                <View style={styles.footer}>
                    <PremiumButton
                        title={t('proceed_to_loc')}
                        onPress={handleContinue}
                    />
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

    introTitle: { color: t.text.primary, fontSize: t.typography.size.hero, fontWeight: t.typography.weight.bold, letterSpacing: t.typography.tracking.hero },
    introSub: { color: t.text.secondary, fontSize: t.typography.size.body, marginTop: 4, marginBottom: t.spacing[32], letterSpacing: t.typography.tracking.body },

    detailCard: { padding: t.spacing['2xl'], gap: t.spacing.md },
    sectionLabel: { color: t.brand.primary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 2, marginBottom: 8 },

    costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    costLabel: { color: t.text.secondary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.medium },
    costValue: { color: t.text.primary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.semibold },

    surchargeBox: {
        padding: t.spacing.md,
        backgroundColor: t.background.surfaceRaised,
        borderRadius: t.radius.md,
        gap: 8,
        marginVertical: 4
    },
    surchargeLabel: { color: t.brand.primary, fontSize: 11, fontWeight: t.typography.weight.medium },
    surchargeValue: { color: t.text.primary, fontSize: 11, fontWeight: t.typography.weight.bold },

    divider: { height: 1, backgroundColor: t.background.surface, marginVertical: t.spacing.sm },

    subtotalLabel: { color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.bold },
    subtotalValue: { color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.bold },

    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: t.spacing.lg,
        padding: t.spacing.lg,
        backgroundColor: t.brand.primary + '11',
        borderRadius: t.radius.lg,
        borderWidth: 1,
        borderColor: t.brand.primary + '22'
    },
    totalLabel: { color: t.brand.primary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1.5 },
    totalHint: { color: t.text.tertiary, fontSize: 10, marginTop: 2 },
    totalValue: { color: t.text.primary, fontSize: 28, fontWeight: '900' },

    paymentCard: { padding: t.spacing['2xl'], marginTop: t.spacing['2xl'], backgroundColor: t.background.surface },
    paymentHeader: { marginBottom: t.spacing.lg },
    paymentTitle: { color: t.text.primary, fontSize: t.typography.size.cardTitle, fontWeight: t.typography.weight.bold, letterSpacing: t.typography.tracking.cardTitle },

    paymentSplit: { flexDirection: 'row', alignItems: 'center' },
    splitBox: { flex: 1, alignItems: 'center', gap: 4 },
    splitLabel: { color: t.brand.primary, fontSize: 9, fontWeight: t.typography.weight.bold, letterSpacing: 1 },
    splitValue: { color: t.text.primary, fontSize: 20, fontWeight: '800' },
    splitHint: { color: t.text.tertiary, fontSize: 9, fontStyle: 'italic' },
    splitDivider: { width: 1, height: '70%', backgroundColor: t.border.default + '22' },

    footer: { marginTop: t.spacing[40] }
});
