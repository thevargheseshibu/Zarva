import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { colors, spacing, radius } from '../../design-system/tokens';
import Card from '../../components/Card';
import StatusPill from '../../components/StatusPill';

const FILTERS = ['All', 'Active', 'Completed', 'Cancelled'];

const MOCK_JOBS = [
    {
        id: 1, category: 'Electrician', desc: 'Fix wiring in bedroom',
        status: 'searching', date: 'Today, 10:00 AM'
    },
    {
        id: 2, category: 'Plumber', desc: 'Leaky kitchen sink',
        status: 'assigned', date: 'Yesterday',
        worker: { name: 'Rahul R', rating: 4.8, photo: 'https://i.pravatar.cc/150?img=11' }
    },
    {
        id: 3, category: 'AC Repair', desc: 'Annual service',
        status: 'completed', date: 'Feb 15', ratingGiven: 5
    },
    {
        id: 4, category: 'Cleaning', desc: 'Deep clean 2BHK',
        status: 'cancelled', date: 'Feb 10'
    }
];

export default function MyJobsScreen({ navigation }) {
    const [filter, setFilter] = useState('All');

    const filtered = MOCK_JOBS.filter(job => {
        if (filter === 'All') return true;
        if (filter === 'Active') return ['searching', 'assigned', 'in_progress', 'worker_arrived'].includes(job.status);
        if (filter === 'Completed') return job.status === 'completed';
        if (filter === 'Cancelled') return job.status === 'cancelled';
        return true;
    });

    const renderJob = ({ item }) => (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('JobStatusDetail', { jobId: item.id })}
        >
            <Card style={styles.card}>
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={styles.category}>{item.category}</Text>
                        <Text style={styles.desc}>{item.desc}</Text>
                        <Text style={styles.date}>{item.date}</Text>
                    </View>
                    <StatusPill status={item.status} />
                </View>

                {item.status === 'assigned' && item.worker && (
                    <View style={styles.workerMini}>
                        <Image source={{ uri: item.worker.photo }} style={styles.workerPhoto} />
                        <View style={styles.workerInfo}>
                            <Text style={styles.workerName}>{item.worker.name}</Text>
                            <Text style={styles.workerRating}>⭐ {item.worker.rating}</Text>
                        </View>
                    </View>
                )}

                {item.status === 'completed' && (
                    <View style={styles.ratingArea}>
                        {item.ratingGiven ? (
                            <Text style={styles.ratedTxt}>You rated: ⭐ {item.ratingGiven}</Text>
                        ) : (
                            <Text style={styles.ratePrompt}>Tap to Rate Worker →</Text>
                        )}
                    </View>
                )}
            </Card>
        </TouchableOpacity>
    );

    return (
        <View style={styles.screen}>
            <Text style={styles.header}>My Posts</Text>

            <View style={styles.filterWrap}>
                <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={FILTERS}
                    keyExtractor={item => item}
                    contentContainerStyle={styles.filterList}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.chip, filter === item && styles.chipActive]}
                            onPress={() => setFilter(item)}
                        >
                            <Text style={[styles.chipText, filter === item && styles.chipTextActive]}>
                                {item}
                            </Text>
                        </TouchableOpacity>
                    )}
                />
            </View>

            <FlatList
                data={filtered}
                keyExtractor={(i) => String(i.id)}
                contentContainerStyle={styles.list}
                renderItem={renderJob}
                ListEmptyComponent={<Text style={styles.empty}>No jobs found in this category.</Text>}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary },
    header: { color: colors.text.primary, fontSize: 24, fontWeight: '700', padding: spacing.lg, paddingBottom: spacing.sm },

    filterWrap: { height: 50 },
    filterList: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: 'center' },
    chip: {
        paddingHorizontal: spacing.md, paddingVertical: 8,
        borderRadius: radius.full, backgroundColor: colors.bg.surface,
        borderWidth: 1, borderColor: colors.bg.surface
    },
    chipActive: { backgroundColor: colors.gold.glow, borderColor: colors.gold.primary },
    chipText: { color: colors.text.secondary, fontWeight: '600', fontSize: 13 },
    chipTextActive: { color: colors.gold.primary },

    list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
    card: { padding: spacing.lg, gap: spacing.md },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    category: { color: colors.text.primary, fontSize: 16, fontWeight: '700' },
    desc: { color: colors.text.secondary, fontSize: 14, marginTop: 2 },
    date: { color: colors.text.muted, fontSize: 12, marginTop: spacing.xs },

    workerMini: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.bg.surface
    },
    workerPhoto: { width: 36, height: 36, borderRadius: 18 },
    workerInfo: { flex: 1 },
    workerName: { color: colors.text.primary, fontSize: 14, fontWeight: '600' },
    workerRating: { color: colors.gold.primary, fontSize: 12, marginTop: 2 },

    ratingArea: { paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.bg.surface },
    ratedTxt: { color: colors.gold.muted, fontSize: 13, fontWeight: '600' },
    ratePrompt: { color: colors.gold.primary, fontSize: 14, fontWeight: '600' },

    empty: { color: colors.text.muted, textAlign: 'center', marginTop: spacing.xl * 2 }
});
