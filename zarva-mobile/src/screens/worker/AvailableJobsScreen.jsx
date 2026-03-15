import React, { useState, useCallback, useMemo } from 'react';
import { useTokens } from '../../design-system';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, FlatList, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useT } from '../../hooks/useT';
import apiClient from '../../services/api/client';
import { useWorkerStore } from '../../stores/workerStore';
import FadeInView from '../../components/FadeInView';
import Card from '../../components/Card';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import MainBackground from '../../components/MainBackground';


import { haversineKm, formatDistance } from '../../utils/distance';
import { parseJobDescription } from '../../utils/jobParser';

dayjs.extend(relativeTime);

export default function AvailableJobsScreen({ navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const [filter, setFilter] = useState('All');
    const [sortBy, setSortBy] = useState('Nearest');
    const [categories, setCategories] = useState(['All']);
    const [refreshing, setRefreshing] = useState(false);
    const [jobs, setJobs] = useState([]);
    const [customJobs, setCustomJobs] = useState([]);
    const [viewMode, setViewMode] = useState('standard'); // 'standard' or 'custom'
    const [loading, setLoading] = useState(true);
    const { locationOverride, isOnline: storeOnline } = useWorkerStore();
    const [isOnline, setIsOnline] = useState(storeOnline);
    const [kycError, setKycError] = useState(false);

    const fetchJobs = async () => {
        try {
            let currentLoc = null;
            if (locationOverride) {
                currentLoc = { lat: locationOverride.lat, lng: locationOverride.lng };
            } else {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    currentLoc = { lat: location.coords.latitude, lng: location.coords.longitude };
                }
            }

            const res = await apiClient.get('/api/worker/available-jobs');
            const serverOnline = res.data?.is_online;
            setIsOnline(serverOnline);
            useWorkerStore.getState().setOnline(serverOnline);
            setKycError(false);

            let rawJobs = res.data?.jobs || [];
            let rawCustom = [];

            try {
                if (currentLoc) {
                    const customRes = await apiClient.get(`/api/custom-jobs/available?lat=${currentLoc.lat}&lng=${currentLoc.lng}`);
                    rawCustom = customRes.data || [];
                }
            } catch (err) {
                console.warn('Failed to fetch custom jobs', err);
            }

            if (currentLoc) {
                rawJobs = rawJobs.map(job => {
                    if (job.latitude && job.longitude) {
                        return { ...job, dist: haversineKm(currentLoc.lat, currentLoc.lng, job.latitude, job.longitude) };
                    }
                    return job;
                });
                rawJobs.sort((a, b) => (a.dist || 999) - (b.dist || 999));

                rawCustom = rawCustom.map(job => {
                    if (job.latitude && job.longitude) {
                        return { ...job, dist: haversineKm(currentLoc.lat, currentLoc.lng, job.latitude, job.longitude) };
                    }
                    return job;
                });
                rawCustom.sort((a, b) => (a.dist || 999) - (b.dist || 999));
            }
            setJobs(rawJobs);
            setCustomJobs(rawCustom);
        } catch (err) {
            if (err.response?.status === 403) {
                setKycError(true);
                setJobs([]);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchJobs();
            apiClient.get('/api/jobs/config')
                .then(res => {
                    if (res.data?.categories) {
                        const dynamicCats = Object.values(res.data.categories).map(c => c.label);
                        setCategories(['All', ...dynamicCats]);
                    }
                })
                .catch(err => console.error('Failed to fetch categories', err));
        }, [])
    );

    const sortedAndFilteredJobs = useMemo(() => {
        const sourceData = viewMode === 'standard' ? jobs : customJobs;
        let result = sourceData.filter(j => {
            if (filter === 'All') return true;
            return j.category?.toLowerCase() === filter.toLowerCase();
        });
        if (sortBy === 'Nearest') result.sort((a, b) => (a.dist || 999) - (b.dist || 999));
        else if (sortBy === 'Latest') result.sort((a, b) => new Date(b.created_at || b.time) - new Date(a.created_at || a.time));
        else if (sortBy === 'Reward') result.sort((a, b) => ((viewMode === 'standard' ? parseFloat(b.total_amount) : parseFloat(b.hourly_rate)) || 0) - ((viewMode === 'standard' ? parseFloat(a.total_amount) : parseFloat(a.hourly_rate)) || 0));
        return result;
    }, [jobs, customJobs, filter, sortBy, viewMode]);

    const onRefresh = () => {
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        fetchJobs();
    };

    const renderJob = ({ item, index }) => {
        const { text: parsedText } = parseJobDescription(item.description || item.desc);
        const descText = parsedText || item.description || item.desc || "No details provided";

        return (
            <FadeInView delay={index * 100}>
                <PressableAnimated
                    onPress={() => {
                        Haptics.selectionAsync();
                        navigation.navigate('JobDetailPreview', { job: item });
                    }}
                >
                    <Card style={styles.jobCard}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.catBox, viewMode === 'custom' && styles.catBoxCustom]}>
                                <Text style={[styles.catTxt, viewMode === 'custom' && styles.catTxtCustom]}>
                                    {viewMode === 'custom' ? 'CUSTOM REQUEST' : (item.category || t('professional_service'))}
                                </Text>
                            </View>
                            <Text style={styles.timeTxt}>{dayjs(item.created_at || item.time).fromNow()}</Text>
                        </View>

                        {viewMode === 'custom' && item.title && (
                            <Text style={styles.jobTitleTxt}>{item.title}</Text>
                        )}
                        <Text style={styles.descTxt} numberOfLines={2}>"{descText}"</Text>

                        <View style={styles.statsRow}>
                            <View style={styles.statLine}>
                                <Text style={styles.statIcon}>📍</Text>
                                <Text style={styles.statTxt}>{formatDistance(item.dist) || '—'}{t('away_suffix')}</Text>
                            </View>
                            <View style={styles.rewardBox}>
                                <Text style={styles.rewardLabel}>{viewMode === 'custom' ? 'HOURLY RATE' : t('est_payout')}</Text>
                                <Text style={styles.rewardVal}>₹{parseFloat((viewMode === 'custom' ? item.hourly_rate : item.total_amount) || 0).toFixed(0)}</Text>
                            </View>
                        </View>

                        <View style={styles.cardFooter}>
                            <Text style={styles.clientLabel}>{t('requested_by')}{item.customer_name?.split(' ')[0] || 'Client'}</Text>
                            <Text style={styles.viewMore}>{t('acquire_request')}</Text>
                        </View>
                    </Card>
                </PressableAnimated>
            </FadeInView>
        );
    };

    if (!isOnline) {
        return (
            <MainBackground>
                <View style={styles.offlineScreen}>
                    <FadeInView delay={100} style={styles.offlineContent}>
                        <Text style={styles.offlineIcon}>🌘</Text>
                        <Text style={styles.offlineTitle}>{t('currently_inactive')}</Text>
                        <Text style={styles.offlineSub}>{t('go_online_desc')}</Text>
                    </FadeInView>
                </View>
            </MainBackground>
        );
    }

    return (
        <MainBackground>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerSub}>{t('available_opportunities')}</Text>
                    <Text style={styles.headerTitle}>{t('marketplace')}</Text>
                </View>
                <View style={styles.viewModeToggle}>
                    <TouchableOpacity
                        style={[styles.modeBtn, viewMode === 'standard' && styles.modeBtnActive]}
                        onPress={() => setViewMode('standard')}
                    >
                        <Text style={[styles.modeTxt, viewMode === 'standard' && styles.modeTxtActive]}>Standard</Text>
                        {viewMode === 'standard' && <View style={styles.modeIndicator} />}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.modeBtn, viewMode === 'custom' && styles.modeBtnActive]}
                        onPress={() => setViewMode('custom')}
                    >
                        <Text style={[styles.modeTxt, viewMode === 'custom' && styles.modeTxtActive]}>Custom</Text>
                        {viewMode === 'custom' && <View style={[styles.modeIndicator, { backgroundColor: tTheme.status.warning.base }]} />}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Filters */}
            <View style={styles.stickyHeader}>
                {viewMode === 'standard' && (
                    <FlatList
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        data={categories}
                        keyExtractor={item => item}
                        contentContainerStyle={styles.filterList}
                        renderItem={({ item }) => {
                            const active = filter === item;
                            return (
                                <TouchableOpacity
                                    style={[styles.filterChip, active && styles.filterChipActive]}
                                    onPress={() => {
                                        setFilter(item);
                                        Haptics.selectionAsync();
                                    }}
                                >
                                    <Text style={[styles.filterTxt, active && styles.filterTxtActive]}>{item.toUpperCase()}</Text>
                                </TouchableOpacity>
                            );
                        }}
                    />
                )}

                <View style={styles.sortBar}>
                    {['Nearest', 'Latest', 'Reward'].map(opt => {
                        const optKey = opt === 'Nearest' ? t('nearest') : opt === 'Latest' ? t('latest') : t('reward');
                        const active = sortBy === opt;
                        return (
                            <TouchableOpacity
                                key={opt}
                                style={[styles.sortChip, active && styles.sortChipActive]}
                                onPress={() => {
                                    setSortBy(opt);
                                    Haptics.selectionAsync();
                                }}
                            >
                                <Text style={[styles.sortTxt, active && styles.sortTxtActive]}>{optKey}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            <FlatList
                data={sortedAndFilteredJobs}
                keyExtractor={i => String(i.id)}
                contentContainerStyle={styles.listContent}
                renderItem={renderJob}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={tTheme.brand.primary}
                    />
                }
                ListEmptyComponent={() => {
                    if (loading) return (
                        <View style={styles.emptyContainer}>
                            <ActivityIndicator size="large" color={tTheme.brand.primary} />
                        </View>
                    );
                    return (
                        <FadeInView delay={200} style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>💎</Text>
                            <Text style={styles.emptyTitle}>{t('all_caught_up')}</Text>
                            <Text style={styles.emptySub}>{t('no_active_requests')}</Text>
                        </FadeInView>
                    );
                }}
            />
        </MainBackground>
    );
}

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1 },
    header: {
        paddingTop: 60,
        paddingHorizontal: t.spacing['2xl'],
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: t.spacing['2xl']
    },
    headerSub: { color: t.brand.primary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 2 },
    headerTitle: { color: t.text.primary, fontSize: 32, fontWeight: '900', letterSpacing: t.typography.tracking.hero },
    viewModeToggle: { flexDirection: 'row', backgroundColor: t.background.surfaceRaised, borderRadius: t.radius.lg, padding: 4, gap: 4 },
    modeBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: t.radius.md, alignItems: 'center', position: 'relative' },
    modeBtnActive: { backgroundColor: t.background.surface },
    modeTxt: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1 },
    modeTxtActive: { color: t.text.primary },
    modeIndicator: { position: 'absolute', bottom: 2, width: 12, height: 3, borderRadius: 2, backgroundColor: t.brand.primary },

    stickyHeader: { gap: t.spacing.lg, paddingBottom: t.spacing.md },
    filterList: { paddingHorizontal: t.spacing['2xl'], gap: t.spacing.md },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: t.radius.full,
        backgroundColor: t.background.surface,
        borderWidth: 1,
        borderColor: t.background.surface
    },
    filterChipActive: { backgroundColor: t.brand.primary, borderColor: t.brand.primary },
    filterTxt: { color: t.text.tertiary, fontSize: 9, fontWeight: t.typography.weight.bold, letterSpacing: 1 },
    filterTxtActive: { color: t.background.app },

    sortBar: {
        flexDirection: 'row',
        marginHorizontal: t.spacing['2xl'],
        backgroundColor: t.background.surface,
        borderRadius: t.radius.lg,
        padding: 4,
        gap: 4
    },
    sortChip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: t.radius.md },
    sortChipActive: { backgroundColor: t.background.surfaceRaised },
    sortTxt: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1 },
    sortTxtActive: { color: t.brand.primary },

    listContent: { padding: t.spacing['2xl'], paddingBottom: 120, gap: t.spacing.lg, flexGrow: 1 },
    jobCard: { padding: t.spacing['2xl'], gap: t.spacing.lg, backgroundColor: t.background.surface, borderWidth: 1, borderColor: t.background.surface },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    catBox: { backgroundColor: t.brand.primary + '11', paddingHorizontal: 10, paddingVertical: 4, borderRadius: t.radius.md },
    catBoxCustom: { backgroundColor: t.status.warning.base + '15' },
    catTxt: { color: t.brand.primary, fontSize: 10, fontWeight: t.typography.weight.bold, textTransform: 'uppercase' },
    catTxtCustom: { color: t.status.warning.dark },
    timeTxt: { color: t.text.tertiary, fontSize: 9, fontWeight: t.typography.weight.medium },

    jobTitleTxt: { color: t.text.primary, fontSize: t.typography.size.cardTitle, fontWeight: t.typography.weight.bold, marginBottom: t.spacing.sm },
    descTxt: { color: t.text.primary, fontSize: t.typography.size.body, fontStyle: 'italic', opacity: 0.9, lineHeight: 22 },

    statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 },
    statLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statIcon: { fontSize: 14 },
    statTxt: { color: t.text.secondary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.medium },

    rewardBox: { alignItems: 'flex-end', gap: 2 },
    rewardLabel: { color: t.brand.primary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1 },
    rewardVal: { color: t.text.primary, fontSize: 24, fontWeight: '900' },

    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: t.spacing.lg,
        borderTopWidth: 1,
        borderTopColor: t.background.surfaceRaised
    },
    clientLabel: { color: t.text.tertiary, fontSize: 9, fontWeight: t.typography.weight.medium },
    viewMore: { color: t.brand.primary, fontSize: 9, fontWeight: t.typography.weight.bold, letterSpacing: 1 },

    offlineScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: t.spacing[40] },
    offlineContent: { alignItems: 'center', gap: t.spacing.lg },
    offlineIcon: { fontSize: 64, marginBottom: 8 },
    offlineTitle: { color: t.text.primary, fontSize: 24, fontWeight: '900', textAlign: 'center' },
    offlineSub: { color: t.text.tertiary, fontSize: t.typography.size.body, textAlign: 'center', lineHeight: 24 },

    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100, gap: 12 },
    emptyIcon: { fontSize: 48, marginBottom: 8 },
    emptyTitle: { color: t.text.primary, fontSize: 20, fontWeight: t.typography.weight.bold },
    emptySub: { color: t.text.tertiary, fontSize: t.typography.size.caption, textAlign: 'center', paddingHorizontal: t.spacing[40], lineHeight: 20 }
});
