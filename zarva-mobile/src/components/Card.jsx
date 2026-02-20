/**
 * src/components/Card.jsx
 * Dark elevated card with optional gold glow border.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../design-system/tokens';

export default function Card({ children, glow = false, style }) {
    return (
        <View style={[styles.card, glow && styles.glow, style]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.bg.elevated,
        borderRadius: radius.lg,
        padding: spacing.md,
    },
    glow: {
        borderWidth: 1,
        borderColor: colors.gold.primary,
        shadowColor: colors.gold.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 8,
    },
});
