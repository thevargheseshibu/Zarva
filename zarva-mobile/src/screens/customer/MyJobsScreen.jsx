import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import { useT } from '../../hooks/useT';
import apiClient from '../../services/api/client';
import { parseJobDescription } from '../../utils/jobParser';
import FadeInView from '../../components/FadeInView';
import StatusPill from '../../components/StatusPill';
import Card from '../../components/Card';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import SkeletonCard from '../../design-system/components/SkeletonCard';
import { colors, radius, spacing, shadows } from '../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../design-system/typography';

const FILTERS = ['All', 'Active', 'Completed', 'Cancelled'];

export default function MyJobsScreen({ navigation }) {
    const t = useT();
    const [filter, setFilter] = useState('All');
    const [sortNewest, setSortNewest] = useState(true);
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchJobs = async () => {
        try {
            const res = await apiClient.get('/api/jobs');
            setJobs(res.data?.jobs || []);
        } catch (err) {
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchJobs(); }, []));

    const onRefresh = () => {
        setRefreshing(true);
        fetchJobs();
    };

    const filtered = jobs
        .filter(job => {
            if (filter === 'All') return true;
            if (filter === 'Active') return ['searching', 'assigned', 'worker_en_route', 'worker_arrived', 'in_progress'].includes(job.status);
            if (filter === 'Completed') return job.status === 'completed';
            if (filter === 'Cancelled') return job.status === 'cancelled';
            return true;
        })
        .sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return sortNewest ? dateB - dateA : dateA - dateB;
        });

    const handleDeleteJob = (id) => {
        Alert.alert('Delete Request', 'Are you sure you want to remove this service request?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await apiClient.delete(`/api/jobs/${id}`);
                        fetchJobs();
                    } catch (err) {
                        Alert.alert('Error', 'Failed to delete job');
                    }
                }
            }
        ]);
    };

    const renderJob = ({ item, index }) => {
        const { text: parsedDesc } = parseJobDescription(item.description);
        const desc = parsedDesc || 'Service Request';

        return (
            <FadeInView delay={index * 60}>
                <PressableAnimated onPress={() => navigation.navigate('JobStatusDetail', { jobId: item.id })}>
                    <Card style={styles.card}>
                        <View style={styles.cardTop}>
                            <View style={styles.jobTypeBox}>
                                <Text style={styles.jobTypeTxt}>{item.category?.charAt(0).toUpperCase()}</Text>
                            </View>
                            <View style={styles.jobInfo}>
                                <Text style={styles.jobTitle}>{t(`cat_${item.category}`) || item.category}</Text>
                                <Text style={styles.jobDate}>{dayjs(item.created_at).format('MMM D, h:mm A')}</Text>
                            </View>
                            <StatusPill status={item.status} />
                        </View>

                        <Text style={styles.jobDesc} numberOfLines={2}>{desc}</Text>

                        <View style={styles.cardFooter}>
                            {item.worker ? (
                                <View style={styles.workerBrief}>
                                    <Image source={{ uri: item.worker.photo }} style={styles.workerAvatar} />
                                    <View>
                                        <Text style={styles.workerLabel}>WORKER</Text>
                                        <Text style={styles.workerName}>{item.worker.name}</Text>
                                    </View>
                                </View>
                            ) : (
                                <Text style={styles.searchingTxt}>Searching for worker...</Text>
                            )}

                            <View style={styles.actionRow}>
                                {['open', 'searching', 'no_worker_found'].includes(item.status) && (
                                    <PressableAnimated onPress={() => handleDeleteJob(item.id)} style={styles.iconBtn}>
                                        <Text style={styles.iconBtnTxt}>🗑️</Text>
                                    </PressableAnimated>
                                )}
                                {['open', 'searching', 'assigned', 'worker_en_route', 'worker_arrived', 'in_progress'].includes(item.status) && (
                                    <PressableAnimated onPress={() => navigation.navigate('EditJob', { jobId: item.id })} style={styles.iconBtn}>
                                        <Text style={styles.iconBtnTxt}>✏️</Text>
                                    </PressableAnimated>
                                )}
                            </View>
                        </View>
                    </Card>
                </PressableAnimated>
            </FadeInView>
        );
    };

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <Text style={styles.title}>My Requests</Text>
                <PressableAnimated onPress={() => setSortNewest(!sortNewest)} style={styles.sortToggle}>
                    <Text style={styles.sortTxt}>{sortNewest ? 'Newest First' : 'Oldest First'}</Text>
                </PressableAnimated>
            </View>

            <View style={styles.filterBar}>
                <FlatList
                    horizontal
                    data={FILTERS}
                    keyExtractor={i => i}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterList}
                    renderItem={({ item }) => (
                        <PressableAnimated
                            onPress={() => setFilter(item)}
                            style={[styles.filterChip, filter === item && styles.filterChipActive]}
                        >
                            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
                        </PressableAnimated>
                    )}
                />
            </View>

            {loading ? (
                <View style={styles.listContent}>
                    {[1, 2, 3, 4].map(i => (
                        <SkeletonCard key={i} height={160} style={{ marginBottom: spacing[16] }} />
                    ))}
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    renderItem={renderJob}
                    keyExtractor={i => String(i.id)}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />
                    }
                    ListEmptyComponent={() => (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyIcon}>📋</Text>
                            <Text style={styles.emptyTitle}>No requests found</Text>
                            <Text style={styles.emptySub}>Your service history will appear here.</Text>
                        </View>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: 60, paddingHorizontal: spacing[24], flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[24] },
    title: { color: colors.text.primary, fontSize: fontSize.title, fontWeight: fontWeight.bold, letterSpacing: tracking.title },
    sortToggle: { backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.lg, ...shadows.premium },
    sortTxt: { color: colors.accent.primary, fontSize: 12, fontWeight: fontWeight.bold },

    filterBar: { marginBottom: spacing[16] },
    filterList: { paddingHorizontal: spacing[24], gap: spacing[8] },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: radius.full,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: 'transparent'
    },
    filterChipActive: { backgroundColor: colors.elevated, borderColor: colors.accent.border },
    filterText: { color: colors.text.secondary, fontSize: fontSize.caption, fontWeight: fontWeight.medium, letterSpacing: tracking.caption },
    filterTextActive: { color: colors.text.primary, fontWeight: fontWeight.bold },

    listContent: { padding: spacing[24], paddingBottom: 100 },
    card: { padding: spacing[24], gap: spacing[16], marginBottom: spacing[24] },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[16] },
    jobTypeBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.elevated, justifyContent: 'center', alignItems: 'center' },
    jobTypeTxt: { color: colors.accent.primary, fontSize: 20, fontWeight: fontWeight.bold },
    jobInfo: { flex: 1 },
    jobTitle: { color: colors.text.primary, fontSize: fontSize.body, fontWeight: fontWeight.bold, letterSpacing: tracking.body },
    jobDate: { color: colors.text.secondary, fontSize: fontSize.micro, marginTop: 2 },

    jobDesc: { color: colors.text.secondary, fontSize: fontSize.caption, lineHeight: 20, letterSpacing: tracking.caption },

    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: spacing[16],
        borderTopWidth: 1,
        borderTopColor: colors.elevated
    },
    workerBrief: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    workerAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.elevated },
    workerLabel: { color: colors.text.muted, fontSize: 8, fontWeight: fontWeight.bold, letterSpacing: 1 },
    workerName: { color: colors.text.primary, fontSize: 12, fontWeight: fontWeight.semibold },
    searchingTxt: { color: colors.accent.primary, fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 0.5 },

    actionRow: { flexDirection: 'row', gap: spacing[12] },
    iconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.elevated,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.premium
    },
    iconBtnTxt: { fontSize: 16 },

    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
    emptyIcon: { fontSize: 48, marginBottom: spacing[16] },
    emptyTitle: { color: colors.text.primary, fontSize: 18, fontWeight: fontWeight.bold, letterSpacing: tracking.title },
    emptySub: { color: colors.text.secondary, fontSize: 14, marginTop: 4, letterSpacing: tracking.body }
});
