import React, { useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
    useSharedValue,
    withRepeat,
    withTiming,
    useAnimatedStyle,
    Easing,
} from 'react-native-reanimated';
import { colors, radius, spacing } from '../tokens';

export default function SkeletonCard({ width, height = 120, style }) {
    const { width: screenWidth } = useWindowDimensions();
    const cardWidth = width || screenWidth - spacing.lg * 2;

    const translateX = useSharedValue(-cardWidth);

    useEffect(() => {
        translateX.value = withRepeat(
            withTiming(cardWidth, {
                duration: 1500,
                easing: Easing.inOut(Easing.ease),
            }),
            -1,
            false
        );
    }, [cardWidth]);

    const rStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    return (
        <View style={[styles.container, { width: cardWidth, height }, style]}>
            <Animated.View style={[styles.shimmer, rStyle]} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        overflow: 'hidden',
    },
    shimmer: {
        ...StyleSheet.absoluteFillObject,
        width: '50%',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        transform: [{ skewX: '-20deg' }],
    },
});
