import React, { useState, useEffect, useCallback } from 'react';
import { useTokens } from '../../design-system';
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



const FILTERS = ['All', 'Active', 'Completed', 'Cancelled'];

export default function MyJobsScreen({ navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
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
        Alert.alert(t('delete_request_title'), t('delete_request_msg'), [
            { text: t('cancel'), style: 'cancel' },
            {
                text: t('delete'),
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
                                        <Text style={styles.workerLabel}>{t('worker_caps')}</Text>
                                        <Text style={styles.workerName}>{item.worker.name}</Text>
                                    </View>
                                </View>
                            ) : (
                                <Text style={styles.searchingTxt}>{t('searching_for_worker')}</Text>
                            )}

                            <View style={styles.actionRow}>
                                {['open', 'searching', 'no_worker_found'].includes(item.status) && (
                                    <PressableAnimated onPress={() => handleDeleteJob(item.id)} style={styles.iconBtn}>
                                        <Text style={styles.iconBtnTxt}>🗑️</Text>
                                    </PressableAnimated>
                                )}
                                {['open', 'searching', 'no_worker_found', 'assigned', 'worker_en_route', 'worker_arrived', 'in_progress'].includes(item.status) && (
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
                <Text style={styles.title}>{t('my_requests')}</Text>
                <PressableAnimated onPress={() => setSortNewest(!sortNewest)} style={styles.sortToggle}>
                    <Text style={styles.sortTxt}>{sortNewest ? t('newest_first') : t('oldest_first')}</Text>
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
                            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>
                                {item === 'All' ? t('filter_all') : item === 'Active' ? t('filter_active') : item === 'Completed' ? t('filter_completed') : t('filter_cancelled')}
                            </Text>
                        </PressableAnimated>
                    )}
                />
            </View>

            {loading ? (
                <View style={styles.listContent}>
                    {[1, 2, 3, 4].map(i => (
                        <SkeletonCard key={i} height={160} style={{ marginBottom: tTheme.spacing.lg }} />
                    ))}
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    renderItem={renderJob}
                    keyExtractor={i => String(i.id)}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tTheme.brand.primary} />
                    }
                    ListEmptyComponent={() => (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyIcon}>📋</Text>
                            <Text style={styles.emptyTitle}>{t('no_requests_found')}</Text>
                            <Text style={styles.emptySub}>{t('service_history_appear_here')}</Text>
                        </View>
                    )}
                />
            )}
        </View>
    );
}

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.app },
    header: { paddingTop: 60, paddingHorizontal: t.spacing['2xl'], flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: t.spacing['2xl'] },
    title: { color: t.text.primary, fontSize: t.typography.size.title, fontWeight: t.typography.weight.bold, letterSpacing: t.typography.tracking.title },
    sortToggle: { backgroundColor: t.background.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: t.radius.lg, ...t.shadows.premium },
    sortTxt: { color: t.brand.primary, fontSize: 12, fontWeight: t.typography.weight.bold },

    filterBar: { marginBottom: t.spacing.lg },
    filterList: { paddingHorizontal: t.spacing['2xl'], gap: t.spacing.sm },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: t.radius.full,
        backgroundColor: t.background.surface,
        borderWidth: 1,
        borderColor: 'transparent'
    },
    filterChipActive: { backgroundColor: t.background.surfaceRaised, borderColor: t.border.default },
    filterText: { color: t.text.secondary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.medium, letterSpacing: t.typography.tracking.caption },
    filterTextActive: { color: t.text.primary, fontWeight: t.typography.weight.bold },

    listContent: { padding: t.spacing['2xl'], paddingBottom: 120 },
    card: { padding: t.spacing['2xl'], gap: t.spacing.lg, marginBottom: t.spacing['2xl'] },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.lg },
    jobTypeBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: t.background.surfaceRaised, justifyContent: 'center', alignItems: 'center' },
    jobTypeTxt: { color: t.brand.primary, fontSize: 20, fontWeight: t.typography.weight.bold },
    jobInfo: { flex: 1 },
    jobTitle: { color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.bold, letterSpacing: t.typography.tracking.body },
    jobDate: { color: t.text.secondary, fontSize: t.typography.size.micro, marginTop: 2 },

    jobDesc: { color: t.text.secondary, fontSize: t.typography.size.caption, lineHeight: 20, letterSpacing: t.typography.tracking.caption },

    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: t.spacing.lg,
        borderTopWidth: 1,
        borderTopColor: t.background.surfaceRaised
    },
    workerBrief: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    workerAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: t.background.surfaceRaised },
    workerLabel: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1 },
    workerName: { color: t.text.primary, fontSize: 12, fontWeight: t.typography.weight.semibold },
    searchingTxt: { flex: 1, color: t.brand.primary, fontSize: 11, fontWeight: t.typography.weight.bold, letterSpacing: 0.5 },

    actionRow: { flexDirection: 'row', gap: t.spacing.md },
    iconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: t.background.surfaceRaised,
        justifyContent: 'center',
        alignItems: 'center',
        ...t.shadows.premium
    },
    iconBtnTxt: { fontSize: 16 },

    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
    emptyIcon: { fontSize: 48, marginBottom: t.spacing.lg },
    emptyTitle: { color: t.text.primary, fontSize: 18, fontWeight: t.typography.weight.bold, letterSpacing: t.typography.tracking.title },
    emptySub: { color: t.text.secondary, fontSize: 14, marginTop: 4, letterSpacing: t.typography.tracking.body }
});
