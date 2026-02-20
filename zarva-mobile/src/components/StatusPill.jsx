/**
 * src/components/StatusPill.jsx
 * Color-coded badge for job status.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../design-system/tokens';
import { fontSize, fontWeight } from '../design-system/typography';

const STATUS_MAP = {
    assigned: { bg: colors.info, label: 'Assigned' },
    worker_en_route: { bg: colors.info, label: 'En Route' },
    worker_arrived: { bg: colors.warning, label: 'Arrived' },
    in_progress: { bg: colors.gold.primary, label: 'In Progress' },
    completed: { bg: colors.success, label: 'Completed' },
    cancelled: { bg: colors.error, label: 'Cancelled' },
    disputed: { bg: colors.warning, label: 'Disputed' },
};

export default function StatusPill({ status, style }) {
    const config = STATUS_MAP[status] || { bg: colors.text.muted, label: status };

    return (
        <View style={[styles.pill, { backgroundColor: config.bg + '22' }, style]}>
            <View style={[styles.dot, { backgroundColor: config.bg }]} />
            <Text style={[styles.label, { color: config.bg }]}>{config.label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
        gap: spacing.xs,
        alignSelf: 'flex-start',
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: radius.full,
    },
    label: {
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
});
