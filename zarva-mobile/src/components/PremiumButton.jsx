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
    View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
    const translateX = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
            { translateX: translateX.value }
        ],
        opacity: withTiming(scale.value < 1 ? 0.92 : 1, { duration: 120 }),
    }));

    const triggerShake = () => {
        translateX.value = withTiming(-10, { duration: 50 }, () => {
            translateX.value = withTiming(10, { duration: 50 }, () => {
                translateX.value = withTiming(-6, { duration: 50 }, () => {
                    translateX.value = withTiming(6, { duration: 50 }, () => {
                        translateX.value = withSpring(0);
                    });
                });
            });
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    };

    const handlePress = () => {
        if (loading) return;
        if (disabled) {
            triggerShake();
            return;
        }
        if (onPress) onPress();
    };

    const onPressIn = () => {
        if (isDisabled) return;
        scale.value = withTiming(0.965, { duration: 120 });
        if (haptic) Haptics.impactAsync(haptic);
    };

    const onPressOut = () => {
        if (isDisabled) return;
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
            onPress={handlePress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            style={[
                styles.baseButton,
                isDisabled && styles.disabled,
                variant === 'primary' && !isDisabled && shadows.accentGlow,
                animatedStyle,
                style,
            ]}
        >
            {variant === 'primary' && !isDisabled ? (
                <LinearGradient
                    colors={colors.accent.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                />
            ) : variant === 'primary' ? (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.accent.primary }]} />
            ) : null}

            {loading ? (
                <ActivityIndicator color={variant === 'primary' ? colors.text.primary : colors.accent.primary} size="small" />
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
        overflow: 'hidden',
    },
    primaryLabel: {
        color: '#FFFFFF',
        textShadowColor: 'rgba(0,0,0,0.2)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
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
