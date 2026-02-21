/**
 * src/screens/auth/OTPScreen.jsx
 *
 * OTP VERIFY FLOW (SMS path):
 *   The confirmation object in otpStore can be one of three things:
 *
 *   1. Real Firebase confirmation  → confirmation.confirm(code) → get Firebase ID token
 *      → POST /api/auth/otp/verify (server verifies token with Firebase Admin SDK)
 *
 *   2. Test number sentinel ({ _isServerTestFlow: true })
 *      → POST /api/auth/dev-otp/verify with { phone, otp }
 *      → Server validates the OTP against TEST_PHONE_NUMBERS in .env
 *      → Returns JWT on success, 401 on wrong OTP
 *
 *   3. null (missing) → session expired, tell user to go back
 *
 * 🔐 Security: No OTP codes exist on mobile. All validation is server-side.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, Platform, Alert,
} from 'react-native';
import { colors, spacing, radius } from '../../design-system/tokens';
import GoldButton from '../../components/GoldButton';
import { useAuthStore } from '../../stores/authStore';
import { useOtpStore } from '../../stores/otpStore';
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

    useEffect(() => {
        if (secondsLeft <= 0) return;
        const timer = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
        return () => clearTimeout(timer);
    }, [secondsLeft]);

    const handleChange = useCallback((text, index) => {
        const digit = text.replace(/[^0-9]/g, '').slice(-1);
        const next = [...digits];
        next[index] = digit;
        setDigits(next);
        if (digit && index < BOX_COUNT - 1) {
            inputs.current[index + 1]?.focus();
        }
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

    const navigateAfterLogin = (_user) => {
        // RootNavigator conditionally renders RoleSelection when active_role is null.
        // Calling login() with the user data is all that's needed — do NOT navigate manually.
    };

    const showInvalidOtp = () => {
        Alert.alert('Wrong OTP', 'The code you entered is incorrect. Please try again.');
        setDigits(Array(BOX_COUNT).fill(''));
        inputs.current[0]?.focus();
    };

    const handleVerify = async (codeOverride) => {
        const code = codeOverride || digits.join('');
        if (code.length < BOX_COUNT) return;
        setLoading(true);

        try {
            // ── WhatsApp path ──────────────────────────────────────────────────
            if (authMethod === 'whatsapp') {
                const res = await apiClient.post('/api/whatsapp/verify-otp', { phone, otp: code });
                const { token, user } = res.data;
                login(user, token);
                navigateAfterLogin(user);
                return;
            }

            // ── SMS / Firebase path ────────────────────────────────────────────
            const confirmation = useOtpStore.getState().confirmationObj;

            if (!confirmation) {
                Alert.alert('Session Expired', 'Please go back and request a new OTP.');
                return;
            }

            // ── Path 1: Server test number flow ──────────────────────────────
            if (confirmation._isServerTestFlow) {
                console.log('[OTP] Server test flow — verifying with /api/auth/dev-otp/verify');
                try {
                    const res = await apiClient.post('/api/auth/dev-otp/verify', {
                        phone: confirmation.phone || phone,
                        otp: code,
                    });
                    const { token, user } = res.data;
                    login(user, token);
                    navigateAfterLogin(user);
                } catch (serverErr) {
                    const serverCode = serverErr?.response?.data?.code;
                    if (serverCode === 'INVALID_OTP') {
                        showInvalidOtp();
                    } else {
                        Alert.alert('Error', serverErr?.response?.data?.message || 'Verification failed.');
                    }
                }
                return;
            }

            // ── Path 2: Real Firebase confirmation ───────────────────────────
            let firebaseIdToken = null;
            try {
                const credential = await confirmation.confirm(code);
                firebaseIdToken = await credential.user.getIdToken();
            } catch (confirmErr) {
                const isInvalid = confirmErr.code === 'auth/invalid-verification-code'
                    || confirmErr.message?.toLowerCase().includes('invalid');
                if (isInvalid) {
                    showInvalidOtp();
                } else {
                    Alert.alert('Error', confirmErr.message || 'Verification failed.');
                }
                return;
            }

            // Send Firebase ID token to backend for final verification
            const res = await apiClient.post('/api/auth/verify-otp', {
                phone,
                firebase_id_token: firebaseIdToken
            });
            const { token, user } = res.data;
            login(user, token);
            navigateAfterLogin(user);

        } catch (err) {
            console.error('[handleVerify error]', err?.response?.data || err.message);
            Alert.alert('Error', err?.response?.data?.message || t('error_otp_invalid'));
            setDigits(Array(BOX_COUNT).fill(''));
            inputs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        const confirmation = useOtpStore.getState().confirmationObj;
        try {
            if (authMethod === 'whatsapp') {
                await apiClient.post('/api/whatsapp/send-otp', { phone });
            } else if (confirmation?._isServerTestFlow) {
                // Test number resend — re-call the server send endpoint (no-op really, just resets timer)
                await apiClient.post('/api/auth/dev-otp/send', { phone });
                // Keep the same sentinel in the store
            } else {
                // Real Firebase resend
                const { getAuth, signInWithPhoneNumber } = require('@react-native-firebase/auth');
                const auth = getAuth();
                if (__DEV__) {
                    try { auth.settings.appVerificationDisabledForTesting = true; } catch (_) { }
                }
                const newConfirmation = await signInWithPhoneNumber(auth, phone);
                useOtpStore.getState().setConfirmationObj(newConfirmation);
            }
        } catch (e) {
            console.error('[handleResend error]', e);
            Alert.alert('Resend Failed', 'Could not resend OTP. Please try again.');
        }
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

                <View style={styles.boxRow}>
                    {digits.map((d, i) => (
                        <TextInput
                            key={i}
                            ref={r => (inputs.current[i] = r)}
                            style={[styles.box, d && styles.boxFilled]}
                            value={d}
                            onChangeText={text => handleChange(text, i)}
                            onKeyPress={e => handleKeyPress(e, i)}
                            keyboardType="number-pad"
                            maxLength={1}
                            selectTextOnFocus
                            caretHidden
                        />
                    ))}
                </View>

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
