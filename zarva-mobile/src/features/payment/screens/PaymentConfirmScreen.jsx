/**
 * PaymentConfirmScreen.jsx
 * Final receipt shown to customer after OTP is verified and job is complete.
 * Shows full settlement breakdown, flagged items status.
 */

import React, { useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Share
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

const COLORS = {
    bg: '#0F1117',
    surface: '#1A1D2E',
    card: '#252840',
    accent: '#6C63FF',
    green: '#22C55E',
    orange: '#F59E0B',
    red: '#EF4444',
    textPrimary: '#F1F5F9',
    textSecondary: '#94A3B8',
    border: '#2D3154',
};

function formatPaise(paise) {
    if (!paise && paise !== 0) return '₹0.00';
    const r = paise / 100;
    return `₹${r.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ReceiptRow({ label, value, highlight, note }) {
    return (
        <View style={styles.receiptRow}>
            <View style={{ flex: 1 }}>
                <Text style={[styles.receiptLabel, highlight && styles.receiptLabelHL]}>{label}</Text>
                {note && <Text style={styles.receiptNote}>{note}</Text>}
            </View>
            <Text style={[styles.receiptValue, highlight && styles.receiptValueHL]}>{value}</Text>
        </View>
    );
}

export default function PaymentConfirmScreen({ route }) {
    const navigation = useNavigation();
    const { jobId, result } = route.params || {};
    const s = result?.settlement || {};
    const scaleAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.spring(scaleAnim, {
            toValue: 1, friction: 5, tension: 80, useNativeDriver: true,
        }).start();
    }, []);

    const shareReceipt = async () => {
        const lines = [
            `ZARVA Job Receipt`,
            `Job ID: ${jobId}`,
            `Invoice: ${result?.invoice_number || '-'}`,
            `-----------------------------`,
            `Labor:     ${formatPaise(s.laborPaise)}`,
            `Materials: ${formatPaise(s.materialPaise)}`,
            `-----------------------------`,
            `Grand Total: ${formatPaise(s.grandTotalPaise)}`,
        ];
        if (result?.flagged_paise > 0) {
            lines.push(`Held (dispute): ${formatPaise(result.flagged_paise)}`);
        }
        try {
            await Share.share({ message: lines.join('\n') });
        } catch { }
    };

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Success checkmark */}
                <Animated.View style={[styles.checkCircle, { transform: [{ scale: scaleAnim }] }]}>
                    <Text style={styles.checkmark}>✓</Text>
                </Animated.View>

                <Text style={styles.successTitle}>Job Completed!</Text>
                <Text style={styles.successSub}>Payment processed successfully</Text>

                {/* Receipt card */}
                <View style={styles.receiptCard}>
                    <View style={styles.receiptHeader}>
                        <Text style={styles.receiptTitle}>Receipt</Text>
                        {result?.invoice_number && (
                            <Text style={styles.invoiceNum}>{result.invoice_number}</Text>
                        )}
                    </View>

                    <View style={styles.divider} />

                    <ReceiptRow
                        label="Labor"
                        value={formatPaise(s.laborPaise)}
                    />
                    {s.materialPaise > 0 && (
                        <ReceiptRow
                            label="Materials"
                            value={formatPaise(s.materialPaise)}
                        />
                    )}

                    <View style={styles.divider} />

                    <ReceiptRow
                        label="Grand Total"
                        value={formatPaise(s.grandTotalPaise)}
                        highlight
                    />

                    {result?.flagged_paise > 0 && (
                        <ReceiptRow
                            label="Held in Escrow"
                            value={formatPaise(result.flagged_paise)}
                            note={`${result.flagged_material_count} item(s) flagged — pending admin review`}
                        />
                    )}
                </View>

                {/* Breakdown card */}
                <View style={styles.breakdownCard}>
                    <Text style={styles.breakdownTitle}>Settlement Breakdown</Text>

                    <View style={styles.breakdownItem}>
                        <View style={[styles.breakdownDot, { backgroundColor: COLORS.green }]} />
                        <Text style={styles.breakdownLabel}>Worker Payout</Text>
                        <Text style={styles.breakdownValue}>{formatPaise(s.workerTotal)}</Text>
                    </View>
                    <View style={styles.breakdownItem}>
                        <View style={[styles.breakdownDot, { backgroundColor: COLORS.accent }]} />
                        <Text style={styles.breakdownLabel}>Platform Commission</Text>
                        <Text style={styles.breakdownValue}>{formatPaise(s.platformShare)}</Text>
                    </View>
                    <View style={styles.breakdownItem}>
                        <View style={[styles.breakdownDot, { backgroundColor: COLORS.orange }]} />
                        <Text style={styles.breakdownLabel}>Gateway Fee</Text>
                        <Text style={styles.breakdownValue}>{formatPaise(s.gatewayFee)}</Text>
                    </View>
                    <View style={styles.breakdownItem}>
                        <View style={[styles.breakdownDot, { backgroundColor: COLORS.textSecondary }]} />
                        <Text style={styles.breakdownLabel}>GST</Text>
                        <Text style={styles.breakdownValue}>{formatPaise(s.gst)}</Text>
                    </View>
                </View>

                {result?.flagged_paise > 0 && (
                    <View style={styles.disputeCard}>
                        <Text style={styles.disputeIcon}>⚑</Text>
                        <Text style={styles.disputeTitle}>Dispute Pending</Text>
                        <Text style={styles.disputeText}>
                            {result.flagged_material_count} material item(s) are under review.
                            {'\n'}You'll be notified of the outcome within 48 hours.
                        </Text>
                    </View>
                )}
            </ScrollView>

            {/* CTA */}
            <View style={styles.footer}>
                <TouchableOpacity style={styles.shareBtn} onPress={shareReceipt}>
                    <Text style={styles.shareBtnText}>↗ Share Receipt</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.doneBtn}
                    onPress={() => navigation.reset({ index: 0, routes: [{ name: 'CustomerHome' }] })}
                >
                    <Text style={styles.doneBtnText}>Done</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    scroll: { flexGrow: 1, padding: 24, paddingTop: 60, alignItems: 'center' },
    checkCircle: {
        width: 88, height: 88, borderRadius: 44,
        backgroundColor: 'rgba(34,197,94,0.15)',
        borderWidth: 2.5, borderColor: COLORS.green,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
    },
    checkmark: { fontSize: 40, color: COLORS.green },
    successTitle: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 6 },
    successSub: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 28 },
    receiptCard: {
        width: '100%', backgroundColor: COLORS.surface,
        borderRadius: 20, padding: 20, marginBottom: 14,
        borderWidth: 1, borderColor: COLORS.border,
    },
    receiptHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    receiptTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700' },
    invoiceNum: { color: COLORS.textSecondary, fontSize: 12, alignSelf: 'flex-end' },
    divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },
    receiptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 6 },
    receiptLabel: { color: COLORS.textPrimary, fontSize: 14 },
    receiptLabelHL: { fontSize: 17, fontWeight: '700' },
    receiptNote: { color: COLORS.orange, fontSize: 11, marginTop: 2 },
    receiptValue: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
    receiptValueHL: { color: COLORS.green, fontSize: 20, fontWeight: '800' },
    breakdownCard: {
        width: '100%', backgroundColor: COLORS.surface,
        borderRadius: 16, padding: 18, marginBottom: 14,
        borderWidth: 1, borderColor: COLORS.border,
    },
    breakdownTitle: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },
    breakdownItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
    breakdownDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
    breakdownLabel: { flex: 1, color: COLORS.textSecondary, fontSize: 13 },
    breakdownValue: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
    disputeCard: {
        width: '100%', backgroundColor: 'rgba(239,68,68,0.08)',
        borderRadius: 16, padding: 18, alignItems: 'center',
        borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', marginBottom: 14,
    },
    disputeIcon: { fontSize: 28, marginBottom: 6 },
    disputeTitle: { color: COLORS.red, fontSize: 15, fontWeight: '700', marginBottom: 6 },
    disputeText: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 18 },
    footer: {
        padding: 20, paddingBottom: 36, flexDirection: 'row', gap: 12,
        borderTopWidth: 1, borderTopColor: COLORS.border,
    },
    shareBtn: {
        flex: 1, borderWidth: 1, borderColor: COLORS.border,
        padding: 14, borderRadius: 12, alignItems: 'center',
    },
    shareBtnText: { color: COLORS.textSecondary, fontSize: 14 },
    doneBtn: { flex: 2, backgroundColor: COLORS.accent, padding: 14, borderRadius: 12, alignItems: 'center' },
    doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
