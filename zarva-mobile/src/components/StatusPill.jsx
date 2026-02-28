/**
 * src/components/StatusPill.jsx
 * Color-coded badge for job status.
 */
import React from 'react';
import { useTokens } from '../design-system';
import { View, Text, StyleSheet } from 'react-native';

export default function StatusPill({ status, label, style }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);

    const statusConfigs = {
        assigned: { color: tTheme.brand.primary, label: 'Assigned' },
        worker_en_route: { color: tTheme.brand.primary, label: 'En Route' },
        worker_arrived: { color: tTheme.status.warning.base, label: 'Arrived' },
        in_progress: { color: tTheme.brand.primary, label: 'In Progress' },
        completed: { color: tTheme.status.success.base, label: 'Completed' },
        cancelled: { color: tTheme.status.error.base, label: 'Cancelled' },
        disputed: { color: tTheme.status.warning.base, label: 'Disputed' },
        emergency: { color: tTheme.status.error.base, label: 'Emergency' },
    };

    const config = statusConfigs[status] || { color: tTheme.text.tertiary, label: status };
    const displayLabel = label || config.label;

    return (
        <View style={[styles.pill, { backgroundColor: tTheme.background.surface }, style]}>
            <View style={[styles.dot, { backgroundColor: config.color }]} />
            <Text style={[styles.label, { color: config.color }]}>{displayLabel}</Text>
        </View>
    );
}

const createStyles = (t) => StyleSheet.create({
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: t.spacing.sm,
        paddingVertical: 4,
        borderRadius: t.radius.full,
        gap: t.spacing.xxs,
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
        fontSize: t.typography.size.micro,
        fontWeight: t.typography.weight.bold,
        letterSpacing: 0.2,
        textTransform: 'uppercase',
    },
});
