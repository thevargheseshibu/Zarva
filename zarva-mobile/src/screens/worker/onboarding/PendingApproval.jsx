/**
 * src/screens/worker/onboarding/PendingApproval.jsx
 * Shown after Agreement submission — Reanimated2 checkmark animation, 24hr message.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withDelay,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { colors, spacing, radius } from '../../../design-system/tokens';
import GoldButton from '../../../components/GoldButton';
import { useAuthStore } from '../../../stores/authStore';

export default function PendingApproval() {
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);
    const { logout } = useAuthStore();

    useEffect(() => {
        scale.value = withDelay(300, withSpring(1, { damping: 10, stiffness: 180 }));
        opacity.value = withDelay(200, withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) }));
    }, []);

    const circleStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    const textStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: (1 - opacity.value) * 20 }],
    }));

    return (
        <View style={styles.screen}>
            <Animated.View style={[styles.circle, circleStyle]}>
                <Text style={styles.checkmark}>✓</Text>
            </Animated.View>

            <Animated.View style={[styles.textGroup, textStyle]}>
                <Text style={styles.title}>Application Submitted!</Text>
                <Text style={styles.sub}>
                    Our team reviews all applications within{'\n'}
                    <Text style={styles.highlight}>24 hours</Text>.{'\n\n'}
                    We'll notify you via SMS and the app once you're approved.
                </Text>
            </Animated.View>

            <View style={styles.steps}>
                {['✅ Profile submitted', '⏳ Under review (24 hrs)', '🔔 Approval notification'].map((s, i) => (
                    <Text key={i} style={styles.step}>{s}</Text>
                ))}
            </View>

            <GoldButton title="Back to Login" onPress={logout} style={{ marginTop: spacing.xl }} />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1, backgroundColor: colors.bg.primary,
        justifyContent: 'center', alignItems: 'center',
        paddingHorizontal: spacing.xl, gap: spacing.xl,
    },
    circle: {
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: colors.success + '22',
        borderWidth: 3, borderColor: colors.success,
        justifyContent: 'center', alignItems: 'center',
    },
    checkmark: { color: colors.success, fontSize: 48, fontWeight: '700' },
    textGroup: { alignItems: 'center', gap: spacing.sm },
    title: { color: colors.text.primary, fontSize: 26, fontWeight: '800', textAlign: 'center' },
    sub: {
        color: colors.text.secondary, fontSize: 15,
        lineHeight: 24, textAlign: 'center',
    },
    highlight: { color: colors.gold.primary, fontWeight: '700' },
    steps: { gap: spacing.sm, alignSelf: 'stretch' },
    step: {
        color: colors.text.secondary, fontSize: 14,
        backgroundColor: colors.bg.elevated, borderRadius: radius.md,
        padding: spacing.md,
    },
});
