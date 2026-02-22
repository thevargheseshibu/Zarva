/**
 * src/components/WorkerCard.jsx
 * Worker preview: photo circle, name, gold star rating, category chip, distance.
 */
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../design-system/tokens';
import { fontSize, fontWeight } from '../design-system/typography';
import Card from './Card';

export default function WorkerCard({ worker, distance, onPress }) {
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

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: radius.full,
        overflow: 'hidden',
    },
    photo: { width: '100%', height: '100%' },
    photoFallback: {
        width: '100%',
        height: '100%',
        backgroundColor: colors.bg.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    initials: {
        color: colors.gold.primary,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    info: { flex: 1 },
    name: {
        color: colors.text.primary,
        fontSize: fontSize.md,
        fontWeight: fontWeight.semibold,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    star: { color: colors.gold.primary, fontSize: fontSize.sm },
    rating: { color: colors.text.secondary, fontSize: fontSize.sm },
    chip: {
        marginTop: spacing.xs,
        backgroundColor: colors.bg.surface,
        borderRadius: radius.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        alignSelf: 'flex-start',
    },
    chipText: {
        color: colors.text.secondary,
        fontSize: fontSize.xs,
        textTransform: 'capitalize',
    },
    distance: {
        color: colors.gold.muted,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.medium,
    },
});
