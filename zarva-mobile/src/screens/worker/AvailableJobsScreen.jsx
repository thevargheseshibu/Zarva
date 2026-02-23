import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../../design-system/tokens';
import Card from '../../components/Card';
import apiClient from '../../services/api/client';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { parseJobDescription } from '../../utils/jobParser';
import * as Location from 'expo-location';
import { haversineKm, formatDistance } from '../../utils/distance';

dayjs.extend(relativeTime);

export default function AvailableJobsScreen({ navigation }) {
    const [filter, setFilter] = useState('All');
    const [sortBy, setSortBy] = useState('Nearest');
    const [categories, setCategories] = useState(['All']);
    const [refreshing, setRefreshing] = useState(false);
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isOnline, setIsOnline] = useState(true);
    const [kycError, setKycError] = useState(false);

    const fetchJobs = async () => {
        try {
            // Get current location once
            let currentLoc = null;
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                currentLoc = { lat: location.coords.latitude, lng: location.coords.longitude };
            }

            const res = await apiClient.get('/api/worker/available-jobs');
            setIsOnline(res.data?.is_online);
            setKycError(false);

            let rawJobs = res.data?.jobs || [];

            // Calculate distance for all jobs if location is available
            if (currentLoc) {
                rawJobs = rawJobs.map(job => {
                    if (job.latitude && job.longitude) {
                        return {
                            ...job,
                            dist: haversineKm(currentLoc.lat, currentLoc.lng, job.latitude, job.longitude)
                        };
                    }
                    return job;
                });

                // Sort by distance ascending
                rawJobs.sort((a, b) => (a.dist || 999) - (b.dist || 999));
            }

            setJobs(rawJobs);
        } catch (err) {
            if (err.response?.status === 403) {
                setKycError(true);
                setJobs([]);
            } else {
                console.warn('Failed to fetch available jobs:', err.message);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchJobs();

            // Also fetch categories
            apiClient.get('/api/jobs/config')
                .then(res => {
                    if (res.data?.categories) {
                        const dynamicCats = Object.values(res.data.categories).map(c => c.label);
                        setCategories(['All', ...dynamicCats]);
                    }
                })
                .catch(err => console.error('Failed to fetch categories for filtering', err));
        }, [])
    );

    const sortedAndFilteredJobs = useMemo(() => {
        let result = jobs.filter(j => {
            if (filter === 'All') return true;
            return j.category?.toLowerCase() === filter.toLowerCase();
        });

        if (sortBy === 'Nearest') {
            result.sort((a, b) => (a.dist || 999) - (b.dist || 999));
        } else if (sortBy === 'Latest') {
            result.sort((a, b) => new Date(b.time) - new Date(a.time));
        } else if (sortBy === 'Price: High to Low') {
            result.sort((a, b) => (parseFloat(b.total_amount) || 0) - (parseFloat(a.total_amount) || 0));
        } else if (sortBy === 'Price: Low to High') {
            result.sort((a, b) => (parseFloat(a.total_amount) || 0) - (parseFloat(b.total_amount) || 0));
        }

        return result;
    }, [jobs, filter, sortBy]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchJobs();
    };

    if (!isOnline) {
        return (
            <View style={styles.offlineScreen}>
                <Text style={styles.offlineIcon}>💤</Text>
                <Text style={styles.offlineTitle}>You are Offline</Text>
                <Text style={styles.offlineText}>Go online from the Home screen to see active jobs near you.</Text>
            </View>
        );
    }

    const renderJob = ({ item }) => {
        const { text: descText } = parseJobDescription(item.desc);

        return (
            <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('JobDetailPreview', { job: item })}>
                <Card glow style={styles.jobCard}>
                    <View style={styles.cardHeader}>
                        <View style={styles.catRow}>
                            <Text style={styles.catIcon}>{item.icon}</Text>
                            <Text style={styles.catName}>{item.category || 'Service'}</Text>
                        </View>
                        <Text style={styles.timeTxt}>{dayjs(item.time).fromNow()}</Text>
                    </View>

                    <View style={styles.distRow}>
                        <Text style={styles.distTxt}>📍 {formatDistance(item.dist) || '—'} away • Wave {item.wave_number || 1}</Text>
                        <Text style={styles.estTxt}>Est: ₹{parseFloat(item.total_amount || 0).toFixed(0)}</Text>
                    </View>

                    <Text style={styles.descTxt} numberOfLines={2}>"{descText}"</Text>

                    <View style={styles.actionRow}>
                        <Text style={styles.customerName}>📝 {item.customer_name}</Text>
                        <Text style={styles.viewTxt}>View Details →</Text>
                    </View>
                </Card>
            </TouchableOpacity>
        );
    };

    const renderEmpty = () => {
        if (loading) return <ActivityIndicator size="large" color={colors.gold.primary} style={{ marginTop: spacing.xl * 2 }} />;

        if (kycError) {
            return (
                <View style={styles.emptyWrap}>
                    <Text style={styles.emptyIcon}>⏳</Text>
                    <Text style={styles.emptyTitle}>Verification Required</Text>
                    <Text style={styles.emptySub}>
                        Your profile is currently under review or incomplete. Once your account is verified by our team, you will start receiving job requests here.
                    </Text>
                </View>
            );
        }

        return (
            <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyTitle}>No Jobs Right Now</Text>
                <Text style={styles.emptySub}>
                    {filter === 'All'
                        ? 'There are currently no new open service requests in your area. We will notify you when one arrives.'
                        : `No nearby customers are requesting ${filter} services at the moment.`}
                </Text>
            </View>
        );
    };

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <Text style={styles.title}>Jobs Near You</Text>
            </View>

            <View style={styles.filterWrap}>
                <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={categories}
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

            <View style={styles.sortWrap}>
                <Text style={styles.sortLabel}>Sort by:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortList}>
                    {['Nearest', 'Latest', 'Price: High to Low', 'Price: Low to High'].map(opt => (
                        <TouchableOpacity
                            key={opt}
                            style={[styles.sortChip, sortBy === opt && styles.sortChipActive]}
                            onPress={() => setSortBy(opt)}
                        >
                            <Text style={[styles.sortChipTxt, sortBy === opt && styles.sortChipTxtActive]}>{opt}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <FlatList
                data={sortedAndFilteredJobs}
                keyExtractor={i => String(i.id)}
                contentContainerStyle={styles.list}
                renderItem={renderJob}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold.primary} colors={[colors.gold.primary]} />}
                ListEmptyComponent={renderEmpty}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary },
    header: { paddingTop: spacing.xl + 20, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
    title: { color: colors.text.primary, fontSize: 24, fontWeight: '800' },

    // Offline
    offlineScreen: { flex: 1, backgroundColor: colors.bg.primary, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
    offlineIcon: { fontSize: 48, marginBottom: spacing.md },
    offlineTitle: { color: colors.text.primary, fontSize: 22, fontWeight: '700', marginBottom: spacing.sm },
    offlineText: { color: colors.text.secondary, fontSize: 15, textAlign: 'center' },

    // Filters
    filterWrap: { borderBottomWidth: 1, borderBottomColor: colors.bg.surface, paddingBottom: spacing.sm },
    filterList: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: 'center' },
    chip: {
        paddingHorizontal: spacing.md, paddingVertical: 8,
        borderRadius: radius.full, backgroundColor: colors.bg.surface,
        borderWidth: 1, borderColor: colors.bg.surface
    },
    chipActive: { backgroundColor: colors.gold.glow, borderColor: colors.gold.primary },
    chipText: { color: colors.text.secondary, fontSize: 13, fontWeight: '600' },
    chipTextActive: { color: colors.gold.primary },

    sortWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    sortLabel: { color: colors.text.muted, fontSize: 13, fontWeight: '600' },
    sortList: { gap: spacing.sm, paddingRight: spacing.xl },
    sortChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.bg.surface, backgroundColor: colors.bg.elevated },
    sortChipActive: { borderColor: colors.gold.primary, backgroundColor: colors.gold.glow },
    sortChipTxt: { color: colors.text.secondary, fontSize: 12, fontWeight: '600' },
    sortChipTxtActive: { color: colors.gold.primary, fontWeight: '700' },

    // List
    list: { padding: spacing.lg, gap: spacing.lg, flexGrow: 1 },
    jobCard: { gap: spacing.sm },

    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    catRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    catIcon: { fontSize: 16 },
    catName: { color: colors.text.primary, fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
    timeTxt: { color: colors.text.muted, fontSize: 12 },

    distRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
    distTxt: { color: colors.text.secondary, fontSize: 13 },
    estTxt: { color: colors.gold.primary, fontSize: 14, fontWeight: '800' },

    descTxt: { color: colors.text.muted, fontSize: 14, fontStyle: 'italic', marginVertical: spacing.xs },

    actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.bg.surface, paddingTop: spacing.sm },
    customerName: { color: colors.text.secondary, fontSize: 13, fontWeight: '600' },
    viewTxt: { color: colors.gold.primary, fontSize: 13, fontWeight: '700' },

    emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: spacing.xl * 3 },
    emptyIcon: { fontSize: 48, marginBottom: spacing.md },
    emptyTitle: { color: colors.text.primary, fontSize: 20, fontWeight: '700', marginBottom: spacing.xs },
    emptySub: { color: colors.text.muted, fontSize: 14, textAlign: 'center', paddingHorizontal: spacing.xl, lineHeight: 22 }
});
