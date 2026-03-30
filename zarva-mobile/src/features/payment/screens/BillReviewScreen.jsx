/**
 * BillReviewScreen.jsx
 * Customer reviews the itemized bill, can flag individual material items,
 * then enters the End OTP to complete the job.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, ActivityIndicator, Alert, Image, Animated
} from 'react-native';
import { useTokens } from '@shared/design-system';
import apiClient from '@infra/api/client';

function formatPaise(paise) {
    const r = paise / 100;
    return `₹${r.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function OTPInput({ value, onChange, otpStyles }) {
    const inputs = useRef([]);
    const digits = value.split('');

    const handleChange = (text, index) => {
        const clean = text.replace(/[^0-9]/g, '').slice(-1);
        const arr = [...digits];
        arr[index] = clean;
        onChange(arr.join(''));
        if (clean && index < 3) inputs.current[index + 1]?.focus();
    };

    const handleKeyPress = (e, index) => {
        if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
            inputs.current[index - 1]?.focus();
        }
    };

    return (
        <View style={otpStyles.row}>
            {[0, 1, 2, 3].map(i => (
                <TextInput
                    key={i}
                    ref={r => inputs.current[i] = r}
                    style={[otpStyles.box, digits[i] && otpStyles.boxFilled]}
                    value={digits[i] || ''}
                    onChangeText={t => handleChange(t, i)}
                    onKeyPress={e => handleKeyPress(e, i)}
                    keyboardType="numeric"
                    maxLength={1}
                    selectTextOnFocus
                />
            ))}
        </View>
    );
}

const createOtpStyles = (COLORS) => StyleSheet.create({
    row: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginVertical: 16 },
    box: {
        width: 56, height: 64, borderRadius: 14, borderWidth: 2,
        borderColor: COLORS.border, backgroundColor: COLORS.surface,
        textAlign: 'center', fontSize: 26, fontWeight: '700', color: COLORS.textPrimary,
    },
    boxFilled: { borderColor: COLORS.accent },
});

export default function BillReviewScreen({ navigation, route }) {
    const tTheme = useTokens();
    const COLORS = React.useMemo(() => ({
        bg: tTheme.background.app,
        surface: tTheme.background.surface,
        card: tTheme.background.surfaceRaised,
        accent: tTheme.brand.primary,
        green: tTheme.status?.success?.base || '#22C55E',
        red: tTheme.status?.danger?.base || '#EF4444',
        orange: tTheme.status?.warning?.base || '#F59E0B',
        textPrimary: tTheme.text.primary,
        textSecondary: tTheme.text.secondary,
        border: tTheme.border.default,
    }), [tTheme]);

    const styles = React.useMemo(() => createStyles(COLORS), [COLORS]);
    const otpStyles = React.useMemo(() => createOtpStyles(COLORS), [COLORS]);

    const { jobId } = route.params;
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [flagged, setFlagged] = useState(new Set());
    const [otp, setOtp] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const shakeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => { fetchPreview(); }, []);

    const fetchPreview = async () => {
        try {
            const res = await apiClient.get(`/api/jobs/${jobId}/bill-preview`);
            // FIX: Correctly extract the preview object from the wrapper
            setPreview(res.data?.preview || res.data);
        } catch (err) {
            Alert.alert('Error', 'Could not load bill. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const toggleFlag = (id) => {
        setFlagged(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const shake = () => {
        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
        ]).start();
    };

    const handleSubmit = async () => {
        if (otp.length !== 4) { shake(); return; }
        if (flagged.size > 0) {
            Alert.alert(
                'Flagged Items',
                `You have flagged ${flagged.size} material item(s) for dispute. They'll be held in escrow pending review. Continue?`,
                [
                    { text: 'Review Again', style: 'cancel' },
                    { text: 'Yes, Submit OTP', onPress: doSubmit }
                ]
            );
        } else {
            doSubmit();
        }
    };

    const doSubmit = async () => {
        setSubmitting(true);
        try {
            // FIX: Point to the actual endpoint that processes end OTPs and finalizes the bill
            const res = await apiClient.post(`/api/jobs/${jobId}/verify-end`, {
                otp,
                flagged_material_ids: [...flagged],
            });
            navigation.replace('PaymentConfirm', { jobId, result: res.data });
        } catch (err) {
            const msg = err?.response?.data?.message || 'Verification failed';
            const code = err?.response?.data?.code;
            if (code === 'OTP_MISMATCH' || code === 'INVALID_OTP') {
                shake();
                Alert.alert('Wrong Code', msg);
            } else {
                Alert.alert('Error', msg);
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={COLORS.accent} />
                <Text style={styles.loadingText}>Loading bill…</Text>
            </View>
        );
    }

    if (!preview) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>Bill not available</Text>
            </View>
        );
    }

    const s = preview.settlement || {};

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Review Bill</Text>
                <Text style={styles.headerSub}>Tap flag icon to dispute individual items</Text>
            </View>

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Labor */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>⏱ Labor</Text>
                    <View style={styles.row}>
                        <Text style={styles.rowLabel}>{preview.billed_minutes} mins @ ₹{preview.hourly_rate}/hr</Text>
                        <Text style={styles.rowValue}>{formatPaise(preview.labor_paise)}</Text>
                    </View>
                    {preview.inspection_fee_paise > 0 && (
                        <View style={styles.row}>
                            <Text style={[styles.rowLabel, styles.rowSub]}>Inspection Fee</Text>
                            <Text style={[styles.rowValue, styles.rowSub]}>{formatPaise(preview.inspection_fee_paise)}</Text>
                        </View>
                    )}
                    {preview.travel_charge_paise > 0 && (
                        <View style={styles.row}>
                            <Text style={[styles.rowLabel, styles.rowSub]}>Travel Charge</Text>
                            <Text style={[styles.rowValue, styles.rowSub]}>{formatPaise(preview.travel_charge_paise)}</Text>
                        </View>
                    )}
                </View>

                {/* Materials — flaggable per item */}
                {preview.materials?.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>🧰 Materials</Text>
                        {preview.materials.map((m) => {
                            const isFlagged = flagged.has(m.id);
                            return (
                                <View key={m.id} style={[styles.materialRow, isFlagged && styles.materialRowFlagged]}>
                                    <View style={styles.materialInfo}>
                                        <Text style={[styles.materialName, isFlagged && styles.materialNameFlagged]}>
                                            {m.name}
                                        </Text>
                                        {m.receipt_url && (
                                            <Image source={{ uri: m.receipt_url }} style={styles.receiptThumb} />
                                        )}
                                        {isFlagged && (
                                            <Text style={styles.flaggedBadge}>⚑ In Dispute</Text>
                                        )}
                                    </View>
                                    <View style={styles.materialAmt}>
                                        <Text style={[styles.materialPrice, isFlagged && styles.materialPriceFlagged]}>
                                            ₹{parseFloat(m.amount).toLocaleString('en-IN')}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => toggleFlag(m.id)}
                                            style={[styles.flagBtn, isFlagged && styles.flagBtnActive]}
                                        >
                                            <Text style={[styles.flagBtnText, isFlagged && styles.flagBtnTextActive]}>
                                                {isFlagged ? '⚑' : '⚐'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                        <View style={[styles.row, { marginTop: 8 }]}>
                            <Text style={styles.rowLabel}>Materials Total</Text>
                            <Text style={styles.rowValue}>{formatPaise(preview.materials_paise)}</Text>
                        </View>
                    </View>
                )}

                {flagged.size > 0 && (
                    <View style={styles.disputeNote}>
                        <Text style={styles.disputeNoteText}>
                            ⚑ {flagged.size} item(s) will be held in escrow for review. Payment for undisputed items processes immediately.
                        </Text>
                    </View>
                )}

                {/* Grand Total */}
                <View style={styles.grandTotalCard}>
                    <Text style={styles.grandTotalLabel}>Grand Total</Text>
                    <Text style={styles.grandTotalValue}>{formatPaise(preview.grand_total_paise)}</Text>
                </View>

                {/* OTP section */}
                <View style={styles.otpSection}>
                    <Text style={styles.otpTitle}>Enter Completion Code</Text>
                    <Text style={styles.otpSub}>The worker will share a 4-digit OTP</Text>
                    <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
                        <OTPInput value={otp} onChange={setOtp} otpStyles={otpStyles} />
                    </Animated.View>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.verifyBtn, (submitting || otp.length !== 4) && styles.verifyBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting || otp.length !== 4}
                >
                    {submitting
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.verifyBtnText}>Verify & Complete Job</Text>
                    }
                </TouchableOpacity>
            </View>
        </View>
    );
}

const createStyles = (COLORS) => StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: COLORS.textSecondary, marginTop: 12 },
    errorText: { color: COLORS.textPrimary, fontSize: 16 },
    header: { padding: 20, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    headerTitle: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
    headerSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
    scroll: { flex: 1, padding: 16 },
    section: {
        backgroundColor: COLORS.surface, borderRadius: 16, padding: 16,
        marginBottom: 12, borderWidth: 1, borderColor: COLORS.border,
    },
    sectionTitle: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
    rowSub: { paddingLeft: 8, color: COLORS.textSecondary },
    rowLabel: { color: COLORS.textPrimary, fontSize: 14 },
    rowValue: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
    materialRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
        paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    materialRowFlagged: { opacity: 0.6, backgroundColor: 'rgba(239,68,68,0.05)', borderRadius: 8, paddingHorizontal: 8 },
    materialInfo: { flex: 1, gap: 4 },
    materialName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
    materialNameFlagged: { textDecorationLine: 'line-through', color: COLORS.textSecondary },
    receiptThumb: { width: 40, height: 40, borderRadius: 6, marginTop: 4 },
    flaggedBadge: { color: COLORS.red, fontSize: 11, fontWeight: '700' },
    materialAmt: { alignItems: 'flex-end', gap: 6 },
    materialPrice: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
    materialPriceFlagged: { color: COLORS.red },
    flagBtn: { padding: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
    flagBtnActive: { borderColor: COLORS.red, backgroundColor: 'rgba(239,68,68,0.12)' },
    flagBtnText: { color: COLORS.textSecondary, fontSize: 16 },
    flagBtnTextActive: { color: COLORS.red },
    disputeNote: { backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
    disputeNoteText: { color: COLORS.red, fontSize: 13, lineHeight: 18 },
    grandTotalCard: {
        backgroundColor: COLORS.card, borderRadius: 14, padding: 18,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
    },
    grandTotalLabel: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700' },
    grandTotalValue: { color: COLORS.accent, fontSize: 22, fontWeight: '800' },
    otpSection: {
        backgroundColor: COLORS.surface, borderRadius: 16, padding: 20,
        alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: COLORS.border,
    },
    otpTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700' },
    otpSub: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4 },
    footer: { padding: 20, paddingBottom: 36, borderTopWidth: 1, borderTopColor: COLORS.border },
    verifyBtn: { backgroundColor: COLORS.green, padding: 15, borderRadius: 12, alignItems: 'center' },
    verifyBtnDisabled: { opacity: 0.4 },
    verifyBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
