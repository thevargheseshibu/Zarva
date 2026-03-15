/**
 * src/components/FadeInView.jsx
 * Entrance animation for list items, cards, and page elements.
 */

import React, { useEffect } from 'react';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withDelay,
    withTiming
} from 'react-native-reanimated';
import { timingConfig } from '@shared/design-system/motion';

export default function FadeInView({ children, delay = 0, style }) {
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(12);

    useEffect(() => {
        opacity.value = withDelay(delay, withTiming(1, timingConfig.screen));
        translateY.value = withDelay(delay, withTiming(0, timingConfig.screen));
    }, [delay]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }],
    }));

    return (
        <Animated.View style={[animatedStyle, style]}>
            {children}
        </Animated.View>
    );
}
