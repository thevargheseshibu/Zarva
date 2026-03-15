/**
 * ZarvaSplash.jsx — Ultra Premium Edition
 *
 * Design language: Obsidian luxury. Deep void base with a living aurora mesh —
 * violet-to-rose-to-cyan chromatic gradient. Think Apple Vision Pro onboarding ×
 * Stripe's brand moments × Figma's loading screen.
 *
 * Animation choreography (≈ 3.2s):
 *   0 ms    Phase 1 — Pure void breathes open
 *   250 ms  Phase 2 — Aurora mesh blooms: three radial gradients stagger in
 *   700 ms  Phase 3 — Z mark crystallises from origin, rotation snaps to rest
 *   1100 ms Phase 4 — "ZARVA" rises in chromatic stagger, each letter its own hue step
 *   1800 ms Phase 5 — Gradient hairline rule sweeps across; tagline resolves
 *   2200 ms Phase 6 — Hold 600ms; screen pulls up with a parallax exit
 */

import React, { useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, Animated,
    Dimensions, Easing, StatusBar, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const C = {
    void: '#030108',
    base: '#06020F',
    deep: '#090516',
    violet: '#7C3AED',
    rose: '#EC4899',
    cyan: '#06B6D4',
    offWhite: '#F1F0FF',
    silver: '#A1A1C7',
    dim: '#4A4A6A',
    letterHues: ['#B8A4FF', '#D8A4FF', '#F0A4D8', '#F4A4B8', '#F4C4A8'],
};

const LETTERS = ['Z', 'A', 'R', 'V', 'A'];

export default function ZarvaSplash({ onDone }) {
    const rootOpacity = useRef(new Animated.Value(0)).current;
    const aurora1Opacity = useRef(new Animated.Value(0)).current;
    const aurora1Scale = useRef(new Animated.Value(0.4)).current;
    const aurora2Opacity = useRef(new Animated.Value(0)).current;
    const aurora2Scale = useRef(new Animated.Value(0.3)).current;
    const aurora3Opacity = useRef(new Animated.Value(0)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const logoScale = useRef(new Animated.Value(0.42)).current;
    const logoRotate = useRef(new Animated.Value(-8)).current;
    const ringGlow = useRef(new Animated.Value(0)).current;
    const lettersAnims = useRef(
        LETTERS.map(() => ({
            opacity: new Animated.Value(0),
            y: new Animated.Value(28),
            scale: new Animated.Value(0.8),
        }))
    ).current;
    const ruleWidth = useRef(new Animated.Value(0)).current;
    const taglineOp = useRef(new Animated.Value(0)).current;
    const exitOpacity = useRef(new Animated.Value(1)).current;
    const exitTranslate = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const expo = Easing.out(Easing.exp);
        const cubic = Easing.out(Easing.cubic);
        const easeIn = Easing.in(Easing.ease);

        const tween = (ref, val, dur = 500, delay = 0, ease = expo) =>
            Animated.timing(ref, { toValue: val, duration: dur, delay, easing: ease, useNativeDriver: true });
        const tweenL = (ref, val, dur = 600, delay = 0) =>
            Animated.timing(ref, { toValue: val, duration: dur, delay, easing: expo, useNativeDriver: false });
        const spring = (ref, val, t = 80, f = 10, delay = 0) =>
            Animated.spring(ref, { toValue: val, tension: t, friction: f, delay, useNativeDriver: true });

        Animated.sequence([
            tween(rootOpacity, 1, 700),
            Animated.parallel([
                tween(aurora1Opacity, 1, 900),
                spring(aurora1Scale, 1, 45, 14),
                tween(aurora2Opacity, 0.85, 900, 150),
                spring(aurora2Scale, 1, 40, 16, 150),
                tween(aurora3Opacity, 0.6, 900, 350),
            ]),
            Animated.parallel([
                spring(logoScale, 1, 110, 9),
                tween(logoOpacity, 1, 380),
                spring(logoRotate, 0, 120, 10),
                tween(ringGlow, 1, 600, 100),
            ]),
            Animated.stagger(
                75,
                lettersAnims.map((a) =>
                    Animated.parallel([
                        tween(a.opacity, 1, 350, 0, cubic),
                        spring(a.y, 0, 140, 10),
                        spring(a.scale, 1, 100, 10),
                    ])
                )
            ),
            Animated.parallel([
                tweenL(ruleWidth, 1, 600),
                tween(taglineOp, 1, 450, 220),
            ]),
            Animated.delay(700),
            Animated.parallel([
                tween(exitOpacity, 0, 500, 0, easeIn),
                tween(exitTranslate, -height * 0.06, 500, 0, easeIn),
            ]),
        ]).start(() => onDone?.());
    }, []);

    const logoRotateDeg = logoRotate.interpolate({ inputRange: [-8, 0], outputRange: ['-8deg', '0deg'] });
    const ruleW = ruleWidth.interpolate({ inputRange: [0, 1], outputRange: [0, width * 0.62] });

    return (
        <Animated.View style={[styles.root, {
            opacity: exitOpacity,
            transform: [{ translateY: exitTranslate }],
        }]}>
            <StatusBar backgroundColor={C.void} barStyle="light-content" translucent />

            {/* Void base */}
            <View style={StyleSheet.absoluteFill}>
                <LinearGradient
                    colors={[C.void, C.base, C.deep, C.void]}
                    locations={[0, 0.25, 0.7, 1]}
                    style={StyleSheet.absoluteFill}
                />
            </View>

            <Animated.View style={[StyleSheet.absoluteFill, { opacity: rootOpacity }]}>

                {/* ── AURORA MESH (absolute, behind content) ── */}
                <Animated.View style={[styles.aurora1, {
                    opacity: aurora1Opacity,
                    transform: [{ scale: aurora1Scale }],
                }]}>
                    <LinearGradient
                        colors={['rgba(124,58,237,0.45)', 'rgba(139,92,246,0.22)', 'transparent']}
                        style={{ width: 560, height: 560, borderRadius: 280 }}
                    />
                </Animated.View>

                <Animated.View style={[styles.aurora2, {
                    opacity: aurora2Opacity,
                    transform: [{ scale: aurora2Scale }],
                }]}>
                    <LinearGradient
                        colors={['rgba(236,72,153,0.28)', 'rgba(244,114,182,0.12)', 'transparent']}
                        style={{ width: 420, height: 420, borderRadius: 210 }}
                    />
                </Animated.View>

                <Animated.View style={[styles.aurora3, { opacity: aurora3Opacity }]}>
                    <LinearGradient
                        colors={['rgba(6,182,212,0.18)', 'transparent']}
                        style={{ width: 340, height: 340, borderRadius: 170 }}
                    />
                </Animated.View>

                {/* ── PERFECTLY CENTERED COLUMN ── */}
                <View style={styles.centerColumn}>

                    {/* Z mark */}
                    <Animated.View style={[styles.logoWrap, {
                        opacity: logoOpacity,
                        transform: [{ scale: logoScale }, { rotate: logoRotateDeg }],
                    }]}>
                        <Animated.View style={[styles.haloRing, {
                            opacity: ringGlow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.7] }),
                            transform: [{ scale: ringGlow.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] }) }],
                        }]}>
                            <LinearGradient
                                colors={['rgba(124,58,237,0.55)', 'rgba(236,72,153,0.4)', 'rgba(6,182,212,0.25)', 'transparent']}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                style={{ width: 160, height: 160, borderRadius: 38 }}
                            />
                        </Animated.View>

                        <LinearGradient
                            colors={['rgba(139,92,246,0.9)', 'rgba(236,72,153,0.65)', 'rgba(6,182,212,0.4)', 'rgba(139,92,246,0.2)']}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            style={styles.outerRing}
                        >
                            <LinearGradient
                                colors={['rgba(124,58,237,0.22)', 'rgba(236,72,153,0.12)', 'rgba(6,182,212,0.08)']}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                style={styles.innerRing}
                            >
                                <LinearGradient
                                    colors={['#150928', '#0D051E', '#06020F']}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                    style={styles.coreDisc}
                                >
                                    <Text style={styles.logoZ}>Z</Text>
                                </LinearGradient>
                            </LinearGradient>
                        </LinearGradient>

                        <View style={styles.castShadow} />
                    </Animated.View>

                    {/* Wordmark block */}
                    <View style={styles.wordmarkBlock}>
                        <View style={styles.wordmarkRow}>
                            {LETTERS.map((letter, i) => (
                                <Animated.Text
                                    key={i}
                                    style={[
                                        styles.wordLetter,
                                        { color: C.letterHues[i] },
                                        {
                                            opacity: lettersAnims[i].opacity,
                                            transform: [
                                                { translateY: lettersAnims[i].y },
                                                { scale: lettersAnims[i].scale },
                                            ],
                                        },
                                    ]}
                                >
                                    {letter}
                                </Animated.Text>
                            ))}
                        </View>

                        <Animated.View style={[styles.ruleWrap, { width: ruleW }]}>
                            <LinearGradient
                                colors={[C.violet, C.rose, C.cyan, 'transparent']}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                style={styles.rule}
                            />
                        </Animated.View>

                        <Animated.Text style={[styles.tagline, { opacity: taglineOp }]}>
                            YOUR WORLD · ON DEMAND
                        </Animated.Text>
                    </View>

                </View>

                {/* Bottom imprint */}
                <Animated.Text style={[styles.bottomCap, { opacity: taglineOp }]}>
                    ZARVA © 2025
                </Animated.Text>

            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    root: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: C.void,
        zIndex: 99999,
    },

    // Aurora — absolute, behind everything
    aurora1: {
        position: 'absolute',
        top: height * 0.06,
        left: width * 0.5 - 280,
    },
    aurora2: {
        position: 'absolute',
        top: height * 0.10,
        right: -100,
    },
    aurora3: {
        position: 'absolute',
        bottom: -60,
        left: -80,
    },

    // Single centered flex column — logo sits above wordmark
    centerColumn: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 44,
    },

    // Logo mark
    logoWrap: {
        width: 120,
        height: 120,
        alignItems: 'center',
        justifyContent: 'center',
    },
    haloRing: {
        position: 'absolute',
        width: 160,
        height: 160,
        borderRadius: 38,
        top: -20,
        left: -20,
    },
    outerRing: {
        width: 120,
        height: 120,
        borderRadius: 30,
        padding: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            ios: {
                shadowColor: C.violet,
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.7,
                shadowRadius: 24,
            },
        }),
        elevation: 20,
    },
    innerRing: {
        width: '100%',
        height: '100%',
        borderRadius: 28.5,
        padding: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    coreDisc: {
        width: '100%',
        height: '100%',
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoZ: {
        fontSize: 54,
        fontWeight: '900',
        color: C.offWhite,
        letterSpacing: -2.5,
        includeFontPadding: false,
        textShadowColor: 'rgba(139,92,246,0.9)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 18,
    },
    castShadow: {
        position: 'absolute',
        bottom: -18,
        width: 72,
        height: 22,
        borderRadius: 36,
        backgroundColor: 'rgba(124,58,237,0.30)',
        ...Platform.select({
            ios: {
                shadowColor: C.violet,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: 24,
            },
        }),
    },

    // Wordmark
    wordmarkBlock: {
        alignItems: 'center',
    },
    wordmarkRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 12,
    },
    wordLetter: {
        fontSize: 58,
        fontWeight: '900',
        letterSpacing: 1,
        includeFontPadding: false,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 12,
    },
    ruleWrap: {
        height: 1.5,
        overflow: 'hidden',
        marginBottom: 16,
    },
    rule: {
        flex: 1,
        height: 1.5,
        opacity: 0.9,
    },
    tagline: {
        fontSize: 10.5,
        color: C.silver,
        letterSpacing: 4,
        fontWeight: '600',
        textTransform: 'uppercase',
    },

    // Bottom imprint
    bottomCap: {
        position: 'absolute',
        bottom: 34,
        alignSelf: 'center',
        fontSize: 9,
        letterSpacing: 3,
        color: C.dim,
        textTransform: 'uppercase',
        fontWeight: '700',
    },
});