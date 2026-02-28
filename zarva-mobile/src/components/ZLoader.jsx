import React, { useEffect, useRef } from 'react';
import { useTokens } from '../design-system';
import { View, Text, Animated, Easing, StyleSheet, Modal, Dimensions } from 'react-native';


const { width, height } = Dimensions.get('window');

/**
 * ZLoader — Premium Branded Loader
 * Features:
 * - Dual rotating concentric rings
 * - Breathing/Pulsing "Z" symbol
 * - Full-screen blocking modal support
 */
export default function ZLoader({
    visible = true,
    fullScreen = false,
    message = "Processing...",
    size = 80,
    color = '#7C3AED' // Default Zarva Purple
}) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const spinAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Continuous Rotation
        Animated.loop(
            Animated.timing(spinAnim, {
                toValue: 1,
                duration: 2000,
                easing: Easing.bezier(0.4, 0, 0.2, 1),
                useNativeDriver: true,
            })
        ).start();

        // Continuous Pulse
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0,
                    duration: 1000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                })
            ])
        ).start();
    }, []);

    const spin = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const counterSpin = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['360deg', '0deg'],
    });

    const scale = pulseAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.9, 1.1],
    });

    const opacity = pulseAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.6, 1],
    });

    // Dynamic color shift between accent and a premium gold
    const animatedColor = pulseAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [color, '#FFD700'], // Shifts to Gold
    });

    const content = (
        <View style={fullScreen ? styles.fullScreenContainer : styles.inlineContainer}>
            <View style={[styles.loaderWrapper, { width: size * 1.5, height: size * 1.5 }]}>
                {/* Outer Glow Ring (Static Pulse) */}
                <Animated.View
                    style={[
                        styles.ring,
                        {
                            width: size * 1.2,
                            height: size * 1.2,
                            borderRadius: (size * 1.2) / 2,
                            borderWidth: 1,
                            borderColor: color + '15',
                            transform: [{ scale }],
                            opacity: 0.3
                        },
                    ]}
                />

                {/* Main Spinning Ring */}
                <Animated.View
                    style={[
                        styles.ring,
                        {
                            width: size,
                            height: size,
                            borderRadius: size / 2,
                            borderWidth: 3,
                            borderColor: 'transparent',
                            borderTopColor: animatedColor,
                            borderRightColor: animatedColor,
                            transform: [{ rotate: spin }],
                        },
                    ]}
                />

                {/* Inner Ring (Counter-Rotating Gold) */}
                <Animated.View
                    style={[
                        styles.ring,
                        {
                            width: size * 0.7,
                            height: size * 0.7,
                            borderRadius: (size * 0.7) / 2,
                            borderWidth: 2,
                            borderColor: 'transparent',
                            borderBottomColor: '#FFD700',
                            transform: [{ rotate: counterSpin }],
                        },
                    ]}
                />

                {/* Pulsing Z Symbol with Neon Glow */}
                <Animated.View style={[styles.zWrapper, { transform: [{ scale }] }]}>
                    <Animated.Text style={[
                        styles.zText,
                        {
                            fontSize: size * 0.5,
                            color: animatedColor,
                            textShadowColor: '#FFD700',
                            textShadowRadius: 15,
                            textShadowOffset: { width: 0, height: 0 }
                        }
                    ]}>
                        Z
                    </Animated.Text>
                </Animated.View>
            </View>

            {fullScreen && message && (
                <Animated.Text style={[styles.message, { opacity }]}>
                    {message}
                </Animated.Text>
            )}
        </View>
    );

    if (fullScreen) {
        if (!visible) return null;
        return (
            <View style={[StyleSheet.absoluteFill, styles.modalOverlay, { zIndex: 9999 }]}>
                {content}
            </View>
        );
    }

    return content;
}

const createStyles = (t) => StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(5, 5, 8, 0.92)', // Deep dark premium overlay
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullScreenContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        gap: 20
    },
    inlineContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loaderWrapper: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    ring: {
        position: 'absolute',
    },
    zWrapper: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    zText: {
        fontWeight: '900',
        textAlign: 'center',
    },
    message: {
        color: t.text.primary,
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    }
});
