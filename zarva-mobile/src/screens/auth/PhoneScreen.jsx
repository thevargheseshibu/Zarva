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

export default function PhoneScreen({ navigation }) {
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);

    const formatted = phone.replace(/(\d{3})(\d{1,3})?(\d{1,4})?/, function (_, p1, p2, p3) {
        let res = p1;
        if (p2) res += '-' + p2;
        if (p3) res += '-' + p3;
        return res;
    });
    const isReady = phone.length === 10;

    const login = useAuthStore(s => s.login);

    const handleSend = async () => {
        if (!isReady) return;
        setLoading(true);
        try {
            const res = await apiClient.post('/api/auth/otp/send', {
                phone: `+91${phone}`,
            });

            if (res.data?.bypassed) {
                // If OTP is bypassed (dev mode), verify immediately
                const verifyRes = await apiClient.post('/api/auth/otp/verify', {
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
            setLoading(false);
            // Navigate to OTP screen for real flow or if bypass check failed
            const st = useAuthStore.getState();
            if (!st.isAuthenticated) {
                navigation.navigate('OTP', { phone: `+91${phone}` });
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
                <Text style={styles.title}>Enter your number</Text>
                <Text style={styles.sub}>We'll send you a verification code</Text>

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
                    title="Send OTP"
                    disabled={!isReady}
                    loading={loading}
                    onPress={handleSend}
                    style={{ marginTop: spacing.xl }}
                />

                <Text style={styles.terms}>
                    By continuing, you agree to ZARVA's{' '}
                    <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
                    <Text style={styles.termsLink}>Privacy Policy</Text>
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
});
