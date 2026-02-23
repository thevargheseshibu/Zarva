/**
 * src/components/PremiumButton.jsx
 * Advanced Animated Button with scale-down interaction and glow effects.
 */

import React from 'react';
import {
    Text,
    ActivityIndicator,
    StyleSheet,
    Pressable,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, radius, spacing, shadows } from '../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../design-system/typography';
import { durations, springs } from '../design-system/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function PremiumButton({
    onPress,
    title,
    variant = 'primary', // 'primary', 'ghost', 'danger'
    loading = false,
    disabled = false,
    style,
    textStyle,
    haptic = Haptics.ImpactFeedbackStyle.Light,
}) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: withTiming(scale.value < 1 ? 0.92 : 1, { duration: 120 }),
    }));

    const onPressIn = () => {
        scale.value = withTiming(0.965, { duration: 120 });
        if (haptic) Haptics.impactAsync(haptic);
    };

    const onPressOut = () => {
        scale.value = withSpring(1, springs.press);
    };

    const getVariantStyles = () => {
        switch (variant) {
            case 'ghost':
                return {
                    button: styles.ghostButton,
                    label: styles.ghostLabel,
                };
            case 'danger':
                return {
                    button: styles.dangerButton,
                    label: styles.dangerLabel,
                };
            default:
                return {
                    button: styles.primaryButton,
                    label: styles.primaryLabel,
                };
        }
    };

    const vStyles = getVariantStyles();
    const isDisabled = disabled || loading;

    return (
        <AnimatedPressable
            onPress={onPress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            disabled={isDisabled}
            style={[
                styles.baseButton,
                vStyles.button,
                variant === 'primary' && !isDisabled && shadows.accentGlow,
                isDisabled && styles.disabled,
                animatedStyle,
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator color={variant === 'primary' ? colors.background : colors.accent.primary} size="small" />
            ) : (
                <Text style={[styles.baseLabel, vStyles.label, textStyle]}>{title}</Text>
            )}
        </AnimatedPressable>
    );
}

const styles = StyleSheet.create({
    baseButton: {
        height: 56,
        width: '100%',
        borderRadius: radius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing[24],
    },
    baseLabel: {
        fontSize: fontSize.body,
        fontWeight: fontWeight.bold,
        letterSpacing: tracking.body,
    },
    primaryButton: {
        backgroundColor: colors.accent.primary,
    },
    primaryLabel: {
        color: colors.background,
    },
    ghostButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.accent.primary,
    },
    ghostLabel: {
        color: colors.accent.primary,
    },
    dangerButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.danger,
    },
    dangerLabel: {
        color: colors.danger,
    },
    disabled: {
        opacity: 0.4,
    },
});
