import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../../design-system/tokens';
import Card from '../../components/Card';
import StatusPill from '../../components/StatusPill';
import apiClient from '../../services/api/client';
import dayjs from 'dayjs';
import { parseJobDescription } from '../../utils/jobParser';

const FILTERS = ['All', 'Active', 'Completed', 'Cancelled'];

export default function MyJobsScreen({ navigation }) {
    const [filter, setFilter] = useState('All');
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchJobs = async () => {
        try {
            const res = await apiClient.get('/api/jobs');
            setJobs(res.data?.jobs || []);
        } catch (err) {
            console.error('Failed to fetch jobs:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchJobs();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchJobs();
    };

    const filtered = jobs.filter(job => {
        if (filter === 'All') return true;
        if (filter === 'Active') return ['searching', 'assigned', 'worker_en_route', 'worker_arrived', 'in_progress'].includes(job.status);
        if (filter === 'Completed') return job.status === 'completed';
        if (filter === 'Cancelled') return job.status === 'cancelled';
        return true;
    });

    const renderJob = ({ item }) => {
        const { text: parsedDesc } = parseJobDescription(item.description);
        const desc = parsedDesc || 'Service Request';

        return (
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => navigation.navigate('JobStatusDetail', { jobId: item.id })}
            >
                <Card style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={{ flex: 1, paddingRight: spacing.md }}>
                            <Text style={styles.category}>{item.category || 'Service'}</Text>
                            <Text style={styles.desc} numberOfLines={1}>{desc}</Text>
                            <Text style={styles.date}>{dayjs(item.created_at).format('MMM D, h:mm A')}</Text>
                        </View>
                        <StatusPill status={item.status} />
                    </View>

                    {item.worker && (item.status === 'assigned' || item.status === 'worker_en_route' || item.status === 'worker_arrived' || item.status === 'in_progress') && (
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
                                <Text style={styles.ratePrompt}>Tap to Details & Rating →</Text>
                            )}
                        </View>
                    )}
                </Card>
            </TouchableOpacity>
        );
    };

    const renderEmpty = () => {
        if (loading) return null; // Wait for load
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTitle}>No Jobs Found</Text>
                <Text style={styles.emptySub}>
                    {filter === 'All'
                        ? "You haven't booked any services yet. Head over to the Home tab to get started!"
                        : `You have no ${filter.toLowerCase()} jobs at the moment.`}
                </Text>
            </View>
        );
    };

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
                ListEmptyComponent={renderEmpty}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.gold.primary}
                        colors={[colors.gold.primary]}
                    />
                }
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

    list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2, flexGrow: 1 },
    card: { padding: spacing.lg, gap: spacing.md },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    category: { color: colors.text.primary, fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
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

    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: spacing.xl * 3 },
    emptyIcon: { fontSize: 48, marginBottom: spacing.md },
    emptyTitle: { color: colors.text.primary, fontSize: 20, fontWeight: '700', marginBottom: spacing.sm },
    emptySub: { color: colors.text.secondary, fontSize: 14, textAlign: 'center', paddingHorizontal: spacing.xl, lineHeight: 22 },
});
