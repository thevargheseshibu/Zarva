/**
 * src/components/RadarAnimation.jsx
 * Reanimated2 concentric rings that expand and fade — gold pulse radar effect.
 */
import React, { useEffect } from 'react';
import { useTokens } from '../design-system';
import { View, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withRepeat,
    withDelay,
    Easing,
} from 'react-native-reanimated';


const RING_COUNT = 3;
const MAX_SCALE = 3.2;
const DURATION_MS = 2200;

function Ring({ delay, styles }) {
    const scale = useSharedValue(0.4);
    const opacity = useSharedValue(0.7);

    useEffect(() => {
        scale.value = withDelay(
            delay,
            withRepeat(
                withTiming(MAX_SCALE, { duration: DURATION_MS, easing: Easing.out(Easing.quad) }),
                -1,
                false
            )
        );
        opacity.value = withDelay(
            delay,
            withRepeat(
                withTiming(0, { duration: DURATION_MS, easing: Easing.out(Easing.quad) }),
                -1,
                false
            )
        );
    }, []);

    const animStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    return <Animated.View style={[styles.ring, animStyle]} />;
}

export default function RadarAnimation({ size = 64, style }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    return (
        <View style={[styles.container, { width: size, height: size }, style]}>
            {Array.from({ length: RING_COUNT }).map((_, i) => (
                <Ring key={i} delay={i * (DURATION_MS / RING_COUNT)} styles={styles} />
            ))}
            {/* Core dot */}
            <View style={[styles.core, { width: size * 0.28, height: size * 0.28 }]} />
        </View>
    );
}

const createStyles = (t) => StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    ring: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 9999,
        borderWidth: 1,
        borderColor: t.brand.primary,
    },
    core: {
        borderRadius: 9999,
        backgroundColor: t.brand.primary,
        shadowColor: t.brand.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 5,
    },
});
