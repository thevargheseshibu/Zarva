import React from 'react';
import { useTokens } from '../design-system';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


const { width } = Dimensions.get('window');

/**
 * PremiumTabBar
 * Custom glassmorphic Bottom Tab Bar designed for the Zarva Web theme.
 */
export default function PremiumTabBar({ state, descriptors, navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const insets = useSafeAreaInsets();

    // Set padding to just the safe area (or 0 on Android) to remove the gap
    const bottomPadding = Platform.OS === 'ios' ? insets.bottom : 0;

    return (
        <View style={[styles.container, { paddingBottom: bottomPadding }]}>
            <LinearGradient
                colors={[tTheme.background.surface, 'rgba(20, 8, 40, 0.85)']} // Using surface matching colors
                style={styles.blurContainer}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
            >
                {/* Subtle top border reflection */}
                <View style={styles.topGlare} />

                <View style={styles.tabContent}>
                    {state.routes.map((route, index) => {
                        const { options } = descriptors[route.key];
                        const label = options.tabBarLabel !== undefined
                            ? options.tabBarLabel
                            : options.title !== undefined
                                ? options.title
                                : route.name;

                        // Access the icon function passed in options.tabBarIcon
                        const iconFn = options.tabBarIcon;

                        const isFocused = state.index === index;

                        const onPress = () => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            const event = navigation.emit({
                                type: 'tabPress',
                                target: route.key,
                                canPreventDefault: true,
                            });

                            if (!isFocused && !event.defaultPrevented) {
                                navigation.navigate({ name: route.name, merge: true });
                            }
                        };

                        return (
                            <TouchableOpacity
                                key={route.key}
                                accessibilityRole="button"
                                accessibilityState={isFocused ? { selected: true } : {}}
                                accessibilityLabel={options.tabBarAccessibilityLabel}
                                testID={options.tabBarTestID}
                                onPress={onPress}
                                style={styles.tabItem}
                            >
                                <View style={[styles.iconContainer, isFocused && styles.iconContainerActive]}>
                                    {/* Render Icon */}
                                    {iconFn ? iconFn({ color: isFocused ? tTheme.brand.primary : tTheme.text.tertiary, size: 24 }) : <Text style={styles.missingIcon}>❖</Text>}

                                    {/* Active Indicator Glow */}
                                    {isFocused && (
                                        <View style={styles.activeGlow} />
                                    )}
                                </View>
                                <Text style={[styles.label, isFocused && styles.labelActive]}>
                                    {label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </LinearGradient>
        </View>
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
        borderBottomWidth: 0, // No border on the bottom
        borderColor: t.border.default + '44',
        overflow: 'hidden',
        // Heavy shadow for floating effect
        shadowColor: t.brand.primary,
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
    },
    topGlare: {
        position: 'absolute',
        top: 0,
        left: '10%',
        right: '10%',
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    tabContent: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 8,
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    tabItem: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: t.radius.md,
        position: 'relative',
    },
    iconContainerActive: {
        backgroundColor: t.brand.primary + '11',
    },
    activeGlow: {
        position: 'absolute',
        bottom: -6,
        width: 16,
        height: 3,
        borderRadius: 2,
        backgroundColor: t.brand.primary,
        shadowColor: t.brand.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 4,
    },
    label: {
        marginTop: 4,
        fontSize: 10,
        fontWeight: '600',
        color: t.text.tertiary,
        letterSpacing: 0.5,
    },
    labelActive: {
        color: t.brand.primary,
        fontWeight: '800',
    },
    missingIcon: {
        color: t.text.tertiary,
        fontSize: 18,
    }
});
