import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, BackHandler, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withDelay,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, shadows } from '../../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../../design-system/typography';
import PremiumButton from '../../../components/PremiumButton';
import { useAuthStore } from '../../../stores/authStore';
import apiClient from '../../../services/api/client';
import FadeInView from '../../../components/FadeInView';
import Card from '../../../components/Card';
import { useT } from '../../../hooks/useT';
import MainBackground from '../../../components/MainBackground';

export default function PendingApproval() {
    const t = useT();
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);
    const { logout, refreshUser } = useAuthStore();

    useEffect(() => {
        scale.value = withDelay(300, withSpring(1, { damping: 10, stiffness: 180 }));
        opacity.value = withDelay(200, withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) }));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, []);

    useEffect(() => {
        const poll = setInterval(async () => {
            try {
                const res = await apiClient.get('/api/worker/onboard/status');
                const status = res.data?.data?.kyc_status;
                if (status === 'approved') {
                    clearInterval(poll);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    const meRes = await apiClient.get('/api/me');
                    useAuthStore.getState().setUser(meRes.data?.user || meRes.data);
                }
            } catch (err) { }
        }, 30000);

        return () => clearInterval(poll);
    }, []);

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => true;
            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [])
    );

    const checkStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    return (
        <MainBackground>
            <FadeInView delay={50} style={styles.content}>
                <Animated.View style={[styles.statusIconBox, checkStyle]}>
                    <View style={styles.glowCircle} />
                    <Text style={styles.checkmark}>✓</Text>
                </Animated.View>

                <View style={styles.textStack}>
                    <Text style={styles.statusLabel}>{t('enrollment_pending')}</Text>
                    <Text style={styles.title}>{t('protocol_under_review')}</Text>
                    <Text style={styles.sub}>
                        {t('protocol_under_review_desc_1')}<Text style={styles.accentText}>{t('protocol_under_review_desc_2')}</Text>{t('protocol_under_review_desc_3')}
                    </Text>
                </View>

                <View style={styles.timeline}>
                    {[
                        { label: t('credentials_submitted'), status: 'done' },
                        { label: t('security_validation'), status: 'pending' },
                        { label: t('network_activation'), status: 'future' }
                    ].map((step, i) => (
                        <View key={i} style={styles.stepRow}>
                            <View style={[styles.stepDot, step.status === 'done' && styles.dotDone, step.status === 'pending' && styles.dotPending]} />
                            <Card style={[styles.stepCard, step.status === 'done' && styles.cardDone]}>
                                <Text style={[styles.stepLabel, step.status === 'future' && styles.labelFuture]}>{step.label}</Text>
                                {step.status === 'pending' && <ActivityIndicator size="small" color={colors.accent.primary} style={styles.inlineLoader} />}
                            </Card>
                        </View>
                    ))}
                </View>

                <View style={styles.footer}>
                    <PremiumButton
                        title={t('return_to_terminal')}
                        variant="ghost"
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            logout();
                        }}
                    />
                    <Text style={styles.footerHint}>{t('notify_encrypted_channel')}</Text>
                </View>
            </FadeInView>
        </MainBackground>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' },
    content: { padding: spacing[32], gap: 48, alignItems: 'center' },

    statusIconBox: { width: 120, height: 120, justifyContent: 'center', alignItems: 'center' },
    glowCircle: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 60,
        backgroundColor: colors.accent.primary + '11',
        borderWidth: 2,
        borderColor: colors.accent.primary + '22'
    },
    checkmark: { color: colors.accent.primary, fontSize: 48, fontWeight: '900' },

    textStack: { alignItems: 'center', gap: 12 },
    statusLabel: { color: colors.accent.primary, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 3 },
    title: { color: colors.text.primary, fontSize: 28, fontWeight: '900', letterSpacing: tracking.title, textAlign: 'center' },
    sub: { color: colors.text.muted, fontSize: 13, lineHeight: 22, textAlign: 'center', paddingHorizontal: 20 },
    accentText: { color: colors.text.primary, fontWeight: fontWeight.bold },

    timeline: { width: '100%', gap: 16 },
    stepRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.elevated },
    dotDone: { backgroundColor: colors.accent.primary },
    dotPending: { backgroundColor: colors.accent.primary, opacity: 0.5 },

    stepCard: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surface },
    cardDone: { backgroundColor: colors.accent.primary + '08', borderColor: colors.accent.primary + '11' },
    stepLabel: { color: colors.text.primary, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 1 },
    labelFuture: { color: colors.text.muted },
    inlineLoader: { transform: [{ scale: 0.7 }] },

    footer: { width: '100%', alignItems: 'center', gap: 16 },
    footerHint: { color: colors.text.muted, fontSize: 9, fontStyle: 'italic' }
});
