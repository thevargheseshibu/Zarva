import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTokens } from '@shared/design-system';
import { View, Text, StyleSheet, BackHandler, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useT } from '@shared/i18n/useTranslation';
import { useJobStore } from '@jobs/store';
import apiClient from '@infra/api/client';
import FadeInView from '@shared/ui/FadeInView';
import PremiumButton from '@shared/ui/PremiumButton';
import RadarAnimation from '@shared/ui/RadarAnimation';
import PressableAnimated from '@shared/design-system/components/PressableAnimated';



export default function SearchingScreen({ route, navigation }) {
    const tTheme = useTokens();
    const styles = useMemo(() => createStyles(tTheme), [tTheme]);
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
        if (searchPhase === 'assigned' && jobId) {
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

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.app, padding: t.spacing.lg },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    searchingHeader: { alignItems: 'center', marginBottom: t.spacing.xxl },
    searchingTitle: {
        color: t.text.primary,
        fontSize: t.typography.size.title,
        fontWeight: t.typography.weight.bold,
        textAlign: 'center',
        letterSpacing: t.typography.tracking.title
    },
    searchingSub: {
        color: t.text.secondary,
        fontSize: t.typography.size.body,
        textAlign: 'center',
        marginTop: 8,
        letterSpacing: t.typography.tracking.body
    },

    radarWrapper: {
        width: 280,
        height: 280,
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: t.spacing.xl
    },
    pulseLabel: {
        position: 'absolute',
        bottom: -20,
        backgroundColor: t.background.surface,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: t.radius.full,
        borderWidth: 1,
        borderColor: t.border.default,
        ...t.shadows.premium
    },
    waveTxt: {
        color: t.brand.primary,
        fontSize: 10,
        fontWeight: t.typography.weight.bold,
        letterSpacing: 2
    },

    statusBox: { marginTop: t.spacing.xxl, minHeight: 40 },
    statusTxt: {
        color: t.text.tertiary,
        fontSize: t.typography.size.caption,
        fontWeight: t.typography.weight.medium,
        fontStyle: 'italic',
        letterSpacing: t.typography.tracking.caption
    },

    bottomArea: { position: 'absolute', bottom: 60, left: 24, right: 24, alignItems: 'center' },
    minimizeInfo: {
        backgroundColor: t.background.surface,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: t.radius.full,
        ...t.shadows.premium
    },
    minimizeTxt: { color: t.text.tertiary, fontSize: t.typography.size.micro, fontWeight: t.typography.weight.medium },
    minimizeBtn: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: t.radius.full,
        backgroundColor: t.background.surfaceRaised,
        borderWidth: 1,
        borderColor: t.border.default
    },
    minimizeBtnTxt: {
        color: t.brand.primary,
        fontSize: t.typography.size.caption,
        fontWeight: t.typography.weight.bold,
        letterSpacing: 1
    },

    errorContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: t.spacing.lg },
    errorIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: t.background.surfaceRaised,
        justifyContent: 'center',
        alignItems: 'center',
        ...t.shadows.premium
    },
    errorIcon: { fontSize: 32 },
    errorTitle: { color: t.text.primary, fontSize: t.typography.size.title, fontWeight: t.typography.weight.bold, letterSpacing: t.typography.tracking.title },
    errorSub: {
        color: t.text.secondary,
        fontSize: t.typography.size.body,
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: t.spacing.lg,
        marginBottom: t.spacing.md,
        letterSpacing: t.typography.tracking.body
    }
});
