/**
 * src/components/StatusPill.jsx
 * Color-coded badge for job status.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../design-system/tokens';
import { fontSize, fontWeight } from '../design-system/typography';

const STATUS_MAP = {
    assigned: { color: colors.accent.primary, label: 'Assigned' },
    worker_en_route: { color: colors.accent.primary, label: 'En Route' },
    worker_arrived: { color: colors.warning, label: 'Arrived' },
    in_progress: { color: colors.accent.primary, label: 'In Progress' },
    completed: { color: colors.success, label: 'Completed' },
    cancelled: { color: colors.danger, label: 'Cancelled' },
    disputed: { color: colors.warning, label: 'Disputed' },
    emergency: { color: colors.danger, label: 'Emergency' },
};

export default function StatusPill({ status, label, style }) {
    const config = STATUS_MAP[status] || { color: colors.text.muted, label: status };
    const displayLabel = label || config.label;

    return (
        <View style={[styles.pill, { backgroundColor: colors.bg.surface }, style]}>
            <View style={[styles.dot, { backgroundColor: config.color }]} />
            <Text style={[styles.label, { color: config.color }]}>{displayLabel}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radius.full,
        gap: spacing.xxs,
        alignSelf: 'flex-start',
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    label: {
        fontSize: fontSize.micro,
        fontWeight: fontWeight.bold,
        letterSpacing: 0.2,
        textTransform: 'uppercase',
    },
});
