import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { springs } from '../motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function PressableAnimated({
    children,
    onPress,
    style,
    scaleTo = 0.965,
    haptic = Haptics.ImpactFeedbackStyle.Light,
    disabled = false,
    ...props
}) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: withTiming(scale.value < 1 ? 0.92 : 1, { duration: 120 }),
    }));

    const handlePressIn = () => {
        if (disabled) return;
        scale.value = withTiming(scaleTo, { duration: 120 });
        if (haptic) Haptics.impactAsync(haptic);
    };

    const handlePressOut = () => {
        if (disabled) return;
        scale.value = withSpring(1, springs.press);
    };

    return (
        <AnimatedPressable
            {...props}
            disabled={disabled}
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={[style, animatedStyle]}
        >
            {children}
        </AnimatedPressable>
    );
}
