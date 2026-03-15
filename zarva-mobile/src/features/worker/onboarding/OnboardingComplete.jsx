import React, { useState } from 'react';
import { useTokens } from '../@shared/design-system';
import { View, Text, ScrollView, TextInput, Alert, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';


import PremiumButton from '@shared/ui/PremiumButton';
import FadeInView from '@shared/ui/FadeInView';
import Card from '@shared/ui/ZCard';
import { useAuthStore } from '@auth/store';
import apiClient from '@infra/api/client';
import { useT } from '../@shared/i18n/useTranslation';
import { useUIStore } from '@shared/hooks/uiStore';
import MainBackground from '@shared/ui/MainBackground';

const AGREEMENT_VERSION = 'v2026-02';

export default function OnboardingAgreement({ data, onNext }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const [signature, setSignature] = useState('');
    const [loading, setLoading] = useState(false);
    const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
    const { user } = useAuthStore();
    const t = useT();

    const handleScroll = ({ nativeEvent }) => {
        const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
        const paddingToBottom = 20;
        if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
            if (!hasScrolledToBottom) {
                setHasScrolledToBottom(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
        }
    };

    const isValid = signature.trim().length >= 2 && hasScrolledToBottom;

    const handleSubmit = async () => {
        const { showLoader, hideLoader } = useUIStore.getState();
        showLoader(t('submitting_application') || "Finalizing Enrollment...");
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
            Alert.alert(t('protocol_error'), err.response?.data?.message || t('error_submit_application'));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            hideLoader();
        }
    };

    return (
        <MainBackground>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <FadeInView delay={50}>
                    <Text style={styles.headerSub}>{t('step_05')}</Text>
                    <Text style={styles.title}>{t('professional_protocol')}</Text>
                    <Text style={styles.sub}>{t('professional_protocol_desc')}</Text>
                </FadeInView>

                <FadeInView delay={150} style={styles.section}>
                    <Text style={styles.label}>{t('service_agreement')} {!hasScrolledToBottom && "(Please read to the end)"}</Text>
                    <Card style={[styles.agreementCard, !hasScrolledToBottom && { borderColor: t.brand.primary + '66' }]}>
                        <ScrollView
                            style={styles.innerScroll}
                            showsVerticalScrollIndicator={true}
                            nestedScrollEnabled={true}
                            onScroll={handleScroll}
                            scrollEventThrottle={16}
                        >
                            <Text style={styles.agreementBody}>{t('agreement_text')}</Text>
                            <View style={{ height: 20 }} />
                        </ScrollView>
                    </Card>
                    {hasScrolledToBottom && <Text style={styles.successHint}>✓ Read completely</Text>}
                </FadeInView>

                <FadeInView delay={250} style={styles.section}>
                    <Text style={styles.label}>{t('electronic_signature')}</Text>
                    <Card style={styles.inputCard}>
                        <TextInput
                            style={styles.input}
                            value={signature}
                            onChangeText={setSignature}
                            placeholder={user?.name || t('full_legal_name')}
                            placeholderTextColor={t.text.tertiary}
                            autoCapitalize="words"
                        />
                    </Card>
                    <Text style={styles.hintTxt}>{t('signature_hint')}</Text>
                </FadeInView>

                <FadeInView delay={350} style={styles.footer}>
                    <PremiumButton
                        title={t('authorize_enrollment')}
                        disabled={!isValid}
                        loading={loading}
                        onPress={() => {
                            if (!isValid) {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                                if (!hasScrolledToBottom) {
                                    Alert.alert(t('protocol_required'), t('please_read_agreement'));
                                }
                                return;
                            }
                            handleSubmit();
                        }}
                    />
                </FadeInView>
            </ScrollView>
        </MainBackground>
    );
}

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.app },
    scrollContent: { padding: t.spacing['2xl'], gap: t.spacing[32], paddingBottom: 60 },
    headerSub: { color: t.text.primary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 2 },
    title: { color: t.text.primary, fontSize: 32, fontWeight: '900', letterSpacing: t.typography.tracking.hero, marginTop: 4 },
    sub: { color: t.text.tertiary, fontSize: t.typography.size.body, lineHeight: 24, marginTop: 8 },

    section: { gap: 12 },
    label: { color: t.text.primary, fontSize: 12, fontWeight: t.typography.weight.bold, letterSpacing: 2 },

    agreementCard: {
        height: 240,
        backgroundColor: t.background.surface,
        borderWidth: 1,
        borderColor: t.background.surface,
        padding: 4
    },
    innerScroll: { padding: 16 },
    agreementBody: { color: t.text.tertiary, fontSize: 11, lineHeight: 18, fontWeight: t.typography.weight.medium },

    inputCard: { backgroundColor: t.background.surface, padding: 4, borderWidth: 1, borderColor: t.background.surface },
    input: {
        paddingHorizontal: 16, paddingVertical: 14,
        color: t.text.primary, fontSize: 18, fontWeight: 'bold', fontStyle: 'italic', letterSpacing: 0.5
    },
    hintTxt: { color: t.text.tertiary, fontSize: 10, fontStyle: 'italic', paddingLeft: 4 },

    footer: { marginTop: t.spacing.lg },
    successHint: { color: t.brand.primary, fontSize: 10, fontWeight: 'bold', textAlign: 'right', marginTop: 4 }
});
