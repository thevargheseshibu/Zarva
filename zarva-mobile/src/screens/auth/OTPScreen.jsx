/**
 * src/screens/auth/OTPScreen.jsx
 * 6-digit OTP: countdown timer, resend, auto-submit, feature flag skip.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, Platform, Alert,
} from 'react-native';
import { colors, spacing, radius } from '../../design-system/tokens';
import GoldButton from '../../components/GoldButton';
import { useAuthStore } from '../../stores/authStore';
import apiClient from '../../services/api/client';
import { useT } from '../../hooks/useT';

const BOX_COUNT = 6;
const RESEND_SECONDS = 30;

export default function OTPScreen({ navigation, route }) {
    const { phone, authMethod = 'sms' } = route.params || {};
    const [digits, setDigits] = useState(Array(BOX_COUNT).fill(''));
    const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
    const [loading, setLoading] = useState(false);
    const inputs = useRef([]);
    const login = useAuthStore(s => s.login);
    const t = useT();

    // Countdown timer
    useEffect(() => {
        if (secondsLeft <= 0) return;
        const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
        return () => clearTimeout(t);
    }, [secondsLeft]);

    const handleChange = useCallback((text, index) => {
        const digit = text.replace(/[^0-9]/g, '').slice(-1);
        const next = [...digits];
        next[index] = digit;
        setDigits(next);

        if (digit && index < BOX_COUNT - 1) {
            inputs.current[index + 1]?.focus();
        }

        // Auto-submit when all 6 filled
        const full = next.join('');
        if (full.length === BOX_COUNT) {
            handleVerify(full);
        }
    }, [digits]);

    const handleKeyPress = (e, index) => {
        if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
            inputs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async (codeOverride) => {
        const code = codeOverride || digits.join('');
        if (code.length < BOX_COUNT) return;
        setLoading(true);

        const verifyEndpoint = authMethod === 'whatsapp' ? '/api/whatsapp/verify-otp' : '/api/auth/otp/verify';

        try {
            const res = await apiClient.post(verifyEndpoint, { phone, otp: code });
            const { token, user } = res.data;
            login(user, token);
            if (!user.role && !user.active_role) {
                navigation.navigate('RoleSelection');
            }
        } catch (err) {
            // Dev/stub mode: simulate success with actual signed dev backend token
            if (__DEV__) {
                try {
                    // Normalize phone structure to satisfy basic node route middleware
                    const mockAuthPhone = (phone || '').startsWith('+91') ? phone : `+91${phone || '0000000000'}`;
                    const devRes = await apiClient.post('/api/auth/dev-login', { phone: mockAuthPhone.replace(/\s+/g, '') });
                    const { token, user } = devRes.data;
                    login(user, token);
                    if (!user.role && !user.active_role) {
                        navigation.navigate('RoleSelection');
                    }
                } catch (devErr) {
                    console.error("DEV Login error: ", devErr?.response?.data || devErr);
                    Alert.alert('Error', `Could not reach backend. ${devErr?.response?.data?.message || ''}`);
                }
            } else {
                Alert.alert('Error', t('error_otp_invalid'));
                setDigits(Array(BOX_COUNT).fill(''));
                inputs.current[0]?.focus();
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        try {
            const sendEndpoint = authMethod === 'whatsapp' ? '/api/whatsapp/send-otp' : '/api/auth/otp/send';
            await apiClient.post(sendEndpoint, { phone });
        } catch (_) { }
        setSecondsLeft(RESEND_SECONDS);
        setDigits(Array(BOX_COUNT).fill(''));
        inputs.current[0]?.focus();
    };

    const minuteStr = `0:${String(secondsLeft).padStart(2, '0')}`;
    const maskedPhone = phone?.replace('+91', '').replace(/(\d{5})(\d{5})/, '+91 $1 $2');

    return (
        <View style={styles.screen}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
                <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>

            <View style={styles.content}>
                <Text style={styles.title}>{t('enter_6_digit_code')}</Text>
                <Text style={styles.sub}>{t('sent_to_number')} <Text style={styles.phone}>{maskedPhone}</Text></Text>

                {/* OTP Boxes */}
                <View style={styles.boxRow}>
                    {digits.map((d, i) => (
                        <TextInput
                            key={i}
                            ref={r => (inputs.current[i] = r)}
                            style={[styles.box, d && styles.boxFilled]}
                            value={d}
                            onChangeText={t => handleChange(t, i)}
                            onKeyPress={e => handleKeyPress(e, i)}
                            keyboardType="number-pad"
                            maxLength={1}
                            selectTextOnFocus
                            caretHidden
                        />
                    ))}
                </View>

                {/* Timer / Resend */}
                <View style={styles.resendRow}>
                    {secondsLeft > 0 ? (
                        <Text style={styles.timerText}>{t('resend_in')} <Text style={styles.timerNum}>{minuteStr}</Text></Text>
                    ) : (
                        <TouchableOpacity onPress={handleResend}>
                            <Text style={styles.resendBtn}>{t('resend_otp')}</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <GoldButton
                    title="Verify"
                    loading={loading}
                    disabled={digits.join('').length < BOX_COUNT}
                    onPress={() => handleVerify()}
                    style={{ marginTop: spacing.lg }}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary },
    back: { paddingTop: spacing.xl + 20, paddingLeft: spacing.lg },
    backArrow: { color: colors.text.primary, fontSize: 24 },
    content: {
        flex: 1, paddingHorizontal: spacing.lg,
        justifyContent: 'center', gap: spacing.md,
    },
    title: { color: colors.text.primary, fontSize: 26, fontWeight: '700' },
    sub: { color: colors.text.secondary, fontSize: 14 },
    phone: { color: colors.text.primary, fontWeight: '600' },
    boxRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', marginVertical: spacing.md },
    box: {
        width: 48, height: 58, backgroundColor: colors.bg.elevated,
        borderRadius: radius.sm, borderBottomWidth: 2.5,
        borderBottomColor: colors.text.muted,
        color: colors.text.primary, fontSize: 26,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        textAlign: 'center', fontWeight: '700',
    },
    boxFilled: { borderBottomColor: colors.gold.primary },
    resendRow: { alignItems: 'center', marginTop: spacing.xs },
    timerText: { color: colors.text.muted, fontSize: 14 },
    timerNum: { color: colors.text.secondary, fontWeight: '600' },
    resendBtn: { color: colors.gold.primary, fontSize: 15, fontWeight: '600' },
});
