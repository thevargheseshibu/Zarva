import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, BackHandler, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useT } from '../../hooks/useT';
import { useJobStore } from '../../stores/jobStore';
import apiClient from '../../services/api/client';
import FadeInView from '../../components/FadeInView';
import PremiumButton from '../../components/PremiumButton';
import RadarAnimation from '../../components/RadarAnimation';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import { colors, radius, spacing, shadows } from '../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../design-system/typography';

export default function SearchingScreen({ route, navigation }) {
    const t = useT();
    const { category, jobId } = route.params || { category: 'unknown', jobId: 'mock-123' };
    const [countdown, setCountdown] = useState(5);
    const { searchPhase, canMinimize, setCanMinimize, stopListening, clearActiveJob, waveNumber } = useJobStore();

    useEffect(() => { navigation.setOptions({ gestureEnabled: false }); }, [navigation]);

    useEffect(() => {
        if (canMinimize) return;
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
            return () => clearTimeout(timer);
        } else { setCanMinimize(true); }
    }, [countdown, canMinimize]);

    useEffect(() => {
        if (searchPhase === 'assigned') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            navigation.replace('JobStatusDetail', { jobId });
        }
    }, [searchPhase, jobId]);

    useFocusEffect(useCallback(() => {
        const onBackPress = () => {
            Alert.alert(t('cancel_request_title'), t('cancel_request_msg'), [
                { text: t('keep_waiting'), style: 'cancel' },
                {
                    text: t('cancel'), style: 'destructive',
                    onPress: async () => {
                        stopListening(); clearActiveJob();
                        try { await apiClient.post(`/api/jobs/${jobId}/cancel`); } catch (e) { }
                        navigation.replace('CustomerTabs');
                    }
                }
            ]);
            return true;
        };
        const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => sub.remove();
    }, [jobId]));

    const handleGoHome = () => {
        stopListening(); clearActiveJob();
        navigation.replace('CustomerTabs');
    };

    if (searchPhase === 'no_worker_found') {
        return (
            <View style={styles.screen}>
                <FadeInView delay={100} style={styles.errorContent}>
                    <View style={styles.errorIconCircle}>
                        <Text style={styles.errorIcon}>📍</Text>
                    </View>
                    <Text style={styles.errorTitle}>{t('no_workers_found')}</Text>
                    <Text style={styles.errorSub}>
                        {t('no_workers_desc').replace('%{category}', t(`cat_${category}`) || category)}
                    </Text>
                    <PremiumButton title={t('return_home')} onPress={handleGoHome} />
                </FadeInView>
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <View style={styles.content}>
                <FadeInView delay={200} style={styles.searchingHeader}>
                    <Text style={styles.searchingTitle}>{t('searching_for').replace('%{category}', t(`cat_${category}`) || category)}</Text>
                    <Text style={styles.searchingSub}>{t('searching_sub')}</Text>
                </FadeInView>

                <View style={styles.radarWrapper}>
                    <RadarAnimation size={240} />
                    <View style={styles.pulseLabel}>
                        <Text style={styles.waveTxt}>{t('wave')} {waveNumber}/3</Text>
                    </View>
                </View>

                <FadeInView delay={400} style={styles.statusBox}>
                    <Text style={styles.statusTxt}>
                        {waveNumber === 1 && t('contacting_providers')}
                        {waveNumber === 2 && t('expanding_search')}
                        {waveNumber === 3 && t('priority_matching')}
                    </Text>
                </FadeInView>
            </View>

            <View style={styles.bottomArea}>
                {!canMinimize ? (
                    <FadeInView delay={800} style={styles.minimizeInfo}>
                        <Text style={styles.minimizeTxt}>{t('minimize_info').replace('%{seconds}', countdown)}</Text>
                    </FadeInView>
                ) : (
                    <FadeInView delay={100}>
                        <PressableAnimated
                            onPress={() => navigation.replace('CustomerTabs')}
                            style={styles.minimizeBtn}
                        >
                            <Text style={styles.minimizeBtnTxt}>{t('continue_background')}</Text>
                        </PressableAnimated>
                    </FadeInView>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    searchingHeader: { alignItems: 'center', marginBottom: spacing.xxl },
    searchingTitle: {
        color: colors.text.primary,
        fontSize: fontSize.title,
        fontWeight: fontWeight.bold,
        textAlign: 'center',
        letterSpacing: tracking.title
    },
    searchingSub: {
        color: colors.text.secondary,
        fontSize: fontSize.body,
        textAlign: 'center',
        marginTop: 8,
        letterSpacing: tracking.body
    },

    radarWrapper: {
        width: 280,
        height: 280,
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: spacing.xl
    },
    pulseLabel: {
        position: 'absolute',
        bottom: -20,
        backgroundColor: colors.surface,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.accent.border,
        ...shadows.premium
    },
    waveTxt: {
        color: colors.accent.primary,
        fontSize: 10,
        fontWeight: fontWeight.bold,
        letterSpacing: 2
    },

    statusBox: { marginTop: spacing.xxl, minHeight: 40 },
    statusTxt: {
        color: colors.text.muted,
        fontSize: fontSize.caption,
        fontWeight: fontWeight.medium,
        fontStyle: 'italic',
        letterSpacing: tracking.caption
    },

    bottomArea: { position: 'absolute', bottom: 60, left: 24, right: 24, alignItems: 'center' },
    minimizeInfo: {
        backgroundColor: colors.surface,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: radius.full,
        ...shadows.premium
    },
    minimizeTxt: { color: colors.text.muted, fontSize: fontSize.micro, fontWeight: fontWeight.medium },
    minimizeBtn: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: radius.full,
        backgroundColor: colors.elevated,
        borderWidth: 1,
        borderColor: colors.accent.border
    },
    minimizeBtnTxt: {
        color: colors.accent.primary,
        fontSize: fontSize.caption,
        fontWeight: fontWeight.bold,
        letterSpacing: 1
    },

    errorContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg },
    errorIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.elevated,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.premium
    },
    errorIcon: { fontSize: 32 },
    errorTitle: { color: colors.text.primary, fontSize: fontSize.title, fontWeight: fontWeight.bold, letterSpacing: tracking.title },
    errorSub: {
        color: colors.text.secondary,
        fontSize: fontSize.body,
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md,
        letterSpacing: tracking.body
    }
});
