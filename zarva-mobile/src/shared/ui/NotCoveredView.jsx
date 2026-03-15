import React, { useEffect } from 'react';
import { useTokens } from '../design-system';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence
} from 'react-native-reanimated';
import { useT } from '../hooks/useT';


import PremiumButton from './PremiumButton';

const { width } = Dimensions.get('window');

export default function NotCoveredView({ locationName, onRetry }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const floatAnim = useSharedValue(0);

    useEffect(() => {
        floatAnim.value = withRepeat(
            withSequence(
                withTiming(-15, { duration: 2500 }),
                withTiming(0, { duration: 2500 })
            ),
            -1,
            true
        );
    }, []);

    const animatedImageStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: floatAnim.value }],
    }));

    return (
        <View style={styles.container}>
            <Animated.View
                entering={FadeIn.duration(1000)}
                style={[styles.imageContainer, animatedImageStyle]}
            >
                <View style={styles.glowCircle} />
                <Image
                    source={require('../../assets/not_covered_premium.png')}
                    style={styles.graphic}
                    resizeMode="contain"
                />
            </Animated.View>

            <View style={styles.textWrapper}>
                <Animated.View entering={FadeInDown.delay(300).duration(800)}>
                    <Text style={styles.title}>{t('not_available_yet')}</Text>
                    <Text style={styles.description}>
                        {t('not_available_desc', { location: locationName })}
                    </Text>
                </Animated.View>

                <Animated.View
                    entering={FadeInDown.delay(600).duration(800)}
                    style={styles.actionSection}
                >
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{t('expanding_rapidly')}</Text>
                    </View>

                    <PremiumButton
                        title={t('try_another_location')}
                        onPress={onRetry}
                        style={styles.button}
                    />
                </Animated.View>
            </View>
        </View>
    );
}

const createStyles = (t) => StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        padding: t.spacing['2xl'],
        backgroundColor: t.background.app,
    },
    imageContainer: {
        width: width * 0.8,
        height: 300,
        marginTop: t.spacing[40],
        marginBottom: t.spacing['2xl'],
        alignItems: 'center',
        justifyContent: 'center',
    },
    glowCircle: {
        position: 'absolute',
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: t.brand.glow,
        opacity: 0.4,
    },
    graphic: {
        width: '100%',
        height: '100%',
    },
    textWrapper: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
    },
    title: {
        color: t.text.primary,
        fontSize: t.typography.size.hero,
        fontWeight: t.typography.weight.bold,
        letterSpacing: t.typography.tracking.hero,
        textAlign: 'center',
        marginBottom: t.spacing.lg,
    },
    description: {
        color: t.text.secondary,
        fontSize: t.typography.size.body,
        lineHeight: 26,
        textAlign: 'center',
        paddingHorizontal: t.spacing.md,
        marginBottom: t.spacing[48],
    },
    actionSection: {
        width: '100%',
        alignItems: 'center',
        marginTop: 'auto',
        marginBottom: t.spacing[32],
    },
    badge: {
        backgroundColor: t.background.surface,
        borderWidth: 1,
        borderColor: t.border.default,
        paddingHorizontal: t.spacing[20],
        paddingVertical: t.spacing[10],
        borderRadius: t.radius.full,
        marginBottom: t.spacing['2xl'],
        ...t.shadows.accentGlow,
    },
    badgeText: {
        color: t.brand.primary,
        fontSize: t.typography.size.micro,
        fontWeight: t.typography.weight.bold,
        letterSpacing: 1.5,
    },
    button: {
        width: '100%',
    }
});
