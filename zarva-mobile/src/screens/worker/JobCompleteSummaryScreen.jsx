/**
 * JobCompleteSummaryScreen.jsx
 * Worker sees the full bill breakdown before it's sent to the customer.
 * Shows labor, materials, settlement split.
 */

import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert
} from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../utils/apiClient';

const COLORS = {
    bg: '#0F1117',
    surface: '#1A1D2E',
    card: '#252840',
    accent: '#6C63FF',
    green: '#22C55E',
    blue: '#38BDF8',
    orange: '#F59E0B',
    textPrimary: '#F1F5F9',
    textSecondary: '#94A3B8',
    border: '#2D3154',
    divider: '#1E2235',
};

function formatPaise(paise) {
    const rupees = (paise / 100);
    return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function SummaryRow({ label, value, highlight, sub }) {
    return (
        <View style={[styles.row, sub && styles.rowSub]}>
            <Text style={[styles.rowLabel, sub && styles.rowLabelSub]}>{label}</Text>
            <Text style={[styles.rowValue, highlight && styles.rowValueHighlight]}>{value}</Text>
        </View>
    );
}

export default function JobCompleteSummaryScreen({ navigation, route }) {
    const { jobId } = route.params;
    const { token } = useAuthStore();
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchPreview();
    }, []);

    const fetchPreview = async () => {
        try {
            const res = await apiClient.get(`/api/jobs/${jobId}/bill-preview`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPreview(res.data);
        } catch (err) {
            Alert.alert('Error', 'Could not load bill preview. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const confirmAndSend = () => {
        Alert.alert(
            'Send to Customer?',
            `Grand total is ${formatPaise(preview?.grand_total_paise || 0)}. The customer will verify with their OTP.`,
            [
                { text: 'Review Again', style: 'cancel' },
                { text: 'Confirm & Send', onPress: handleSend, style: 'default' }
            ]
        );
    };

    const handleSend = async () => {
        setSubmitting(true);
        try {
            // Worker marking complete triggers OTP generation server-side
            await apiClient.post(`/api/jobs/${jobId}/worker-complete`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            Alert.alert(
                '✅ Sent to Customer',
                'The bill has been sent. Wait for the customer to verify the OTP.',
                [{ text: 'OK', onPress: () => navigation.replace('ActiveJob', { jobId }) }]
            );
        } catch (err) {
            const msg = err?.response?.data?.message || 'Failed to send bill';
            Alert.alert('Error', msg);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={COLORS.accent} />
                <Text style={styles.loadingText}>Computing bill…</Text>
            </View>
        );
    }

    if (!preview) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>Failed to load bill</Text>
                <TouchableOpacity onPress={fetchPreview}>
                    <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const s = preview.settlement || {};

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Job Summary</Text>
                <Text style={styles.headerSub}>Review before sending to customer</Text>
            </View>

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Labor Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>⏱ Labor</Text>
                    <SummaryRow
                        label={`${preview.billed_minutes} mins × ₹${preview.hourly_rate}/hr`}
                        value={formatPaise(preview.labor_paise)}
                    />
                    {preview.inspection_fee_paise > 0 && (
                        <SummaryRow label="Inspection Fee" value={formatPaise(preview.inspection_fee_paise)} sub />
                    )}
                    {preview.travel_charge_paise > 0 && (
                        <SummaryRow label="Travel Charge" value={formatPaise(preview.travel_charge_paise)} sub />
                    )}
                </View>

                {/* Materials Section */}
                {preview.materials?.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>🧰 Materials</Text>
                        {preview.materials.map((m, i) => (
                            <SummaryRow
                                key={i}
                                label={m.name}
                                value={`₹${parseFloat(m.amount).toLocaleString('en-IN')}`}
                                sub
                            />
                        ))}
                        <SummaryRow label="Materials Total" value={formatPaise(preview.materials_paise)} />
                    </View>
                )}

                <View style={styles.divider} />

                {/* Grand Total */}
                <View style={styles.grandTotalRow}>
                    <Text style={styles.grandTotalLabel}>Grand Total</Text>
                    <Text style={styles.grandTotalValue}>{formatPaise(preview.grand_total_paise)}</Text>
                </View>

                {/* What you earn */}
                <View style={[styles.section, styles.earningsCard]}>
                    <Text style={styles.sectionTitle}>💸 Your Earnings</Text>
                    <SummaryRow
                        label="Labor Share (70%)"
                        value={formatPaise(s.workerTotal !== undefined ? s.workerTotal - preview.materials_paise : 0)}
                        sub
                    />
                    {preview.materials_paise > 0 && (
                        <SummaryRow label="Materials (100%)" value={formatPaise(preview.materials_paise)} sub />
                    )}
                    <SummaryRow
                        label="Total Payout"
                        value={formatPaise(s.workerTotal || 0)}
                        highlight
                    />
                </View>

                <View style={styles.infoBox}>
                    <Text style={styles.infoText}>
                        💡 Platform receives {formatPaise(s.platformShare || 0)} + Gateway {formatPaise(s.gatewayFee || 0)}. Customer sees the full grand total only.
                    </Text>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.editBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.editBtnText}>← Edit Materials</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.sendBtn, submitting && styles.sendBtnDisabled]}
                    onPress={confirmAndSend}
                    disabled={submitting}
                >
                    {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>Send to Customer →</Text>}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: COLORS.textSecondary, marginTop: 12, fontSize: 14 },
    errorText: { color: COLORS.textPrimary, fontSize: 16 },
    retryText: { color: COLORS.accent, marginTop: 10, fontSize: 14 },
    header: { padding: 20, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    headerTitle: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
    headerSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
    scroll: { flex: 1, padding: 16 },
    section: {
        backgroundColor: COLORS.surface, borderRadius: 16, padding: 16,
        marginBottom: 12, borderWidth: 1, borderColor: COLORS.border,
    },
    sectionTitle: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    rowSub: { paddingLeft: 8 },
    rowLabel: { color: COLORS.textPrimary, fontSize: 14 },
    rowLabelSub: { color: COLORS.textSecondary, fontSize: 13 },
    rowValue: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
    rowValueHighlight: { color: COLORS.green, fontSize: 16, fontWeight: '700' },
    divider: { height: 1, backgroundColor: COLORS.divider, marginVertical: 12 },
    grandTotalRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: COLORS.card, borderRadius: 14, padding: 18, marginBottom: 12,
    },
    grandTotalLabel: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700' },
    grandTotalValue: { color: COLORS.accent, fontSize: 22, fontWeight: '800' },
    earningsCard: { borderColor: COLORS.green, borderWidth: 1.5 },
    infoBox: { backgroundColor: COLORS.divider, borderRadius: 10, padding: 12, marginBottom: 20 },
    infoText: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18 },
    footer: {
        padding: 20, paddingBottom: 36, borderTopWidth: 1,
        borderTopColor: COLORS.border, flexDirection: 'row', gap: 12,
    },
    editBtn: {
        flex: 1, borderWidth: 1, borderColor: COLORS.border,
        padding: 14, borderRadius: 12, alignItems: 'center',
    },
    editBtnText: { color: COLORS.textSecondary, fontSize: 14 },
    sendBtn: { flex: 2, backgroundColor: COLORS.accent, padding: 14, borderRadius: 12, alignItems: 'center' },
    sendBtnDisabled: { opacity: 0.6 },
    sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
