/**
 * src/components/StatusPill.jsx
 * Ultra-Premium compact status badge with icon + short label.
 */
import React from 'react';
import { useTokens } from '../design-system';
import { View, Text, StyleSheet } from 'react-native';
import { useT } from '../hooks/useT';

const STATUS_META = {
    open: { icon: '◉', short: 'Open' },
    searching: { icon: '⟳', short: 'Searching' },
    assigned: { icon: '✓', short: 'Assigned' },
    worker_en_route: { icon: '↗', short: 'En Route' },
    worker_arrived: { icon: '📍', short: 'Arrived' },
    in_progress: { icon: '▶', short: 'Active' },
    pending: { icon: '⏸', short: 'Pending' },
    pending_completion: { icon: '⏺', short: 'Review' },
    completed: { icon: '✔', short: 'Done' },
    cancelled: { icon: '✕', short: 'Cancelled' },
    disputed: { icon: '⚑', short: 'Disputed' },
    no_worker_found: { icon: '✕', short: 'No Match' },
    emergency: { icon: '!', short: 'Emergency' },
};

export default function StatusPill({ status, label, style }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);

    const colorMap = {
        open: tTheme.brand.primaryLight,
        searching: tTheme.brand.primary,
        assigned: tTheme.brand.primary,
        worker_en_route: tTheme.brand.accent,
        worker_arrived: tTheme.status.warning.base,
        in_progress: tTheme.brand.secondary,
        pending: tTheme.status.warning.base,
        pending_completion: tTheme.status.warning.base,
        completed: tTheme.status.success.base,
        cancelled: tTheme.status.error.base,
        disputed: tTheme.status.warning.base,
        no_worker_found: tTheme.text.muted,
        emergency: tTheme.status.error.base,
    };

    const meta = STATUS_META[status] || { icon: '·', short: status || 'Unknown' };
    const color = colorMap[status] || tTheme.text.tertiary;
    const displayLabel = label || meta.short;

    return (
        <View style={[styles.pill, { borderColor: color + '44', backgroundColor: color + '12' }, style]}>
            <Text style={[styles.icon, { color }]}>{meta.icon}</Text>
            <Text style={[styles.label, { color }]} numberOfLines={1}>{displayLabel}</Text>
        </View>
    );
}

const createStyles = (t) => StyleSheet.create({
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: t.radius.full,
        gap: 4,
        alignSelf: 'flex-start',
        borderWidth: 1,
        maxWidth: 110,
    },
    icon: {
        fontSize: 9,
        fontWeight: '900',
        lineHeight: 13,
    },
    label: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.1,
        flexShrink: 1,
    },
});
