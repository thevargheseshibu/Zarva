import React, { useState, useCallback } from 'react';
import { useTokens } from '../../design-system';
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert, Image, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import { useT } from '../../hooks/useT';
import apiClient from '@infra/api/client';
import { parseJobDescription } from '../../utils/jobParser';
import FadeInView from '../../components/FadeInView';
import StatusPill from '../../components/StatusPill';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import SkeletonCard from '../../design-system/components/SkeletonCard';
import MainBackground from '../../components/MainBackground';

const FILTERS = ['All', 'Active', 'Completed', 'Cancelled'];

export default function MyJobsScreen({ navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const [viewMode, setViewMode] = useState('standard'); // 'standard' | 'custom'
    const [filter, setFilter] = useState('All');
    const [jobs, setJobs] = useState([]);
    const [customJobs, setCustomJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchAll = async () => {
        try {
            const [jobsRes, customRes] = await Promise.all([
                apiClient.get('/api/jobs').catch(() => ({ data: { jobs: [] } })),
                apiClient.get('/api/custom-jobs/templates').catch(() => ({ data: [] }))
            ]);
            setJobs(jobsRes.data?.jobs || []);
            setCustomJobs(customRes.data || []);
        } catch (err) {
            console.warn('Refresh error', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchAll(); }, []));

    const onRefresh = () => {
        setRefreshing(true);
        fetchAll();
    };

    const handleDeleteJob = (id) => {
        Alert.alert(t('delete_request_title'), t('delete_request_msg'), [
            { text: t('cancel'), style: 'cancel' },
            {
                text: t('delete'), style: 'destructive', onPress: async () => {
                    await apiClient.delete(`/api/jobs/${id}`);
                    fetchAll();
                }
            }
        ]);
    };

    const handlePostCustom = async (templateId) => {
        try {
            // Need to pass location
            const locData = { latitude: 0, longitude: 0, address: "Remote/Default" };
            await apiClient.post(`/api/custom-jobs/templates/${templateId}/post`, { location: locData });
            Alert.alert("Success", "Custom Request Posted Live!");
            fetchAll();
        } catch (err) {
            Alert.alert("Error", err.response?.data?.error || "Failed to post job");
        }
    };

    const renderStandard = ({ item, index }) => {
        const { text: parsedDesc } = parseJobDescription(item.description);
        const desc = parsedDesc || 'Service Request';
        const initial = item.category?.charAt(0).toUpperCase() || '?';
        const accentColor = ['completed'].includes(item.status)
            ? tTheme.status.success.base
            : ['cancelled', 'disputed', 'no_worker_found'].includes(item.status)
                ? tTheme.status.error.base
                : tTheme.brand.primary;

        return (
            <FadeInView delay={index * 50}>
                <PressableAnimated onPress={() => navigation.navigate('JobStatusDetail', { jobId: item.id })}>
                    <View style={styles.compactCard}>
                        <View style={[styles.accentStrip, { backgroundColor: accentColor }]} />
                        <View style={styles.cardInner}>
                            <View style={styles.cardHeader}>
                                <View style={[styles.jobTypeCircle, { backgroundColor: accentColor + '18' }]}>
                                    <Text style={[styles.jobTypeIcon, { color: accentColor }]}>{initial}</Text>
                                </View>
                                <View style={styles.jobMeta}>
                                    <Text style={styles.jobTitle} numberOfLines={1}>{t(`cat_${item.category}`) || item.category}</Text>
                                    <Text style={styles.jobDate}>{dayjs(item.created_at).format('MMM D · h:mm A')}</Text>
                                </View>
                                {['open', 'searching', 'no_worker_found'].includes(item.status) && (
                                    <TouchableOpacity onPress={() => handleDeleteJob(item.id)} style={styles.iconBtn}>
                                        <Text style={{ fontSize: 13 }}>🗑️</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View style={styles.statusRow}>
                                <StatusPill status={item.status} />
                            </View>

                            {desc !== 'Service Request' && (
                                <Text style={styles.jobDesc} numberOfLines={2}>"{desc}"</Text>
                            )}

                            {item.worker ? (
                                <View style={styles.workerRow}>
                                    <Image source={{ uri: item.worker.photo }} style={styles.workerImg} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.workerLabel}>Assigned Pro</Text>
                                        <Text style={styles.workerName}>{item.worker.name}</Text>
                                    </View>
                                    <Text style={styles.chevronTxt}>›</Text>
                                </View>
                            ) : (
                                <View style={styles.searchingRow}>
                                    <View style={styles.searchingDot} />
                                    <Text style={styles.searchingTxt}>{t('searching_for_worker') || 'Finding a professional...'}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </PressableAnimated>
            </FadeInView>
        );
    };

    const renderCustom = ({ item, index }) => {
        const canPost = item.status === 'approved';
        return (
            <FadeInView delay={index * 50}>
                <PressableAnimated onPress={() => navigation.navigate('JobStatusDetail', { jobId: item.id })}>
                    <View style={[styles.compactCard, styles.customCardTint]}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.jobTypeCircle, { backgroundColor: tTheme.status.warning.base + '22' }]}>
                                <Text style={{ color: tTheme.status.warning.dark, fontWeight: '900' }}>C</Text>
                            </View>
                            <View style={styles.jobMeta}>
                                <Text style={styles.jobTitle}>{item.title || 'Custom Request'}</Text>
                                <Text style={styles.jobDate}>{dayjs(item.created_at).format('MMM D • h:mm A')}</Text>
                            </View>
                            <StatusPill status={item.status || 'pending'} />
                        </View>

                        <Text style={styles.jobDesc} numberOfLines={2}>"{item.description}"</Text>

                        {item.hourly_rate && (
                            <View style={styles.rateBox}>
                                <Text style={styles.rateLabel}>Approved Rate:</Text>
                                <Text style={styles.rateVal}>₹{item.hourly_rate}/hr</Text>
                            </View>
                        )}

                        {canPost && (
                            <TouchableOpacity style={styles.postLiveBtn} onPress={() => handlePostCustom(item.id)}>
                                <Text style={styles.postLiveTxt}>🚀 Post Live</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </PressableAnimated>
            </FadeInView>
        );
    };

    const displayData = viewMode === 'standard'
        ? jobs.filter(job => {
            if (filter === 'All') return true;
            if (filter === 'Active') return ['searching', 'assigned', 'worker_en_route', 'worker_arrived', 'in_progress'].includes(job.status);
            if (filter === 'Completed') return job.status === 'completed';
            if (filter === 'Cancelled') return job.status === 'cancelled';
            return true;
        })
        : customJobs;

    return (
        <MainBackground>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <Text style={styles.title}>{t('my_requests') || 'My Requests'}</Text>
                    <PressableAnimated style={styles.createBtn} onPress={() => navigation.navigate(viewMode === 'standard' ? 'Home' : 'CreateCustomJob')}>
                        <Text style={styles.createBtnTxt}>+ New</Text>
                    </PressableAnimated>
                </View>

                <View style={styles.segmentedControl}>
                    <TouchableOpacity style={[styles.segment, viewMode === 'standard' && styles.segmentActive]} onPress={() => setViewMode('standard')}>
                        <Text style={[styles.segmentTxt, viewMode === 'standard' && styles.segmentTxtActive]}>Standard Jobs</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.segment, viewMode === 'custom' && styles.segmentActive]} onPress={() => setViewMode('custom')}>
                        <Text style={[styles.segmentTxt, viewMode === 'custom' && styles.segmentTxtActive]}>Custom Requests</Text>
                    </TouchableOpacity>
                </View>

                {viewMode === 'standard' && (
                    <View style={styles.filterBar}>
                        <FlatList
                            horizontal
                            data={FILTERS}
                            keyExtractor={i => i}
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.filterList}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    onPress={() => setFilter(item)}
                                    style={[styles.filterChip, filter === item && styles.filterChipActive]}
                                >
                                    <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>
                                        {item === 'All' ? t('filter_all') || 'All' : item === 'Active' ? t('filter_active') || 'Active' : item === 'Completed' ? t('filter_completed') || 'Completed' : t('filter_cancelled') || 'Cancelled'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                )}
            </View>

            {loading ? (
                <View style={styles.listContent}>
                    {[1, 2, 3].map(i => <SkeletonCard key={i} height={140} style={{ marginBottom: 12 }} />)}
                </View>
            ) : (
                <FlatList
                    data={displayData}
                    renderItem={viewMode === 'standard' ? renderStandard : renderCustom}
                    keyExtractor={i => String(i.id)}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tTheme.brand.primary} />}
                    ListEmptyComponent={() => (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyIcon}>📭</Text>
                            <Text style={styles.emptyTitle}>No {viewMode} requests found</Text>
                            <Text style={styles.emptySub}>Your service history will appear here.</Text>
                        </View>
                    )}
                />
            )}
        </MainBackground>
    );
}

const createStyles = (t) => StyleSheet.create({
    header: { paddingTop: 60, paddingHorizontal: t.spacing['2xl'], backgroundColor: t.background.app },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: t.spacing.lg },
    title: { color: t.text.primary, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
    createBtn: { backgroundColor: t.brand.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: t.radius.full },
    createBtnTxt: { color: '#FFF', fontSize: 12, fontWeight: '800' },

    segmentedControl: { flexDirection: 'row', backgroundColor: t.background.surfaceRaised, borderRadius: t.radius.lg, padding: 4, marginBottom: t.spacing.lg },
    segment: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: t.radius.md },
    segmentActive: { backgroundColor: t.background.surface },
    segmentTxt: { color: t.text.secondary, fontSize: 13, fontWeight: '700' },
    segmentTxtActive: { color: t.text.primary },

    filterBar: { marginBottom: t.spacing.sm },
    filterList: { gap: 8 },
    filterChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: t.radius.full, borderWidth: 1, borderColor: t.border.default },
    filterChipActive: { backgroundColor: t.text.primary, borderColor: t.text.primary },
    filterText: { color: t.text.secondary, fontSize: 12, fontWeight: '600' },
    filterTextActive: { color: t.background.app },

    listContent: { padding: t.spacing['2xl'], paddingBottom: 120, gap: t.spacing.lg },

    // ── CARD ─────────────────────────────────────────
    compactCard: {
        backgroundColor: t.background.surface,
        borderRadius: t.radius.xl,
        borderWidth: 1,
        borderColor: t.border.default + '33',
        overflow: 'hidden',
        flexDirection: 'row',
        ...t.shadows.premium,
    },
    accentStrip: {
        width: 4,
        borderRadius: 2,
        marginVertical: 0,
    },
    cardInner: {
        flex: 1,
        padding: t.spacing.lg,
        gap: 10,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    jobTypeCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center',
    },
    jobTypeIcon: { fontSize: 16, fontWeight: '900' },
    jobMeta: { flex: 1, justifyContent: 'center' },
    jobTitle: { color: t.text.primary, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
    jobDate: { color: t.text.tertiary, fontSize: 11, marginTop: 2, fontWeight: '500' },

    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    jobDesc: {
        color: t.text.secondary,
        fontSize: 12,
        lineHeight: 17,
        fontStyle: 'italic',
        borderLeftWidth: 2,
        borderLeftColor: t.border.default,
        paddingLeft: 8,
    },

    // ── WORKER ROW ───────────────────────────────────
    workerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: t.background.surfaceRaised,
        borderRadius: t.radius.md,
        padding: 10,
    },
    workerImg: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: t.border.default,
    },
    workerLabel: { color: t.text.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
    workerName: { color: t.text.primary, fontSize: 13, fontWeight: '800' },
    chevronTxt: { color: t.text.muted, fontSize: 22, fontWeight: '300', marginLeft: 'auto' },

    // ── SEARCHING STATE ──────────────────────────────
    searchingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    searchingDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: t.brand.primary,
        opacity: 0.8,
    },
    searchingTxt: {
        color: t.text.secondary,
        fontSize: 12,
        fontWeight: '600',
        fontStyle: 'italic',
    },

    iconBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: t.background.surfaceRaised,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actions: { flexDirection: 'row', gap: 8 },

    // ── CUSTOM CARD ──────────────────────────────────
    customCardTint: { borderColor: t.status.warning.base + '55', backgroundColor: t.background.surfaceRaised },
    cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: t.background.surfaceRaised },
    workerBrief: { flexDirection: 'row', alignItems: 'center', gap: 8 },

    rateBox: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: t.background.app, padding: 12, borderRadius: t.radius.md, marginBottom: 12 },
    rateLabel: { color: t.text.secondary, fontSize: 11, fontWeight: '700' },
    rateVal: { color: t.text.primary, fontSize: 13, fontWeight: '900' },
    postLiveBtn: { backgroundColor: t.status.success.dark, padding: 12, borderRadius: t.radius.md, alignItems: 'center' },
    postLiveTxt: { color: '#FFF', fontSize: 13, fontWeight: '800' },

    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, opacity: 0.8 },
    emptyIcon: { fontSize: 40, marginBottom: 16 },
    emptyTitle: { color: t.text.primary, fontSize: 18, fontWeight: '800', marginBottom: 4 },
    emptySub: { color: t.text.secondary, fontSize: 13 }
});
