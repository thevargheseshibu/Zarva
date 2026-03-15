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
import { useTokens } from '@shared/design-system';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, Platform, Alert,
} from 'react-native';

import PremiumButton from '@shared/ui/PremiumButton';
import { useAuthStore } from '@auth/store';
import { useOtpStore } from '@auth/otpStore';
import apiClient from '@infra/api/client';
import { useT } from '@shared/i18n/useTranslation';
import MainBackground from '@shared/ui/MainBackground';
import auth, { getAuth, signInWithPhoneNumber } from '@react-native-firebase/auth';

const BOX_COUNT = 6;
const RESEND_SECONDS = 30;

export default function OTPScreen({ navigation, route }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const { phone, authMethod = 'sms' } = route.params || {};
    const [digits, setDigits] = useState(Array(BOX_COUNT).fill(''));
    const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
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

    const showInvalidOtp = (msg) => {
        setErrorMsg(msg || t('error_otp_incorrect'));
        setDigits(Array(BOX_COUNT).fill(''));
        inputs.current[0]?.focus();
    };

    const handleVerify = async (codeOverride) => {
        const code = codeOverride || digits.join('');
        if (code.length < BOX_COUNT) return;
        setLoading(true);
        setErrorMsg(null);

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
                Alert.alert(t('session_expired'), t('request_new_otp_msg'));
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
                        setErrorMsg(serverErr?.response?.data?.message || t('error_generic'));
                    }
                }
                return;
            }

            // ── Path 2: Real Firebase confirmation ───────────────────────────
            let firebaseIdToken = null;
            try {
                const credential = await confirmation.confirm(code);
                firebaseIdToken = await credential.user.getIdToken(true);
            } catch (confirmErr) {
                const isInvalid = confirmErr.code === 'auth/invalid-verification-code'
                    || confirmErr.message?.toLowerCase().includes('invalid');
                if (isInvalid) {
                    showInvalidOtp();
                } else {
                    setErrorMsg(confirmErr.message || t('error_generic'));
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
            setErrorMsg(err?.response?.data?.message || t('error_otp_invalid'));
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
                const authInstance = getAuth();
                if (__DEV__) {
                    try { authInstance.settings.appVerificationDisabledForTesting = true; } catch (_) { }
                }
                const newConfirmation = await signInWithPhoneNumber(authInstance, phone);
                useOtpStore.getState().setConfirmationObj(newConfirmation);
            }
        } catch (e) {
            console.error('[handleResend error]', e);
            Alert.alert(t('resend_failed'), t('error_resend_failed'));
        }
        setSecondsLeft(RESEND_SECONDS);
        setDigits(Array(BOX_COUNT).fill(''));
        inputs.current[0]?.focus();
    };

    const minuteStr = `0:${String(secondsLeft).padStart(2, '0')}`;
    const maskedPhone = phone?.replace('+91', '').replace(/(\d{5})(\d{5})/, '+91 $1 $2');

    return (
        <MainBackground>
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
                            style={[styles.box, d && styles.boxFilled, errorMsg && styles.boxError]}
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

                {errorMsg && (
                    <Text style={styles.errorText}>{errorMsg}</Text>
                )}

                <View style={styles.resendRow}>
                    {secondsLeft > 0 ? (
                        <Text style={styles.timerText}>{t('resend_in')} <Text style={styles.timerNum}>{minuteStr}</Text></Text>
                    ) : (
                        <TouchableOpacity onPress={handleResend}>
                            <Text style={styles.resendBtn}>{t('resend_otp')}</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <PremiumButton
                    title={t('verify')}
                    loading={loading}
                    disabled={digits.join('').length < BOX_COUNT}
                    onPress={() => handleVerify()}
                    style={{ marginTop: tTheme.spacing.lg }}
                />
            </View>
        </MainBackground>
    );
}

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: 'transparent' },
    back: { paddingTop: t.spacing.xl + 20, paddingLeft: t.spacing.lg },
    backArrow: { color: t.text.primary, fontSize: 24 },
    content: {
        flex: 1, paddingHorizontal: t.spacing.lg,
        justifyContent: 'center', gap: t.spacing.md,
    },
    title: { color: t.text.primary, fontSize: 26, fontWeight: '700' },
    sub: { color: t.text.secondary, fontSize: 14 },
    phone: { color: t.text.primary, fontWeight: '600' },
    boxRow: { flexDirection: 'row', gap: t.spacing.sm, justifyContent: 'center', marginVertical: t.spacing.md },
    box: {
        width: 44, height: 58, backgroundColor: t.background.surface,
        borderRadius: t.radius.md, borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        color: t.text.primary, fontSize: 26,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        textAlign: 'center', fontWeight: '700',
    },
    boxFilled: { borderColor: t.brand.primary + '66' },
    boxError: { borderBottomColor: t.status.error.base, color: t.status.error.base },
    errorText: { color: t.status.error.base, fontSize: 13, textAlign: 'center', marginTop: -t.spacing.sm, marginBottom: t.spacing.sm },
    resendRow: { alignItems: 'center', marginTop: t.spacing.xs },
    timerText: { color: t.text.tertiary, fontSize: 14 },
    timerNum: { color: t.text.secondary, fontWeight: '600' },
    resendBtn: { color: t.brand.primary, fontSize: 15, fontWeight: '600' },
});
