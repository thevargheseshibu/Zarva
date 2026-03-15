/**
 * src/components/PremiumButton.jsx
 * Advanced Animated Button with scale-down interaction and glow effects.
 */

import React from 'react';
import { useTokens } from '../design-system';
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
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
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
                variant === 'primary' && !isDisabled && tTheme.shadows.accentGlow,
                animatedStyle,
                style,
            ]}
        >
            {variant === 'primary' && !isDisabled ? (
                <LinearGradient
                    colors={[tTheme.brand.primary, tTheme.brand.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                />
            ) : variant === 'primary' ? (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: tTheme.brand.primary }]} />
            ) : null}

            {loading ? (
                <ActivityIndicator color={variant === 'primary' ? tTheme.text.primary : tTheme.brand.primary} size="small" />
            ) : (
                <Text style={[styles.baseLabel, vStyles.label, textStyle]}>{title}</Text>
            )}
        </AnimatedPressable>
    );
}

const createStyles = (t) => StyleSheet.create({
    baseButton: {
        height: 56,
        width: '100%',
        borderRadius: t.radius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: t.spacing['2xl'],
    },
    baseLabel: {
        fontSize: t.typography.size.body,
        fontWeight: t.typography.weight.bold,
        letterSpacing: t.typography.tracking.body,
    },
    primaryButton: {
        overflow: 'hidden',
    },
    primaryLabel: {
        color: t.text.primary,
        textShadowColor: 'rgba(0,0,0,0.2)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    ghostButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: t.brand.primary,
    },
    ghostLabel: {
        color: t.brand.primary,
    },
    dangerButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: t.status.error.base,
    },
    dangerLabel: {
        color: t.status.error.base,
    },
    disabled: {
        opacity: 0.4,
    },
});
