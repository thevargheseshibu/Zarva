import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Alert, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, shadows } from '../../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../../design-system/typography';
import PremiumButton from '../../../components/PremiumButton';
import FadeInView from '../../../components/FadeInView';
import Card from '../../../components/Card';
import { useAuthStore } from '../../../stores/authStore';
import apiClient from '../../../services/api/client';

const AGREEMENT_TEXT = `ZARVA PRO SERVICE PROTOCOL

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

const AGREEMENT_VERSION = 'v2026-02';

export default function OnboardingAgreement({ data, onNext }) {
    const [signature, setSignature] = useState('');
    const [loading, setLoading] = useState(false);
    const { user } = useAuthStore();

    const isValid = signature.trim().length >= 2;

    const handleSubmit = async () => {
        setLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        try {
            await apiClient.post('/api/worker/onboard', {
                ...data,
                agreement_signature: signature.trim(),
                agreement_version: AGREEMENT_VERSION,
                agreed_at: new Date().toISOString(),
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onNext({ signature });
        } catch (err) {
            Alert.alert('Protocol Error', err.response?.data?.message || 'Failed to submit application. Please verify connection.');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.screen}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <FadeInView delay={50}>
                    <Text style={styles.headerSub}>STEP 05/05</Text>
                    <Text style={styles.title}>Professional Protocol</Text>
                    <Text style={styles.sub}>Review the Zarva Pro service standards and formalize your enrollment.</Text>
                </FadeInView>

                <FadeInView delay={150} style={styles.section}>
                    <Text style={styles.label}>Service Agreement</Text>
                    <Card style={styles.agreementCard}>
                        <ScrollView style={styles.innerScroll} showsVerticalScrollIndicator={true}>
                            <Text style={styles.agreementBody}>{AGREEMENT_TEXT}</Text>
                        </ScrollView>
                    </Card>
                </FadeInView>

                <FadeInView delay={250} style={styles.section}>
                    <Text style={styles.label}>Electronic Signature</Text>
                    <Card style={styles.inputCard}>
                        <TextInput
                            style={styles.input}
                            value={signature}
                            onChangeText={setSignature}
                            placeholder={user?.name || 'Full Legal Name'}
                            placeholderTextColor={colors.text.muted}
                            autoCapitalize="words"
                        />
                    </Card>
                    <Text style={styles.hintTxt}>By typing your name, you execute this agreement electronically.</Text>
                </FadeInView>

                <FadeInView delay={350} style={styles.footer}>
                    <PremiumButton
                        title="Authorize Enrollment"
                        disabled={!isValid}
                        loading={loading}
                        onPress={handleSubmit}
                    />
                </FadeInView>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: spacing[24], gap: spacing[32], paddingBottom: 60 },
    headerSub: { color: colors.accent.primary, fontSize: 8, fontWeight: fontWeight.bold, letterSpacing: 2 },
    title: { color: colors.text.primary, fontSize: 32, fontWeight: '900', letterSpacing: tracking.hero, marginTop: 4 },
    sub: { color: colors.text.muted, fontSize: fontSize.body, lineHeight: 24, marginTop: 8 },

    section: { gap: 12 },
    label: { color: colors.accent.primary, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 2 },

    agreementCard: {
        height: 240,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surface,
        padding: 4
    },
    innerScroll: { padding: 16 },
    agreementBody: { color: colors.text.muted, fontSize: 11, lineHeight: 18, fontWeight: fontWeight.medium },

    inputCard: { backgroundColor: colors.surface, padding: 4, borderWidth: 1, borderColor: colors.surface },
    input: {
        paddingHorizontal: 16, paddingVertical: 14,
        color: colors.text.primary, fontSize: 18, fontWeight: 'bold', fontStyle: 'italic', letterSpacing: 0.5
    },
    hintTxt: { color: colors.text.muted, fontSize: 10, fontStyle: 'italic', paddingLeft: 4 },

    footer: { marginTop: spacing[16] }
});
