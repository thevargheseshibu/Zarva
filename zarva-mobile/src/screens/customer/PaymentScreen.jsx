import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useT } from '../../hooks/useT';
import apiClient from '../../services/api/client';
import FadeInView from '../../components/FadeInView';
import PremiumButton from '../../components/PremiumButton';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import Card from '../../components/Card';
import { colors, radius, spacing, shadows } from '../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../design-system/typography';

export default function PaymentScreen({ route, navigation }) {
    const t = useT();
    const { jobId } = route.params || { jobId: 'mock-123' };
    const [loading, setLoading] = useState(false);
    const [invoice, setInvoice] = useState(null);
    const [fetchingInvoice, setFetchingInvoice] = useState(true);

    useEffect(() => {
        apiClient.get(`/api/payment/invoice/${jobId}`)
            .then(res => {
                setInvoice(res.data?.data);
            })
            .catch(err => {
                Alert.alert('Error', 'Unable to fetch invoice details.');
                console.error(err);
            })
            .finally(() => setFetchingInvoice(false));
    }, [jobId]);

    const handleDigitalPayment = async () => {
        if (loading) return;
        setLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const res = await apiClient.post('/api/payment/create-order', { job_id: jobId, payment_type: 'final' });

            if (res.data?.data?.mock) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Payment Successful', 'Transaction processed successfully.');
                navigation.replace('Rating', { jobId });
                return;
            }

            Alert.alert('Payment Gateway', 'Connecting to secure payment environment...');
            setTimeout(() => {
                navigation.replace('Rating', { jobId });
            }, 1500);

        } catch (err) {
            Alert.alert('Payment Failed', 'Transaction could not be initiated. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleCashPaid = async () => {
        if (loading) return;
        Alert.alert(
            'Confirm Cash Payment',
            'I confirm the service provider has collected the full cash amount.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm Cash Payment',
                    style: 'default',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            await apiClient.post('/api/payment/cash-confirm', { job_id: jobId, payment_type: 'final' });
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            navigation.replace('Rating', { jobId });
                        } catch (err) {
                            Alert.alert('Error', 'Failed to confirm cash payment.');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    if (fetchingInvoice) {
        return (
            <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.accent.primary} />
            </View>
        );
    }

    if (!invoice) {
        return (
            <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: colors.text.muted }}>Error generating invoice.</Text>
                <PremiumButton title="Retry" onPress={() => navigation.replace('Payment', { jobId })} style={{ marginTop: 20 }} />
            </View>
        );
    }

    const { invoice_breakdown: ib } = invoice;

    return (
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{t('secure_checkout')}</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                <FadeInView delay={50} style={styles.introBox}>
                    <View style={styles.checkCircle}>
                        <Text style={styles.checkIcon}>✅</Text>
                    </View>
                    <Text style={styles.introTitle}>{t('job_complete')}</Text>
                    <Text style={styles.introSub}>{t('review_invoice')}</Text>
                </FadeInView>

                {/* Invoice Card */}
                <FadeInView delay={200}>
                    <Card style={styles.invoiceCard}>
                        <View style={styles.invoiceHeader}>
                            <View>
                                <Text style={styles.invoiceLabel}>{t('invoice_no')}</Text>
                                <Text style={styles.invoiceNo}>#{invoice.invoice_number}</Text>
                            </View>
                            <View style={styles.hoursBadge}>
                                <Text style={styles.hoursTxt}>{t('session_hours').replace('%{hours}', invoice.actual_hours)}</Text>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.row}>
                            <Text style={styles.label}>{t('labour_cost')}</Text>
                            <Text style={styles.value}>₹{ib.base_amount}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>{t('travel_allowance')}</Text>
                            <Text style={styles.value}>₹{ib.travel_charge}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>{t('platform_service_fee')}</Text>
                            <Text style={styles.value}>₹{ib.platform_fee}</Text>
                        </View>

                        <View style={styles.advanceRow}>
                            <View style={styles.advanceInfo}>
                                <Text style={styles.advanceLabel}>{t('advance_paid')}</Text>
                                <Text style={styles.advanceValue}>- ₹{ib.advance_amount_paid}</Text>
                            </View>
                            <View style={styles.paidBadge}>
                                <Text style={styles.paidBadgeTxt}>{t('paid_caps')}</Text>
                            </View>
                        </View>

                        <View style={styles.totalBlock}>
                            <View>
                                <Text style={styles.balanceLabel}>{t('balance_due')}</Text>
                                <Text style={styles.totalValue}>₹{ib.balance_due}</Text>
                            </View>
                            <Text style={styles.secureBadge}>{t('secure_transmission')}</Text>
                        </View>
                    </Card>
                </FadeInView>

                {/* Action Buttons */}
                <View style={styles.footer}>
                    {ib.balance_due > 0 ? (
                        <>
                            <FadeInView delay={350}>
                                <PremiumButton
                                    title={t('pay_now').replace('%{amount}', ib.balance_due)}
                                    loading={loading}
                                    onPress={handleDigitalPayment}
                                />
                            </FadeInView>

                            <FadeInView delay={450}>
                                <TouchableOpacity
                                    style={styles.cashBtn}
                                    onPress={handleCashPaid}
                                    disabled={loading}
                                >
                                    <Text style={styles.cashBtnTxt}>
                                        {loading ? t('processing') : t('paid_via_cash')}
                                    </Text>
                                </TouchableOpacity>
                            </FadeInView>
                        </>
                    ) : (
                        <FadeInView delay={350}>
                            <PremiumButton
                                title={t('leave_feedback')}
                                onPress={() => navigation.replace('Rating', { jobId })}
                            />
                        </FadeInView>
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
        alignItems: 'center',
        paddingBottom: spacing[16]
    },
    headerTitle: { color: colors.accent.primary, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 3 },

    scrollContent: { padding: spacing[24], paddingBottom: 120 },

    introBox: { alignItems: 'center', gap: spacing[12], marginBottom: spacing[32] },
    checkCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent.primary + '11', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.accent.border + '44' },
    checkIcon: { fontSize: 24 },
    introTitle: { color: colors.text.primary, fontSize: fontSize.hero, fontWeight: fontWeight.bold, letterSpacing: tracking.hero },
    introSub: { color: colors.text.secondary, fontSize: fontSize.body, textAlign: 'center', marginTop: 4 },

    invoiceCard: { padding: spacing[24], gap: spacing[16] },
    invoiceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    invoiceLabel: { color: colors.accent.primary, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 1 },
    invoiceNo: { color: colors.text.primary, fontSize: fontSize.body, fontWeight: fontWeight.bold },
    hoursBadge: { backgroundColor: colors.elevated, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.md, borderWidth: 1, borderColor: colors.surface },
    hoursTxt: { color: colors.text.primary, fontSize: 10, fontWeight: fontWeight.bold },

    divider: { height: 1, backgroundColor: colors.surface, marginVertical: 4 },

    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { color: colors.text.secondary, fontSize: fontSize.caption, fontWeight: fontWeight.medium },
    value: { color: colors.text.primary, fontSize: fontSize.caption, fontWeight: fontWeight.semibold },

    advanceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: spacing[16],
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.accent.border + '22'
    },
    advanceInfo: { gap: 4 },
    advanceLabel: { color: colors.text.muted, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1 },
    advanceValue: { color: colors.accent.primary, fontSize: fontSize.body, fontWeight: fontWeight.bold },
    paidBadge: { backgroundColor: colors.accent.primary + '11', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    paidBadgeTxt: { color: colors.accent.primary, fontSize: 10, fontWeight: fontWeight.bold },

    totalBlock: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: spacing[8],
        padding: spacing[20],
        backgroundColor: colors.elevated,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.surface
    },
    balanceLabel: { color: colors.accent.primary, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 2 },
    totalValue: { color: colors.text.primary, fontSize: 32, fontWeight: '900', marginTop: 4 },
    secureBadge: { color: colors.text.muted, fontSize: 10, fontWeight: fontWeight.medium },

    footer: { marginTop: spacing[40], gap: spacing[16] },
    cashBtn: { paddingVertical: spacing[16], alignItems: 'center' },
    cashBtnTxt: { color: colors.text.muted, fontSize: fontSize.caption, fontWeight: fontWeight.semibold, textDecorationLine: 'underline' }
});
