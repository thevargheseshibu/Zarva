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

const BOX_COUNT = 6;
const RESEND_SECONDS = 30;

export default function OTPScreen({ navigation, route }) {
    const { phone } = route.params || {};
    const [digits, setDigits] = useState(Array(BOX_COUNT).fill(''));
    const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
    const [loading, setLoading] = useState(false);
    const inputs = useRef([]);
    const login = useAuthStore(s => s.login);

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
        try {
            const res = await apiClient.post('/api/auth/otp/verify', { phone, otp: code });
            const { token, user } = res.data;
            login(user, token);
            if (!user.role && !user.active_role) {
                navigation.navigate('RoleSelection');
            }
        } catch (err) {
            // Dev/stub mode: simulate success with mock data
            if (__DEV__) {
                login({ phone, role: null, active_role: null, onboarding_complete: true }, 'dev-mock-token');
                navigation.navigate('RoleSelection');
            } else {
                Alert.alert('Invalid OTP', 'The code you entered is incorrect. Please try again.');
                setDigits(Array(BOX_COUNT).fill(''));
                inputs.current[0]?.focus();
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        try {
            await apiClient.post('/api/auth/otp/send', { phone });
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
                <Text style={styles.title}>Enter the 6-digit code</Text>
                <Text style={styles.sub}>Sent to <Text style={styles.phone}>{maskedPhone}</Text></Text>

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
                        <Text style={styles.timerText}>Resend in <Text style={styles.timerNum}>{minuteStr}</Text></Text>
                    ) : (
                        <TouchableOpacity onPress={handleResend}>
                            <Text style={styles.resendBtn}>Resend OTP</Text>
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
