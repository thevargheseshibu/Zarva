import React from 'react';
import { StyleSheet, View, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../design-system/tokens';

/**
 * MainBackground — Atmospheric Gradient System
 * Provides the signature Zarva depth with a multi-stop gradient.
 */
export default function MainBackground({ children, style }) {
    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient
                // Web Theme Background Strategy
                colors={['#140828', colors.background, colors.background]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, style]}
            />
            {/* Ambient Bloom Light (Top Left) - Purple */}
            <LinearGradient
                colors={['rgba(124, 58, 237, 0.15)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.8, y: 0.8 }}
                style={StyleSheet.absoluteFill}
            />
            {/* Ambient Bloom Light (Bottom Right) - Pink */}
            <LinearGradient
                colors={['transparent', 'rgba(236, 72, 153, 0.15)']}
                start={{ x: 0.2, y: 0.2 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
});
