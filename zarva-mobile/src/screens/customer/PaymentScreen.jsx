import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
// import RazorpayCheckout from 'react-native-razorpay';
import { colors, spacing, radius } from '../../design-system/tokens';
import GoldButton from '../../components/GoldButton';
import apiClient from '../../services/api/client';

export default function PaymentScreen({ route, navigation }) {
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
        if (loading) return; // Prevent double taps
        setLoading(true);
        try {
            const res = await apiClient.post('/api/payment/create-order', { job_id: jobId, payment_type: 'final' });

            // The backend is designed to return mock=true when payment is disabled via system config
            if (res.data?.data?.mock) {
                Alert.alert('Payment Successful', 'Mock payment was processed by the server.');
                navigation.replace('Rating', { jobId });
                return;
            }

            // Real Razorpay flow would go here
            // const options = { ... res.data.data };
            // await RazorpayCheckout.open(options);
            Alert.alert('Notice', 'Real payment gateway is currently disabled.');
            navigation.replace('Rating', { jobId });

        } catch (err) {
            Alert.alert('Payment Failed', err.response?.data?.message || 'Transaction could not be initiated.');
        } finally {
            setLoading(false);
        }
    };

    const handleCashPaid = async () => {
        if (loading) return;
        Alert.alert(
            'Confirm Cash Payment',
            'Are you sure the worker has collected the full cash amount?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    style: 'default',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            await apiClient.post('/api/payment/cash-confirm', { job_id: jobId, payment_type: 'final' });
                            Alert.alert('Cash Paid', 'The worker has been notified to collect cash.');
                            navigation.replace('Rating', { jobId });
                        } catch (err) {
                            Alert.alert('Error', err.response?.data?.message || 'Failed to confirm cash payment.');
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
                <ActivityIndicator size="large" color={colors.gold.primary} />
            </View>
        );
    }

    if (!invoice) {
        return (
            <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: colors.text.muted }}>Invoice generated not found.</Text>
            </View>
        );
    }

    const { invoice_breakdown: ib } = invoice;

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <Text style={styles.title}>Job Complete 🎉</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.subtitle}>Final Invoice Breakdown</Text>

                <Text style={{ color: colors.text.secondary }}>Invoice #{invoice.invoice_number}</Text>

                <View style={styles.card}>
                    <View style={styles.row}>
                        <Text style={styles.label}>Base Labour ({invoice.actual_hours} hr)</Text>
                        <Text style={styles.value}>₹{ib.base_amount}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Platform Fee</Text>
                        <Text style={styles.value}>₹{ib.platform_fee}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Travel Allowance</Text>
                        <Text style={styles.value}>₹{ib.travel_charge}</Text>
                    </View>

                    {ib.tax > 0 && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Tax</Text>
                            <Text style={styles.value}>₹{ib.tax}</Text>
                        </View>
                    )}

                    <View style={styles.divider} />

                    <View style={styles.row}>
                        <Text style={styles.totalLabel}>Balance Due</Text>
                        <Text style={styles.totalValue}>₹{ib.balance_due}</Text>
                    </View>
                    <Text style={styles.paidNote}>(₹{ib.advance_amount_paid} advance fee already paid)</Text>
                </View>

                {ib.balance_due > 0 ? (
                    <>
                        <GoldButton
                            title={`Pay ₹${ib.balance_due} Securely`}
                            loading={loading}
                            disabled={loading}
                            onPress={handleDigitalPayment}
                            style={{ marginTop: spacing.xl }}
                        />

                        <TouchableOpacity style={styles.cashBtn} onPress={handleCashPaid} disabled={loading}>
                            <Text style={styles.cashBtnTxt}>{loading ? 'Processing...' : 'Mark as Paid via Cash / Direct UPI'}</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <GoldButton
                        title="Continue to Rating"
                        disabled={loading}
                        onPress={() => navigation.replace('Rating', { jobId })}
                        style={{ marginTop: spacing.xl }}
                    />
                )}

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary },
    header: {
        alignItems: 'center', paddingTop: spacing.xl + 40, paddingBottom: spacing.lg,
        borderBottomWidth: 1, borderBottomColor: colors.bg.surface
    },
    title: { color: colors.gold.primary, fontSize: 28, fontWeight: '800' },

    content: { padding: spacing.lg, gap: spacing.md },
    subtitle: { color: colors.text.primary, fontSize: 18, fontWeight: '700', marginBottom: spacing.md },

    card: {
        backgroundColor: colors.bg.elevated, borderRadius: radius.lg,
        padding: spacing.xl, gap: spacing.md, borderWidth: 1, borderColor: colors.bg.surface
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { color: colors.text.secondary, fontSize: 15 },
    value: { color: colors.text.primary, fontSize: 15, fontWeight: '600' },

    divider: { height: 1, backgroundColor: colors.bg.surface, my: spacing.sm },

    totalLabel: { color: colors.text.primary, fontSize: 20, fontWeight: '800' },
    totalValue: { color: colors.error, fontSize: 24, fontWeight: '800' },
    paidNote: { color: colors.text.muted, fontSize: 13, textAlign: 'right', marginTop: -4 },

    cashBtn: { padding: spacing.lg, alignItems: 'center', marginTop: spacing.sm },
    cashBtnTxt: { color: colors.text.secondary, fontSize: 15, fontWeight: '600' }
});
