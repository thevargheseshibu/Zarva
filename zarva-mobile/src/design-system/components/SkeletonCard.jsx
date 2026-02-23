import React, { useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import {
    Canvas,
    LinearGradient,
    Rect,
    useSharedValueEffect,
    useValue,
} from '@shopify/react-native-skia';
import {
    useSharedValue,
    withRepeat,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { colors, radius, spacing } from '../tokens';

export default function SkeletonCard({ width, height = 120, style }) {
    const { width: screenWidth } = useWindowDimensions();
    const cardWidth = width || screenWidth - spacing.lg * 2;

    const x = useSharedValue(0);

    useEffect(() => {
        x.value = withRepeat(
            withTiming(cardWidth + 200, {
                duration: 1500,
                easing: Easing.linear,
            }),
            -1,
            false
        );
    }, [cardWidth]);

    return (
        <View style={[styles.container, { width: cardWidth, height }, style]}>
            <Canvas style={{ flex: 1 }}>
                <Rect x={0} y={0} width={cardWidth} height={height} color={colors.elevated}>
                    <LinearGradient
                        start={{ x: 0, y: 0 }}
                        end={{ x: 200, y: 0 }}
                        colors={[
                            'transparent',
                            'rgba(255, 255, 255, 0.05)',
                            'transparent',
                        ]}
                        transform={[{ translateX: x.value - 100 }]}
                    />
                </Rect>
            </Canvas>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        overflow: 'hidden',
    },
});
