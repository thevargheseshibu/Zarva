/**
 * src/components/WorkerCard.jsx
 * Worker preview: photo circle, name, gold star rating, category chip, distance.
 */
import React from 'react';
import { useTokens } from '@shared/design-system';
import { View, Text, Image, StyleSheet } from 'react-native';


import Card from './Card';

export default function WorkerCard({ worker, distance, onPress }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const {
        name = 'Worker',
        category = '',
        average_rating = 0,
        photo_url = null,
    } = worker || {};

    return (
        <Card style={styles.card}>
            {/* Avatar */}
            <View style={styles.avatar}>
                {photo_url ? (
                    <Image source={{ uri: photo_url }} style={styles.photo} />
                ) : (
                    <View style={styles.photoFallback}>
                        <Text style={styles.initials}>{name[0]?.toUpperCase()}</Text>
                    </View>
                )}
            </View>

            {/* Info */}
            <View style={styles.info}>
                <Text style={styles.name}>{name}</Text>

                <View style={styles.row}>
                    <Text style={styles.star}>★</Text>
                    <Text style={styles.rating}>
                        {average_rating ? Number(average_rating).toFixed(1) : 'New'}
                    </Text>
                </View>

                {category ? (
                    <View style={styles.chip}>
                        <Text style={styles.chipText}>{category}</Text>
                    </View>
                ) : null}
            </View>

            {/* Distance */}
            {distance != null && (
                <Text style={styles.distance}>{distance} km</Text>
            )}
        </Card>
    );
}

const createStyles = (t) => StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: t.radius.full,
        overflow: 'hidden',
    },
    photo: { width: '100%', height: '100%' },
    photoFallback: {
        width: '100%',
        height: '100%',
        backgroundColor: t.background.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    initials: {
        color: t.brand.primary,
        fontSize: t.typography.size.md,
        fontWeight: t.typography.weight.bold,
    },
    info: { flex: 1 },
    name: {
        color: t.text.primary,
        fontSize: t.typography.size.md,
        fontWeight: t.typography.weight.semibold,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    star: { color: t.brand.primary, fontSize: t.typography.size.sm },
    rating: { color: t.text.secondary, fontSize: t.typography.size.sm },
    chip: {
        marginTop: t.spacing.xs,
        backgroundColor: t.background.surface,
        borderRadius: t.radius.sm,
        paddingHorizontal: t.spacing.sm,
        paddingVertical: 2,
        alignSelf: 'flex-start',
    },
    chipText: {
        color: t.text.secondary,
        fontSize: t.typography.size.xs,
        textTransform: 'capitalize',
    },
    distance: {
        color: t.text.tertiary,
        fontSize: t.typography.size.sm,
        fontWeight: t.typography.weight.medium,
    },
});
