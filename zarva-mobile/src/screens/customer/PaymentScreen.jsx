import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
// import RazorpayCheckout from 'react-native-razorpay';
import { colors, spacing, radius } from '../../design-system/tokens';
import GoldButton from '../../components/GoldButton';

export default function PaymentScreen({ route, navigation }) {
    const { jobId } = route.params || { jobId: 'mock-123' };
    const [loading, setLoading] = useState(false);

    // Mock Backend Data
    const invoice = {
        base_labour: 300,
        extra_hours: 1,
        extra_rate: 150,
        travel: 50,
        fee_advance_paid: 50
    };

    const totalLabour = invoice.base_labour + (invoice.extra_hours * invoice.extra_rate);
    const subtotal = totalLabour + invoice.travel;
    const balanceDue = subtotal; // Advance was already paid to platform

    const handleDigitalPayment = async () => {
        setLoading(true);
        // Razorpay mock integration
        try {
            // const options = {
            //    description: 'ZARVA Service Payment',
            //    image: 'https://...',
            //    currency: 'INR',
            //    key: 'rzp_test_...',
            //    amount: balanceDue * 100,
            //    name: 'ZARVA',
            //    theme: { color: '#C9A84C' }
            // };
            // await RazorpayCheckout.open(options);

            // Dev Mock: Auto success after 1.5s
            setTimeout(() => {
                setLoading(false);
                navigation.replace('Rating', { jobId });
            }, 1500);
        } catch (err) {
            setLoading(false);
            Alert.alert('Payment Failed', 'Transaction cancelled or failed.');
        }
    };

    const handleCashPaid = () => {
        // Normally calls POST /api/payments/cash-collect
        navigation.replace('Rating', { jobId });
    };

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <Text style={styles.title}>Job Complete 🎉</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.subtitle}>Final Invoice Breakdown</Text>

                <View style={styles.card}>
                    <View style={styles.row}>
                        <Text style={styles.label}>Base Labour (1 hr)</Text>
                        <Text style={styles.value}>₹{invoice.base_labour}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Extra Time ({invoice.extra_hours} hr)</Text>
                        <Text style={styles.value}>₹{invoice.extra_hours * invoice.extra_rate}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Travel Allowance</Text>
                        <Text style={styles.value}>₹{invoice.travel}</Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.row}>
                        <Text style={styles.totalLabel}>Balance Due</Text>
                        <Text style={styles.totalValue}>₹{balanceDue}</Text>
                    </View>
                    <Text style={styles.paidNote}>(₹{invoice.fee_advance_paid} advance fee already paid)</Text>
                </View>

                <GoldButton
                    title={`Pay ₹${balanceDue} Securely`}
                    loading={loading}
                    onPress={handleDigitalPayment}
                    style={{ marginTop: spacing.xl }}
                />

                <TouchableOpacity style={styles.cashBtn} onPress={handleCashPaid} disabled={loading}>
                    <Text style={styles.cashBtnTxt}>Mark as Paid via Cash / Direct UPI</Text>
                </TouchableOpacity>

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
