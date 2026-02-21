/**
 * src/screens/auth/PhoneScreen.jsx
 * Phone entry: +91 chip, 10-digit mono input, GoldButton, terms text.
 */
import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, spacing, radius } from '../../design-system/tokens';
import GoldButton from '../../components/GoldButton';
import apiClient from '../../services/api/client';
import { useAuthStore } from '../../stores/authStore';
import { useT } from '../../hooks/useT';

export default function PhoneScreen({ navigation }) {
    const t = useT();
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(null);

    const formatted = phone.replace(/(\d{3})(\d{1,3})?(\d{1,4})?/, function (_, p1, p2, p3) {
        let res = p1;
        if (p2) res += '-' + p2;
        if (p3) res += '-' + p3;
        return res;
    });
    const isReady = phone.length === 10;

    const login = useAuthStore(s => s.login);

    const handleSend = async (method) => {
        if (!isReady) return;
        setLoading(method);
        // Determine endpoint based on method
        const endpoint = method === 'whatsapp' ? '/api/whatsapp/send-otp' : '/api/auth/otp/send';

        try {
            const res = await apiClient.post(endpoint, {
                phone: `+91${phone}`,
            });

            if (res.data?.bypassed) {
                // If OTP is bypassed (dev mode), verify immediately using the corresponding verify endpoint
                const verifyEndpoint = method === 'whatsapp' ? '/api/whatsapp/verify-otp' : '/api/auth/otp/verify';
                const verifyRes = await apiClient.post(verifyEndpoint, {
                    phone: `+91${phone}`,
                    otp: '000000'
                });
                const { token, user } = verifyRes.data;
                login(user, token);
                return;
            }
        } catch (_) {
            // In dev/mock mode without backend, continue anyway
        } finally {
            setLoading(null);
            // Navigate to OTP screen with authMethod parameter
            const st = useAuthStore.getState();
            if (!st.isAuthenticated) {
                navigation.navigate('OTP', { phone: `+91${phone}`, authMethod: method });
            }
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.screen}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            {/* Back */}
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
                <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>

            <View style={styles.content}>
                <Text style={styles.title}>{t('phone_entry_title')}</Text>
                <Text style={styles.sub}>{t('phone_entry_sub')}</Text>

                {/* Input row */}
                <View style={styles.inputRow}>
                    <View style={styles.countryChip}>
                        <Text style={styles.countryFlag}>🇮🇳</Text>
                        <Text style={styles.countryCode}>+91</Text>
                    </View>
                    <TextInput
                        style={styles.input}
                        value={formatted}
                        onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                        keyboardType="phone-pad"
                        placeholder="XXX-XXX-XXXX"
                        placeholderTextColor={colors.text.muted}
                        maxLength={12} // 10 digits + 2 dashes
                        autoFocus
                    />
                </View>

                <GoldButton
                    title={t('get_otp_whatsapp')}
                    disabled={!isReady || !!loading}
                    loading={loading === 'whatsapp'}
                    onPress={() => handleSend('whatsapp')}
                    style={{ marginTop: spacing.xl }}
                />

                <TouchableOpacity
                    style={[styles.smsBtn, (!isReady || !!loading) && styles.smsBtnDisabled]}
                    disabled={!isReady || !!loading}
                    onPress={() => handleSend('sms')}
                >
                    <Text style={[styles.smsBtnText, (!isReady || !!loading) && styles.smsBtnTextDisabled]}>
                        {loading === 'sms' ? t('sending') : t('get_otp_sms')}
                    </Text>
                </TouchableOpacity>

                <Text style={styles.terms}>
                    {t('terms_text_1')}{' '}
                    <Text style={styles.termsLink}>{t('terms_text_2')}</Text> {t('terms_text_3')}{' '}
                    <Text style={styles.termsLink}>{t('terms_text_4')}</Text>
                </Text>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary },
    back: { paddingTop: spacing.xl + 20, paddingLeft: spacing.lg },
    backArrow: { color: colors.text.primary, fontSize: 24 },
    content: { flex: 1, padding: spacing.lg, justifyContent: 'center', gap: spacing.md },
    title: { color: colors.text.primary, fontSize: 28, fontWeight: '700' },
    sub: { color: colors.text.secondary, fontSize: 14, marginBottom: spacing.sm },
    inputRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.bg.elevated, borderRadius: radius.lg,
        borderWidth: 1, borderColor: colors.bg.surface, overflow: 'hidden',
    },
    countryChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: spacing.md, paddingVertical: spacing.md,
        backgroundColor: colors.bg.surface, borderRightWidth: 1,
        borderRightColor: colors.bg.overlay,
    },
    countryFlag: { fontSize: 18 },
    countryCode: { color: colors.text.primary, fontSize: 16, fontWeight: '600' },
    input: {
        flex: 1, paddingHorizontal: spacing.md, color: colors.text.primary,
        fontSize: 22, height: 58,
        fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
        fontWeight: '600', letterSpacing: 2,
    },
    terms: {
        color: colors.text.muted, fontSize: 11,
        textAlign: 'center', lineHeight: 18, marginTop: spacing.lg,
    },
    termsLink: { color: colors.gold.muted },
    smsBtn: {
        paddingVertical: spacing.md, alignItems: 'center',
        marginTop: spacing.sm, borderRadius: radius.md,
        borderWidth: 1, borderColor: colors.bg.surface,
    },
    smsBtnDisabled: {
        borderColor: colors.bg.overlay, opacity: 0.6,
    },
    smsBtnText: {
        color: colors.text.primary, fontSize: 15, fontWeight: '600',
    },
    smsBtnTextDisabled: { color: colors.text.muted },
});
