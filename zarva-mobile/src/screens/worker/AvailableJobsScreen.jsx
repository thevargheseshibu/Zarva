import React, { useState, useCallback, useMemo } from 'react';
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
import { colors, radius, spacing, shadows } from '../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../design-system/typography';
import { haversineKm, formatDistance } from '../../utils/distance';
import { parseJobDescription } from '../../utils/jobParser';

dayjs.extend(relativeTime);

export default function AvailableJobsScreen({ navigation }) {
    const t = useT();
    const [filter, setFilter] = useState('All');
    const [sortBy, setSortBy] = useState('Nearest');
    const [categories, setCategories] = useState(['All']);
    const [refreshing, setRefreshing] = useState(false);
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const { locationOverride } = useWorkerStore();
    const [isOnline, setIsOnline] = useState(true);
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
            setIsOnline(res.data?.is_online);
            setKycError(false);

            let rawJobs = res.data?.jobs || [];
            if (currentLoc) {
                rawJobs = rawJobs.map(job => {
                    if (job.latitude && job.longitude) {
                        return { ...job, dist: haversineKm(currentLoc.lat, currentLoc.lng, job.latitude, job.longitude) };
                    }
                    return job;
                });
                rawJobs.sort((a, b) => (a.dist || 999) - (b.dist || 999));
            }
            setJobs(rawJobs);
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
        let result = jobs.filter(j => {
            if (filter === 'All') return true;
            return j.category?.toLowerCase() === filter.toLowerCase();
        });
        if (sortBy === 'Nearest') result.sort((a, b) => (a.dist || 999) - (b.dist || 999));
        else if (sortBy === 'Latest') result.sort((a, b) => new Date(b.time) - new Date(a.time));
        else if (sortBy === 'Reward') result.sort((a, b) => (parseFloat(b.total_amount) || 0) - (parseFloat(a.total_amount) || 0));
        return result;
    }, [jobs, filter, sortBy]);

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
                            <View style={styles.catBox}>
                                <Text style={styles.catTxt}>{item.category || 'Professional Service'}</Text>
                            </View>
                            <Text style={styles.timeTxt}>{dayjs(item.time).fromNow()}</Text>
                        </View>

                        <Text style={styles.descTxt} numberOfLines={2}>"{descText}"</Text>

                        <View style={styles.statsRow}>
                            <View style={styles.statLine}>
                                <Text style={styles.statIcon}>📍</Text>
                                <Text style={styles.statTxt}>{formatDistance(item.dist) || '—'} away</Text>
                            </View>
                            <View style={styles.rewardBox}>
                                <Text style={styles.rewardLabel}>EST. PAYOUT</Text>
                                <Text style={styles.rewardVal}>₹{parseFloat(item.total_amount || 0).toFixed(0)}</Text>
                            </View>
                        </View>

                        <View style={styles.cardFooter}>
                            <Text style={styles.clientLabel}>Requested by {item.customer_name?.split(' ')[0]}</Text>
                            <Text style={styles.viewMore}>ACQUIRE REQUEST ›</Text>
                        </View>
                    </Card>
                </PressableAnimated>
            </FadeInView>
        );
    };

    if (!isOnline) {
        return (
            <View style={styles.offlineScreen}>
                <FadeInView delay={100} style={styles.offlineContent}>
                    <Text style={styles.offlineIcon}>🌘</Text>
                    <Text style={styles.offlineTitle}>Currently Inactive</Text>
                    <Text style={styles.offlineSub}>Go online from your dashboard to witness and accept incoming job requests.</Text>
                </FadeInView>
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerSub}>AVAILABLE OPPORTUNITIES</Text>
                    <Text style={styles.headerTitle}>Marketplace</Text>
                </View>
                <View style={styles.countBadge}>
                    <Text style={styles.countTxt}>{jobs.length}</Text>
                </View>
            </View>

            {/* Filters */}
            <View style={styles.stickyHeader}>
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

                <View style={styles.sortBar}>
                    {['Nearest', 'Latest', 'Reward'].map(opt => {
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
                                <Text style={[styles.sortTxt, active && styles.sortTxtActive]}>{opt}</Text>
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
                        tintColor={colors.accent.primary}
                    />
                }
                ListEmptyComponent={() => {
                    if (loading) return (
                        <View style={styles.emptyContainer}>
                            <ActivityIndicator size="large" color={colors.accent.primary} />
                        </View>
                    );
                    return (
                        <FadeInView delay={200} style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>💎</Text>
                            <Text style={styles.emptyTitle}>All caught up!</Text>
                            <Text style={styles.emptySub}>No active requests matching your criteria. We'll notify you as soon as a new opportunity arises.</Text>
                        </FadeInView>
                    );
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
        paddingTop: 60,
        paddingHorizontal: spacing[24],
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: spacing[24]
    },
    headerSub: { color: colors.accent.primary, fontSize: 8, fontWeight: fontWeight.bold, letterSpacing: 2 },
    headerTitle: { color: colors.text.primary, fontSize: 32, fontWeight: '900', letterSpacing: tracking.hero },
    countBadge: {
        backgroundColor: colors.accent.primary + '11',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.accent.border + '22'
    },
    countTxt: { color: colors.accent.primary, fontSize: fontSize.body, fontWeight: fontWeight.bold },

    stickyHeader: { gap: spacing[16], paddingBottom: spacing[12] },
    filterList: { paddingHorizontal: spacing[24], gap: spacing[12] },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: radius.full,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surface
    },
    filterChipActive: { backgroundColor: colors.accent.primary, borderColor: colors.accent.primary },
    filterTxt: { color: colors.text.muted, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 1 },
    filterTxtActive: { color: colors.background },

    sortBar: {
        flexDirection: 'row',
        marginHorizontal: spacing[24],
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: 4,
        gap: 4
    },
    sortChip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.md },
    sortChipActive: { backgroundColor: colors.elevated },
    sortTxt: { color: colors.text.muted, fontSize: 8, fontWeight: fontWeight.bold, letterSpacing: 1 },
    sortTxtActive: { color: colors.accent.primary },

    listContent: { padding: spacing[24], paddingBottom: 120, gap: spacing[16], flexGrow: 1 },
    jobCard: { padding: spacing[24], gap: spacing[16], backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surface },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    catBox: { backgroundColor: colors.accent.primary + '11', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.md },
    catTxt: { color: colors.accent.primary, fontSize: 10, fontWeight: fontWeight.bold, textTransform: 'uppercase' },
    timeTxt: { color: colors.text.muted, fontSize: 9, fontWeight: fontWeight.medium },

    descTxt: { color: colors.text.primary, fontSize: fontSize.body, fontStyle: 'italic', opacity: 0.9, lineHeight: 22 },

    statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 },
    statLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statIcon: { fontSize: 14 },
    statTxt: { color: colors.text.secondary, fontSize: fontSize.caption, fontWeight: fontWeight.medium },

    rewardBox: { alignItems: 'flex-end', gap: 2 },
    rewardLabel: { color: colors.accent.primary, fontSize: 8, fontWeight: fontWeight.bold, letterSpacing: 1 },
    rewardVal: { color: colors.text.primary, fontSize: 24, fontWeight: '900' },

    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: spacing[16],
        borderTopWidth: 1,
        borderTopColor: colors.elevated
    },
    clientLabel: { color: colors.text.muted, fontSize: 9, fontWeight: fontWeight.medium },
    viewMore: { color: colors.accent.primary, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 1 },

    offlineScreen: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: spacing[40] },
    offlineContent: { alignItems: 'center', gap: spacing[16] },
    offlineIcon: { fontSize: 64, marginBottom: 8 },
    offlineTitle: { color: colors.text.primary, fontSize: 24, fontWeight: '900', textAlign: 'center' },
    offlineSub: { color: colors.text.muted, fontSize: fontSize.body, textAlign: 'center', lineHeight: 24 },

    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100, gap: 12 },
    emptyIcon: { fontSize: 48, marginBottom: 8 },
    emptyTitle: { color: colors.text.primary, fontSize: 20, fontWeight: fontWeight.bold },
    emptySub: { color: colors.text.muted, fontSize: fontSize.caption, textAlign: 'center', paddingHorizontal: spacing[40], lineHeight: 20 }
});
