import React, { useEffect } from 'react';
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
import { colors, spacing, radius, shadows } from '../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../design-system/typography';
import PremiumButton from './PremiumButton';

const { width } = Dimensions.get('window');

export default function NotCoveredView({ locationName, onRetry }) {
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        padding: spacing[24],
        backgroundColor: colors.background,
    },
    imageContainer: {
        width: width * 0.8,
        height: 300,
        marginTop: spacing[40],
        marginBottom: spacing[24],
        alignItems: 'center',
        justifyContent: 'center',
    },
    glowCircle: {
        position: 'absolute',
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: colors.accent.glow,
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
        color: colors.text.primary,
        fontSize: fontSize.hero,
        fontWeight: fontWeight.bold,
        letterSpacing: tracking.hero,
        textAlign: 'center',
        marginBottom: spacing[16],
    },
    description: {
        color: colors.text.secondary,
        fontSize: fontSize.body,
        lineHeight: 26,
        textAlign: 'center',
        paddingHorizontal: spacing[12],
        marginBottom: spacing[48],
    },
    actionSection: {
        width: '100%',
        alignItems: 'center',
        marginTop: 'auto',
        marginBottom: spacing[32],
    },
    badge: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.accent.border,
        paddingHorizontal: spacing[20],
        paddingVertical: spacing[10],
        borderRadius: radius.full,
        marginBottom: spacing[24],
        ...shadows.accentGlow,
    },
    badgeText: {
        color: colors.accent.primary,
        fontSize: fontSize.micro,
        fontWeight: fontWeight.bold,
        letterSpacing: 1.5,
    },
    button: {
        width: '100%',
    }
});
