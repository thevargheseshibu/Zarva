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
            Alert.alert('Cancel Request?', 'Changing your mind? This will cancel your service request.', [
                { text: 'Keep Waiting', style: 'cancel' },
                {
                    text: 'Cancel Request', style: 'destructive',
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
                    <Text style={styles.errorTitle}>No Workers Nearby</Text>
                    <Text style={styles.errorSub}>
                        We couldn't find an available {t(`cat_${category}`) || category} in your area right now.
                        Try adjusting your location or checking back in a few minutes.
                    </Text>
                    <PremiumButton title="Return Home" onPress={handleGoHome} />
                </FadeInView>
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <View style={styles.content}>
                <FadeInView delay={200} style={styles.searchingHeader}>
                    <Text style={styles.searchingTitle}>Searching for {t(`cat_${category}`) || category}</Text>
                    <Text style={styles.searchingSub}>Optimizing provider matching for your location</Text>
                </FadeInView>

                <View style={styles.radarWrapper}>
                    <RadarAnimation size={240} />
                    <View style={styles.pulseLabel}>
                        <Text style={styles.waveTxt}>WAVE {waveNumber}/3</Text>
                    </View>
                </View>

                <FadeInView delay={400} style={styles.statusBox}>
                    <Text style={styles.statusTxt}>
                        {waveNumber === 1 && "Contacting nearest providers..."}
                        {waveNumber === 2 && "Expanding search radius..."}
                        {waveNumber === 3 && "Requesting priority matching..."}
                    </Text>
                </FadeInView>
            </View>

            <View style={styles.bottomArea}>
                {!canMinimize ? (
                    <FadeInView delay={800} style={styles.minimizeInfo}>
                        <Text style={styles.minimizeTxt}>You can minimize in {countdown}s</Text>
                    </FadeInView>
                ) : (
                    <FadeInView delay={100}>
                        <PressableAnimated
                            onPress={() => navigation.replace('CustomerTabs')}
                            style={styles.minimizeBtn}
                        >
                            <Text style={styles.minimizeBtnTxt}>Continue in Background</Text>
                        </PressableAnimated>
                    </FadeInView>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, padding: spacing[24] },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    searchingHeader: { alignItems: 'center', marginBottom: spacing[48] },
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
        marginVertical: spacing[32]
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

    statusBox: { marginTop: spacing[48], minHeight: 40 },
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

    errorContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing[24] },
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
        paddingHorizontal: spacing[16],
        marginBottom: spacing[16],
        letterSpacing: tracking.body
    }
});
