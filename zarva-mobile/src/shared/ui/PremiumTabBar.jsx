import React, { useEffect } from 'react';
import { useTokens } from '@shared/design-system';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    interpolateColor,
    FadeIn
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

export default function PremiumTabBar({ state, descriptors, navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const insets = useSafeAreaInsets();
    const bottomPadding = Platform.OS === 'ios' ? insets.bottom : 0;

    return (
        <View style={[styles.container, { paddingBottom: bottomPadding }]}>
            <LinearGradient
                colors={[tTheme.background.surface, 'rgba(10, 5, 20, 0.95)']}
                style={styles.blurContainer}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
            >
                <View style={styles.topGlare} />
                <View style={styles.tabContent}>
                    {state.routes.map((route, index) => {
                        const { options } = descriptors[route.key];
                        const label = options.tabBarLabel !== undefined ? options.tabBarLabel : options.title !== undefined ? options.title : route.name;
                        const iconFn = options.tabBarIcon;
                        const isFocused = state.index === index;

                        return (
                            <TabItem
                                key={route.key}
                                label={label}
                                iconFn={iconFn}
                                isFocused={isFocused}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                                    if (!isFocused && !event.defaultPrevented) {
                                        navigation.navigate({ name: route.name, merge: true });
                                    }
                                }}
                                tTheme={tTheme}
                                styles={styles}
                            />
                        );
                    })}
                </View>
            </LinearGradient>
        </View>
    );
}

function TabItem({ label, iconFn, isFocused, onPress, tTheme, styles, index, stateLength }) {
    const scale = useSharedValue(isFocused ? 1.15 : 1);
    const activeProgress = useSharedValue(isFocused ? 1 : 0);

    useEffect(() => {
        scale.value = withSpring(isFocused ? 1.15 : 1, { damping: 15, stiffness: 200 });
        activeProgress.value = withSpring(isFocused ? 1 : 0, { damping: 20 });
    }, [isFocused]);

    const animatedIconStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const animatedLabelStyle = useAnimatedStyle(() => ({
        color: interpolateColor(
            activeProgress.value,
            [0, 1],
            [tTheme.text.tertiary, tTheme.brand.primary]
        ),
        opacity: withSpring(isFocused ? 1 : 0.7),
        transform: [{ translateY: withSpring(isFocused ? 0 : 2) }]
    }));

    const animatedContainerStyle = useAnimatedStyle(() => ({
        opacity: activeProgress.value,
        borderRadius: 16,
    }));

    return (
        <TouchableOpacity
            accessibilityRole="button"
            onPress={onPress}
            style={styles.tabItem}
            activeOpacity={0.7}
        >
            <View style={styles.iconContainer}>
                {isFocused && (
                    <Animated.View style={[StyleSheet.absoluteFill, animatedContainerStyle]}>
                        <LinearGradient
                            colors={[tTheme.brand.primary + '22', tTheme.brand.secondary + '22']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ flex: 1, borderRadius: 16 }}
                        />
                    </Animated.View>
                )}
                <Animated.View style={animatedIconStyle}>
                    {iconFn ? iconFn({ color: isFocused ? tTheme.brand.primary : tTheme.text.tertiary, size: 24 }) : <Text style={styles.missingIcon}>❖</Text>}
                </Animated.View>
                {isFocused && (
                    <Animated.View
                        entering={FadeIn.duration(200)}
                        style={styles.activeIndicator}
                    />
                )}
            </View>
            <Animated.Text style={[styles.label, animatedLabelStyle]}>
                {label}
            </Animated.Text>
        </TouchableOpacity>
    );
}

const createStyles = (t) => StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        width: width,
        paddingHorizontal: t.spacing.lg,
        backgroundColor: 'transparent',
    },
    blurContainer: {
        borderTopLeftRadius: t.radius.xl,
        borderTopRightRadius: t.radius.xl,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: t.border.default + '44',
        overflow: 'hidden',
        shadowColor: t.brand.primary,
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.2,
        shadowRadius: 30,
        elevation: 20,
    },
    topGlare: {
        position: 'absolute',
        top: 0,
        left: '5%',
        right: '5%',
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    tabContent: {
        flexDirection: 'row',
        paddingVertical: 14,
        paddingHorizontal: 12,
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    tabItem: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 50,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    activeIndicator: {
        position: 'absolute',
        bottom: 2,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: t.brand.secondary,
        shadowColor: t.brand.secondary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 6,
    },
    label: {
        marginTop: 4,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    missingIcon: {
        color: t.text.tertiary,
        fontSize: 18,
    }
});
