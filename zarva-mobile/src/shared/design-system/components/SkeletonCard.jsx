import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
    useSharedValue,
    withRepeat,
    withTiming,
    useAnimatedStyle,
    Easing,
} from 'react-native-reanimated';
import { useTokens } from '../useTheme';

export default function SkeletonCard({ width, height = 120, style }) {
    const t = useTokens();
    const styles = useMemo(() => createStyles(t), [t]);
    const { width: screenWidth } = useWindowDimensions();
    const cardWidth = width || screenWidth - t.spacing.lg * 2;

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

const createStyles = (t) => StyleSheet.create({
    container: {
        backgroundColor: t.background.surface,
        borderRadius: t.radius.lg,
        overflow: 'hidden',
    },
    shimmer: {
        ...StyleSheet.absoluteFillObject,
        width: '50%',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        transform: [{ skewX: '-20deg' }],
    },
});
