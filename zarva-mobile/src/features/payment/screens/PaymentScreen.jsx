import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTokens } from '@shared/design-system';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Linking } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useT } from '@shared/i18n/useTranslation';
import apiClient from '@infra/api/client';
import FadeInView from '@shared/ui/FadeInView';
import PremiumButton from '@shared/ui/PremiumButton';
import PressableAnimated from '@shared/design-system/components/PressableAnimated';
import Card from '@shared/ui/ZCard';

export default function PaymentScreen({ route, navigation }) {
    const tTheme = useTokens();
    const styles = useMemo(() => createStyles(tTheme), [tTheme]);
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
            // Temporary stub: directly mark payment as completed on the server
            await apiClient.post('/api/payment/finalize-mock', { job_id: jobId });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Payment Successful', 'Transaction processed successfully.');
            navigation.replace('Rating', { jobId });
        } catch (err) {
            Alert.alert('Payment Failed', 'Transaction could not be initiated. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const confirmingRef = useRef(false);

    const handleCashPaid = async () => {
        if (loading || confirmingRef.current) return;
        Alert.alert(
            'Confirm Cash Payment',
            'I confirm the service provider has collected the full cash amount.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm Cash Payment',
                    style: 'default',
                    onPress: async () => {
                        if (confirmingRef.current) return;
                        confirmingRef.current = true;
                        setLoading(true);
                        try {
                            await apiClient.post('/api/payment/cash-confirm', { job_id: jobId, payment_type: 'final' });
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            navigation.replace('Rating', { jobId });
                        } catch (err) {
                            Alert.alert('Error', 'Failed to confirm cash payment.');
                        } finally {
                            setLoading(false);
                            confirmingRef.current = false;
                        }
                    }
                }
            ]
        );
    };

    const handleDownloadInvoicePdf = async () => {
        if (!invoice) return;
        try {
            const baseURL = apiClient.defaults.baseURL || '';
            const url = `${baseURL}/api/payment/invoice/${jobId}/pdf`;
            const supported = await Linking.canOpenURL(url);
            if (!supported) {
                Alert.alert('Error', 'Cannot open invoice PDF on this device.');
                return;
            }
            await Linking.openURL(url);
        } catch (err) {
            Alert.alert('Error', 'Failed to open invoice PDF.');
        }
    };

    if (fetchingInvoice) {
        return (
            <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={tTheme.brand.primary} />
            </View>
        );
    }

    if (!invoice) {
        return (
            <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: tTheme.text.tertiary }}>Error generating invoice.</Text>
                <PremiumButton title="Retry" onPress={() => navigation.replace('Payment', { jobId })} style={{ marginTop: 20 }} />
                <PremiumButton
                    title="Go Home"
                    variant="ghost"
                    onPress={() => navigation.replace('CustomerTabs')}
                    style={{ marginTop: 12 }}
                />
            </View>
        );
    }

    const { invoice_breakdown: ib } = invoice;

    return (
        <View style={styles.screen}>
            {/* Header — uses replace not goBack since we arrived via replace */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => navigation.replace('CustomerTabs')}
                    activeOpacity={0.7}
                >
                    <Text style={styles.backBtnTxt}>← Home</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('secure_checkout')}</Text>
                <View style={{ width: 60 }} />
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
                    <FadeInView delay={550}>
                        <TouchableOpacity style={styles.pdfBtn} onPress={handleDownloadInvoicePdf}>
                            <Text style={styles.pdfBtnTxt}>
                                {t('download_invoice_pdf', { defaultValue: 'Download Invoice PDF' })}
                            </Text>
                        </TouchableOpacity>
                    </FadeInView>
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
        paddingBottom: t.spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTitle: {
        color: t.brand.primary,
        fontSize: 10,
        fontWeight: t.typography.weight.bold,
        letterSpacing: 3,
        textAlign: 'center',
        flex: 1,
    },
    backBtn: {
        width: 60,
        paddingVertical: 4,
    },
    backBtnTxt: {
        color: t.text.secondary,
        fontSize: 13,
        fontWeight: '600',
    },

    scrollContent: { padding: t.spacing['2xl'], paddingBottom: 120 },

    introBox: { alignItems: 'center', gap: t.spacing.md, marginBottom: t.spacing[32] },
    checkCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: t.brand.primary + '11', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: t.border.default + '44' },
    checkIcon: { fontSize: 24 },
    introTitle: { color: t.text.primary, fontSize: t.typography.size.hero, fontWeight: t.typography.weight.bold, letterSpacing: t.typography.tracking.hero },
    introSub: { color: t.text.secondary, fontSize: t.typography.size.body, textAlign: 'center', marginTop: 4 },

    invoiceCard: { padding: t.spacing['2xl'], gap: t.spacing.lg },
    invoiceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    invoiceLabel: { color: t.brand.primary, fontSize: 9, fontWeight: t.typography.weight.bold, letterSpacing: 1 },
    invoiceNo: { color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.bold },
    hoursBadge: { backgroundColor: t.background.surfaceRaised, paddingHorizontal: 10, paddingVertical: 4, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.background.surface },
    hoursTxt: { color: t.text.primary, fontSize: 10, fontWeight: t.typography.weight.bold },

    divider: { height: 1, backgroundColor: t.background.surface, marginVertical: 4 },

    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { color: t.text.secondary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.medium },
    value: { color: t.text.primary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.semibold },

    advanceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: t.background.surface,
        padding: t.spacing.lg,
        borderRadius: t.radius.lg,
        borderWidth: 1,
        borderColor: t.border.default + '22'
    },
    advanceInfo: { gap: 4 },
    advanceLabel: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1 },
    advanceValue: { color: t.brand.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.bold },
    paidBadge: { backgroundColor: t.brand.primary + '11', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    paidBadgeTxt: { color: t.brand.primary, fontSize: 10, fontWeight: t.typography.weight.bold },

    totalBlock: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: t.spacing.sm,
        padding: t.spacing[20],
        backgroundColor: t.background.surfaceRaised,
        borderRadius: t.radius.xl,
        borderWidth: 1,
        borderColor: t.background.surface
    },
    balanceLabel: { color: t.brand.primary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 2 },
    totalValue: { color: t.text.primary, fontSize: 32, fontWeight: '900', marginTop: 4 },
    secureBadge: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.medium },

    footer: { marginTop: t.spacing[40], gap: t.spacing.lg },
    cashBtn: { paddingVertical: t.spacing.lg, alignItems: 'center' },
    cashBtnTxt: { color: t.text.tertiary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.semibold, textDecorationLine: 'underline' },
    pdfBtn: { paddingVertical: t.spacing.sm, alignItems: 'center' },
    pdfBtnTxt: { color: t.text.secondary, fontSize: 12, textDecorationLine: 'underline' }
});
