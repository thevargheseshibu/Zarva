/**
 * src/components/GoldButton.jsx
 * Full-width, 56px, gold background, dark text, 16px radius.
 */
import React from 'react';
import {
    TouchableOpacity,
    Text,
    ActivityIndicator,
    StyleSheet,
} from 'react-native';
import { colors, radius, spacing } from '../design-system/tokens';
import { fontSize, fontWeight } from '../design-system/typography';

export default function GoldButton({
    onPress,
    title,
    loading = false,
    disabled = false,
    style,
}) {
    const isDisabled = disabled || loading;

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={isDisabled}
            activeOpacity={0.82}
            style={[styles.button, isDisabled && styles.disabled, style]}
        >
            {loading ? (
                <ActivityIndicator color={colors.text.inverse} size="small" />
            ) : (
                <Text style={styles.label}>{title}</Text>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        height: 56,
        width: '100%',
        backgroundColor: colors.gold.primary,
        borderRadius: radius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
    },
    disabled: {
        opacity: 0.5,
    },
    label: {
        color: colors.text.inverse,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
        letterSpacing: 0.5,
    },
});
