/**
 * src/screens/worker/OnboardingWelcome.jsx  →  renamed: this is now the router
 * Worker Onboarding — routes through 5-screen stack with progress bar.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, BackHandler } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { colors, spacing, radius } from '../../design-system/tokens';
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

    if (done) return <PendingApproval />;

    const CurrentScreen = SCREEN_MAP[step];
    const progress = (step + 1) / STEPS;

    const navigation = useNavigation();

    const goNext = (stepData = {}) => {
        setData(d => ({ ...d, ...stepData }));
        if (step >= STEPS - 1) { setDone(true); return; }
        setStep(s => s + 1);
    };

    const blockBackAndGoHome = useCallback(() => {
        // As per instructions: replace to WorkerNavigator home screen.
        // Even if onboarding isn't saved piece-meal, the instruction dictates this forced exit path.
        navigation.replace('WorkerStack', { screen: 'WorkerHome' });
        return true;
    }, [navigation]);

    useFocusEffect(
        useCallback(() => {
            BackHandler.addEventListener('hardwareBackPress', blockBackAndGoHome);
            return () => BackHandler.removeEventListener('hardwareBackPress', blockBackAndGoHome);
        }, [blockBackAndGoHome])
    );

    const goBack = () => blockBackAndGoHome();

    return (
        <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
            {/* Progress bar */}
            <View style={styles.progressBar}>
                {step > 0 && (
                    <TouchableOpacity onPress={goBack} style={styles.backBtn}>
                        <Text style={styles.backArrow}>←</Text>
                    </TouchableOpacity>
                )}
                <View style={styles.trackOuter}>
                    <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
                </View>
                <Text style={styles.stepLabel}>{step + 1}/{STEPS}</Text>
            </View>
            <CurrentScreen data={data} onNext={goNext} />
        </View>
    );
}

const styles = StyleSheet.create({
    progressBar: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        paddingHorizontal: spacing.lg, paddingTop: spacing.xl + 16, paddingBottom: spacing.md,
    },
    backBtn: { padding: 4 },
    backArrow: { color: colors.text.primary, fontSize: 20 },
    trackOuter: { flex: 1, height: 4, backgroundColor: colors.bg.surface, borderRadius: radius.full, overflow: 'hidden' },
    trackFill: { height: '100%', backgroundColor: colors.gold.primary, borderRadius: radius.full },
    stepLabel: { color: colors.text.muted, fontSize: 12 },
});
