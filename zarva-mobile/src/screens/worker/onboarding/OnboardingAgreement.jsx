/**
 * src/screens/worker/onboarding/OnboardingAgreement.jsx
 * Step 5: Scrollable T&C, name confirmation field, submit to backend.
 */
import React, { useState } from 'react';
import {
    View, Text, ScrollView, TextInput, Alert, StyleSheet,
} from 'react-native';
import { colors, spacing, radius } from '../../../design-system/tokens';
import GoldButton from '../../../components/GoldButton';
import { useAuthStore } from '../../../stores/authStore';
import apiClient from '../../../services/api/client';

const AGREEMENT_TEXT = `ZARVA SERVICE PROVIDER AGREEMENT

Last updated: February 2026

1. ELIGIBILITY
You confirm that you are at least 18 years old, legally permitted to work in India, and possess the skills listed in your profile.

2. PLATFORM USAGE
ZARVA provides a technology platform connecting you with customers. Each job contract is between you and the customer directly.

3. QUALITY STANDARDS
You agree to arrive on time, complete jobs professionally, and maintain a minimum rating of 3.5 stars.

4. PAYMENTS
ZARVA will remit your earnings within 48 hours of job completion, minus the platform fee (currently 15%).

5. CANCELLATIONS
Repeated last-minute cancellations may result in temporary or permanent suspension.

6. DATA & PRIVACY
Your location will be shared with matched customers during active jobs only.

7. TERMINATION
Either party may terminate this agreement with 7 days notice.

By typing your name below, you agree to all terms.`;

const AGREEMENT_VERSION = 'v2026-02'; // Versioned to the Last updated date in AGREEMENT_TEXT

export default function OnboardingAgreement({ data, onNext }) {
    const [signature, setSignature] = useState('');
    const [loading, setLoading] = useState(false);
    const { user, token, login } = useAuthStore();

    const isValid = signature.trim().length >= 2;

    const handleSubmit = async () => {
        setLoading(true);
        try {
            await apiClient.post('/api/worker/onboard', {
                ...data,
                agreement_signature: signature.trim(),
                agreement_version: AGREEMENT_VERSION,
                agreed_at: new Date().toISOString(),
            });
            onNext({ signature });
        } catch (err) {
            Alert.alert('Submission Failed', err.response?.data?.message || 'Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.screen}>
            <Text style={styles.title}>Service Agreement</Text>
            <Text style={styles.sub}>Please read and sign before submitting your application.</Text>

            <ScrollView style={styles.scrollBox} contentContainerStyle={styles.scrollContent}>
                <Text style={styles.agreementText}>{AGREEMENT_TEXT}</Text>
            </ScrollView>

            <View style={styles.signSection}>
                <Text style={styles.signLabel}>Type your full name to agree</Text>
                <TextInput
                    style={styles.signInput}
                    value={signature}
                    onChangeText={setSignature}
                    placeholder={user?.name || 'Your full name'}
                    placeholderTextColor={colors.text.muted}
                    autoCapitalize="words"
                />
                <GoldButton
                    title="Submit Application"
                    disabled={!isValid}
                    loading={loading}
                    onPress={handleSubmit}
                    style={{ marginTop: spacing.md }}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.md },
    title: { color: colors.text.primary, fontSize: 24, fontWeight: '700' },
    sub: { color: colors.text.secondary, fontSize: 14 },
    scrollBox: {
        flex: 1, backgroundColor: colors.bg.elevated,
        borderRadius: radius.lg, borderWidth: 1, borderColor: colors.bg.surface,
    },
    scrollContent: { padding: spacing.md },
    agreementText: { color: colors.text.muted, fontSize: 12.5, lineHeight: 20 },
    signSection: { gap: spacing.sm, paddingBottom: spacing.lg },
    signLabel: { color: colors.text.secondary, fontSize: 13, fontWeight: '600' },
    signInput: {
        backgroundColor: colors.bg.elevated, borderRadius: radius.md,
        paddingHorizontal: spacing.md, paddingVertical: 14,
        color: colors.text.primary, fontSize: 16,
        borderWidth: 1.5, borderColor: colors.gold.muted,
        fontStyle: 'italic',
    },
});
