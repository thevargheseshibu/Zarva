
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTokens } from '../design-system';
import { useT } from '../hooks/useT';
import Card from './Card';
import PressableAnimated from '../design-system/components/PressableAnimated';
import StatusPill from './StatusPill';

export default function ActivityCard({ job, onPress, categoryIcon }) {
    const tTheme = useTokens();
    const t = useT();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);

    const date = new Date(job.created_at);
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateString = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

    return (
        <PressableAnimated onPress={onPress}>
            <Card style={styles.card}>
                <View style={styles.iconContainer}>
                    <Text style={styles.icon}>{categoryIcon || '🛠️'}</Text>
                    <View style={styles.blurOverlay} />
                </View>

                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title} numberOfLines={1}>
                            {t(`cat_${job.category}`) || job.category}
                        </Text>
                        <StatusPill status={job.status} />
                    </View>

                    <View style={styles.footer}>
                        <View style={styles.timeRow}>
                            <Text style={styles.timeIcon}>🕒</Text>
                            <Text style={styles.timeText}>{dateString} • {timeString}</Text>
                        </View>
                        <Text style={styles.idText}>#{String(job.id).padStart(4, '0')}</Text>
                    </View>
                </View>
            </Card>
        </PressableAnimated>
    );
}

const createStyles = (t) => StyleSheet.create({
    card: {
        flexDirection: 'row',
        padding: t.spacing.lg,
        gap: t.spacing.lg,
        backgroundColor: t.background.surfaceRaised,
        borderWidth: 1,
        borderColor: t.border.default + '11',
        marginBottom: t.spacing.md,
        alignItems: 'center',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: t.brand.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
    },
    icon: {
        fontSize: 24,
        zIndex: 2,
    },
    blurOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: t.brand.primary + '05',
    },
    content: {
        flex: 1,
        gap: 6,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        color: t.text.primary,
        fontSize: t.typography.size.body,
        fontWeight: t.typography.weight.bold,
        flex: 1,
        marginRight: 8,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    timeIcon: {
        fontSize: 10,
        opacity: 0.6,
    },
    timeText: {
        color: t.text.tertiary,
        fontSize: t.typography.size.micro,
        fontWeight: t.typography.weight.medium,
    },
    idText: {
        color: t.text.tertiary,
        fontSize: 9,
        fontWeight: t.typography.weight.bold,
        letterSpacing: 0.5,
        opacity: 0.5,
    },
});
