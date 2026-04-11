/**
 * src/screens/auth/PhoneScreen.jsx
 *
 * OTP SEND FLOW:
 *   WhatsApp path → backend /api/whatsapp/send-otp
 *   SMS path:
 *     1. Try real Firebase signInWithPhoneNumber
 *     2. If Firebase throws ANY error:
 *        a. Call POST /api/auth/dev-otp/send on the server
 *        b. Server returns { isTestNumber: true/false } — no OTP code ever sent to mobile
 *        c. If isTestNumber → show OTP screen (verification done by server later)
 *        d. If NOT isTestNumber → show specific error alert, stop
 *
 * 🔐 Security: No test phone numbers or OTP codes exist in mobile code.
 *              Server owns the test credentials via .env.development
 */
import React, { useState } from 'react';
import { useTokens } from '@shared/design-system';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform, Alert
} from 'react-native';

import PremiumButton from '@shared/ui/PremiumButton';
import apiClient from '@infra/api/client';
import { useAuthStore } from '@auth/store';
import { useOtpStore } from '@auth/otpStore';
import { useT } from '@shared/i18n/useTranslation';
import MainBackground from '@shared/ui/MainBackground';
import auth, { getAuth, signInWithPhoneNumber } from '@react-native-firebase/auth';

// --- FIREBASE SETUP ---
// Initialized once at module-level.
let _firebaseAuth = null;
function getFirebaseAuth() {
    if (!_firebaseAuth) {
        _firebaseAuth = getAuth();
        // NOTE: Do NOT set appVerificationDisabledForTesting on real devices.
        // That flag disables SafetyNet/Play Integrity and causes auth/missing-client-identifier.
        // Real device auth is handled by the SHA-1 certificate in google-services.json.
    }
    return _firebaseAuth;
}

export default function PhoneScreen({ navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(null);
    const login = useAuthStore(s => s.login);

    const formatted = phone.replace(/(\d{3})(\d{1,3})?(\d{1,4})?/, function (_, p1, p2, p3) {
        let res = p1;
        if (p2) res += '-' + p2;
        if (p3) res += '-' + p3;
        return res;
    });
    const isReady = phone.length === 10;

    const handleSend = async (method) => {
        if (!isReady) return;
        setLoading(method);

        try {
            if (method === 'whatsapp') {
                // ── WhatsApp path ──────────────────────────────────────────────────
                const res = await apiClient.post('/api/whatsapp/send-otp', {
                    phone: `+91${phone}`,
                });
                if (res.data?.bypassed) {
                    const verifyRes = await apiClient.post('/api/whatsapp/verify-otp', {
                        phone: `+91${phone}`,
                        otp: '000000'
                    });
                    const { token, user } = verifyRes.data;
                    login(user, token);
                    return;
                }
                useOtpStore.getState().setConfirmationObj(null);

            } else {
                // ── SMS / Firebase path ────────────────────────────────────────────
                let confirmationObj = null;

                try {
                    const authInstance = getFirebaseAuth();
                    console.log('[Firebase] Requesting OTP for', `+91${phone}`);
                    confirmationObj = await signInWithPhoneNumber(authInstance, `+91${phone}`);
                    console.log('[Firebase] OTP sent successfullys', confirmationObj);
                } catch (firebaseErr) {
                    console.error('[Firebase OTP Error]', firebaseErr.code);

                    // ── Firebase failed → ask server if this is a test number ──────
                    // Server checks TEST_PHONE_NUMBERS in .env — no codes on mobile
                    let isTestNumber = false;
                    try {
                        const checkRes = await apiClient.post('/api/auth/dev-otp/send', {
                            phone: `+91${phone}`
                        });
                        isTestNumber = checkRes.data?.isTestNumber === true;
                    } catch (serverErr) {
                        console.error('[dev-otp/send] Server check failed:', serverErr.message);
                    }

                    if (isTestNumber) {
                        // Server acknowledged it's a test number.
                        // Set a sentinel marker so OTPScreen routes to server-verify.
                        console.log('[OTP] Server confirmed test number — proceeding to OTP screen');
                        confirmationObj = { _isServerTestFlow: true, phone: `+91${phone}` };
                    } else {
                        // Real number, real failure — show a user-friendly message
                        let userMsg = t('error_otp_send_failed');
                        if (firebaseErr.code === 'auth/too-many-requests') {
                            userMsg = t('error_otp_too_many_requests');
                        } else if (firebaseErr.code === 'auth/invalid-phone-number') {
                            userMsg = t('error_otp_invalid_phone');
                        } else if (firebaseErr.code === 'auth/missing-client-identifier') {
                            userMsg = t('error_app_verification');
                        }
                        Alert.alert(t('otp_error'), userMsg);
                        return;
                    }
                }

                useOtpStore.getState().setConfirmationObj(confirmationObj);
            }

            // ── Navigate to OTP screen ─────────────────────────────────────────
            navigation.navigate('OTP', {
                phone: `+91${phone}`,
                authMethod: method,
            });

        } catch (err) {
            console.error('[handleSend unexpected error]', err);
            Alert.alert(t('error'), t('error_generic'));
        } finally {
            setLoading(null);
        }
    };

    return (
        <MainBackground>
            <KeyboardAvoidingView
                style={styles.screen}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
                    <Text style={styles.backArrow}>←</Text>
                </TouchableOpacity>

                <View style={styles.content}>
                    <Text style={styles.title}>{t('phone_entry_title')}</Text>
                    <Text style={styles.sub}>{t('phone_entry_sub')}</Text>

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
                            placeholderTextColor={tTheme.text.tertiary}
                            maxLength={12}
                            autoFocus
                        />
                    </View>

                    <PremiumButton
                        title={t('get_otp_whatsapp')}
                        disabled={!isReady || !!loading}
                        loading={loading === 'whatsapp'}
                        onPress={() => handleSend('whatsapp')}
                        style={{ marginTop: tTheme.spacing.xl }}
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
        </MainBackground>
    );
}

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: 'transparent' },
    back: { paddingTop: t.spacing.xl + 20, paddingLeft: t.spacing.lg },
    backArrow: { color: t.text.primary, fontSize: 24 },
    content: { flex: 1, padding: t.spacing.lg, justifyContent: 'center', gap: t.spacing.md },
    title: { color: t.text.primary, fontSize: 28, fontWeight: '700' },
    sub: { color: t.text.secondary, fontSize: 14, marginBottom: t.spacing.sm },
    inputRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: t.background.surface, borderRadius: t.radius.lg,
        borderWidth: 1, borderColor: t.background.surface, overflow: 'hidden',
    },
    countryChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.md,
        backgroundColor: t.background.surfaceRaised, borderRightWidth: 1,
        borderRightColor: 'rgba(255,255,255,0.05)',
    },
    countryFlag: { fontSize: 18 },
    countryCode: { color: t.text.primary, fontSize: 16, fontWeight: '600' },
    input: {
        flex: 1, paddingHorizontal: t.spacing.md, color: t.text.primary,
        fontSize: 22, height: 58,
        fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
        fontWeight: '600', letterSpacing: 2,
    },
    terms: {
        color: t.text.tertiary, fontSize: 11,
        textAlign: 'center', lineHeight: 18, marginTop: t.spacing.lg,
    },
    termsLink: { color: t.brand.primary },
    smsBtn: {
        paddingVertical: t.spacing.md, alignItems: 'center',
        marginTop: t.spacing.sm, borderRadius: t.radius.md,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    smsBtnDisabled: { borderColor: t.border.default, opacity: 0.6 },
    smsBtnText: { color: t.text.primary, fontSize: 15, fontWeight: '600' },
    smsBtnTextDisabled: { color: t.text.tertiary },
});
