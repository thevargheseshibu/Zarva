import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, BackHandler } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, shadows } from '../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../design-system/typography';
import OnboardingBasicInfo from './onboarding/OnboardingBasicInfo';
import OnboardingSkills from './onboarding/OnboardingSkills';
import OnboardingPayment from './onboarding/OnboardingPayment';
import OnboardingDocuments from './onboarding/OnboardingDocuments';
import OnboardingAgreement from './onboarding/OnboardingAgreement';
import PendingApproval from './onboarding/PendingApproval';

const STEPS = 5;
const SCREEN_MAP = [
    OnboardingBasicInfo,
    OnboardingSkills,
    OnboardingPayment,
    OnboardingDocuments,
    OnboardingAgreement,
];

export default function OnboardingWelcome() {
    const [step, setStep] = useState(0);
    const [data, setData] = useState({});
    const [done, setDone] = useState(false);

    const navigation = useNavigation();

    const blockBackAndGoHome = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.replace('WorkerStack', { screen: 'WorkerHome' });
        return true;
    }, [navigation]);

    useFocusEffect(
        useCallback(() => {
            const subscription = BackHandler.addEventListener('hardwareBackPress', blockBackAndGoHome);
            return () => subscription.remove();
        }, [blockBackAndGoHome])
    );

    if (done) return <PendingApproval />;

    const CurrentScreen = SCREEN_MAP[step];
    const progress = (step + 1) / STEPS;

    const goNext = (stepData = {}) => {
        setData(d => ({ ...d, ...stepData }));
        if (step >= STEPS - 1) { setDone(true); return; }
        setStep(s => s + 1);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const goBack = () => {
        if (step === 0) {
            blockBackAndGoHome();
        } else {
            setStep(s => s - 1);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    return (
        <View style={styles.screen}>
            {/* Progress Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={goBack} style={styles.backBtn}>
                    <Text style={styles.backArrow}>←</Text>
                </TouchableOpacity>

                <View style={styles.progressContainer}>
                    <View style={styles.track}>
                        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
                        <View style={[styles.glow, { left: `${progress * 100}%` }]} />
                    </View>
                </View>

                <View style={styles.stepInfo}>
                    <Text style={styles.stepCount}>{step + 1}</Text>
                    <Text style={styles.stepTotal}>/ {STEPS}</Text>
                </View>
            </View>

            <CurrentScreen data={data} onNext={goNext} />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing[24],
        paddingTop: 60,
        paddingBottom: 20,
        gap: 16
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.accent.border + '11'
    },
    backArrow: { color: colors.text.primary, fontSize: 20 },

    progressContainer: { flex: 1, height: 6, backgroundColor: colors.surface, borderRadius: 3, overflow: 'hidden', position: 'relative' },
    track: { flex: 1, backgroundColor: colors.surface },
    fill: { height: '100%', backgroundColor: colors.accent.primary, borderRadius: 3 },
    glow: {
        position: 'absolute',
        top: 0,
        width: 20,
        height: '100%',
        backgroundColor: colors.accent.primary,
        opacity: 0.5,
        transform: [{ translateX: -10 }]
    },

    stepInfo: { flexDirection: 'row', alignItems: 'baseline' },
    stepCount: { color: colors.text.primary, fontSize: 16, fontWeight: '900' },
    stepTotal: { color: colors.text.muted, fontSize: 10, fontWeight: fontWeight.bold, marginLeft: 4 }
});
