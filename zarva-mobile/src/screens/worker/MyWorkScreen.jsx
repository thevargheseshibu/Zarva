import React, { useState, useCallback, useMemo } from 'react';
import { useTokens } from '../../design-system';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import dayjs from 'dayjs';
import { useT } from '../../hooks/useT';
import apiClient from '@infra/api/client';
import FadeInView from '../../components/FadeInView';
import Card from '../../components/Card';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import StatusPill from '../../components/StatusPill';
import MainBackground from '../../components/MainBackground';



export default function MyWorkScreen({ navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const FILTERS = [t('filter_all'), t('filter_active'), t('filter_completed'), t('filter_cancelled'), t('filter_disputed')];
    const [filter, setFilter] = useState(t('filter_all'));
    const [sortBy, setSortBy] = useState('Latest');
    const [refreshing, setRefreshing] = useState(false);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchHistory = async () => {
        try {
            const res = await apiClient.get('/api/worker/history');
            setHistory(res.data?.history || []);
        } catch (err) {
            console.error('Failed to fetch history:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchHistory();
        }, [])
    );

    const filtered = useMemo(() => {
        let result = history.filter(h => {
            if (filter === t('filter_all')) return true;
            if (filter === t('filter_active')) return ['assigned', 'worker_en_route', 'worker_arrived', 'inspection_active', 'estimate_submitted', 'in_progress', 'pause_requested', 'resume_requested', 'pending_completion'].includes(h.status);

            // Map the localized filter back to internal status
            const filterToStatus = {
                [t('filter_completed')]: 'completed',
                [t('filter_cancelled')]: 'cancelled',
                [t('filter_disputed')]: 'disputed'
            };
            return h.status === filterToStatus[filter];
        });

        if (sortBy === 'Latest') {
            result.sort((a, b) => new Date(b.date || b.created_at || b.time || 0) - new Date(a.date || a.created_at || a.time || 0));
        } else if (sortBy === 'Oldest') {
            result.sort((a, b) => new Date(a.date || a.created_at || a.time || 0) - new Date(b.date || b.created_at || b.time || 0));
        } else if (sortBy === 'Premium') {
            result.sort((a, b) => (parseFloat(b.total_amount || b.amount) || 0) - (parseFloat(a.total_amount || a.amount) || 0));
        }

        return result;
    }, [history, filter, sortBy]);

    const stats = useMemo(() => {
        const completed = history.filter(h => h.status === 'completed');
        const revenue = completed.reduce((acc, curr) => acc + (parseFloat(curr.amount || curr.total_amount) || 0), 0);
        return {
            count: completed.length,
            revenue: revenue.toFixed(0)
        };
    }, [history]);

    const onRefresh = () => {
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        fetchHistory();
    };

    const handlePress = (item) => {
        Haptics.selectionAsync();
        navigation.navigate('ActiveJob', { jobId: item.id });
    };

    const renderItem = ({ item, index }) => (
        <FadeInView delay={index * 50}>
            <PressableAnimated onPress={() => handlePress(item)}>
                <Card style={styles.historyCard}>
                    <View style={styles.cardTop}>
                        <View style={styles.catBox}>
                            <Text style={styles.catTxt}>{t(`cat_${item.category}`, { defaultValue: item.category || t('cat_service') })}</Text>
                        </View>
                        <Text style={styles.amtTxt}>₹{item.amount || item.total_amount}</Text>
                    </View>

                    <View style={styles.cardMid}>
                        <Text style={styles.addressTxt} numberOfLines={1}>📍 {item.address}</Text>
                        <Text style={styles.dateTxt}>{dayjs(item.date).format('MMM D, h:mm A')}</Text>
                    </View>

                    <View style={styles.cardBottom}>
                        <View style={styles.clientInfo}>
                            <View style={styles.clientAvatar}>
                                <Text style={styles.avatarTxt}>{item.customer_name?.charAt(0) || 'C'}</Text>
                            </View>
                            <Text style={styles.clientName}>{item.customer_name?.split(' ')[0]}</Text>
                        </View>
                        <StatusPill status={item.status} />
                    </View>
                </Card>
            </PressableAnimated>
        </FadeInView>
    );

    return (
        <MainBackground>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerSub}>{t('mission_tracker')}</Text>
                    <Text style={styles.headerTitle}>{t('professional_history')}</Text>
                </View>
            </View>

            {/* Performance Bar */}
            <FadeInView delay={100} style={styles.statsBar}>
                <View style={styles.statBox}>
                    <Text style={styles.statVal}>{stats.count}</Text>
                    <Text style={styles.statLbl}>{t('completed_badge')}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                    <Text style={styles.statVal}>₹{stats.revenue}</Text>
                    <Text style={styles.statLbl}>{t('lifetime_payout')}</Text>
                </View>
            </FadeInView>

            <View style={styles.filterSection}>
                <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={FILTERS}
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

                <View style={styles.sortSection}>
                    {['Latest', 'Premium', 'Oldest'].map(opt => {
                        const active = sortBy === opt;
                        const optLabel = opt === 'Latest' ? t('sort_latest') : opt === 'Oldest' ? t('sort_oldest') : t('sort_premium');
                        return (
                            <TouchableOpacity
                                key={opt}
                                style={[styles.sortChip, active && styles.sortChipActive]}
                                onPress={() => {
                                    setSortBy(opt);
                                    Haptics.selectionAsync();
                                }}
                            >
                                <Text style={[styles.sortTxt, active && styles.sortTxtActive]}>{optLabel}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            <FlatList
                data={filtered}
                keyExtractor={i => String(i.id)}
                contentContainerStyle={styles.listContent}
                renderItem={renderItem}
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
                            <ActivityIndicator color={tTheme.brand.primary} />
                        </View>
                    );
                    return (
                        <FadeInView delay={200} style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>📂</Text>
                            <Text style={styles.emptyTitle}>{t('archive_empty')}</Text>
                            <Text style={styles.emptySub}>
                                {filter === t('filter_all')
                                    ? t('not_initiated')
                                    : t('no_entries_found')}
                            </Text>
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
        paddingBottom: t.spacing.lg
    },
    headerSub: { color: t.brand.primary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 2 },
    headerTitle: { color: t.text.primary, fontSize: 24, fontWeight: '900', letterSpacing: t.typography.tracking.title },

    statsBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: t.background.surface,
        marginHorizontal: t.spacing['2xl'],
        padding: t.spacing[20],
        borderRadius: t.radius.xl,
        borderWidth: 1,
        borderColor: t.border.default + '11',
        marginBottom: t.spacing['2xl']
    },
    statBox: { flex: 1, alignItems: 'center', gap: 4 },
    statVal: { color: t.text.primary, fontSize: 18, fontWeight: t.typography.weight.bold },
    statLbl: { color: t.brand.primary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1 },
    statDivider: { width: 1, height: 24, backgroundColor: t.background.surfaceRaised, opacity: 0.5 },

    filterSection: { gap: t.spacing.md, marginBottom: t.spacing.lg },
    filterList: { paddingHorizontal: t.spacing['2xl'], gap: 10 },
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

    sortSection: {
        flexDirection: 'row',
        marginHorizontal: t.spacing['2xl'],
        backgroundColor: t.background.surface,
        padding: 4,
        borderRadius: t.radius.lg,
        gap: 4
    },
    sortChip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: t.radius.md },
    sortChipActive: { backgroundColor: t.background.surfaceRaised },
    sortTxt: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1 },
    sortTxtActive: { color: t.brand.primary },

    listContent: { padding: t.spacing['2xl'], paddingBottom: 120, gap: t.spacing.lg },
    historyCard: { padding: t.spacing[20], gap: t.spacing.lg, backgroundColor: t.background.surface, borderWidth: 1, borderColor: t.background.surface },

    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    catBox: { backgroundColor: t.brand.primary + '11', paddingHorizontal: 10, paddingVertical: 4, borderRadius: t.radius.md },
    catTxt: { color: t.brand.primary, fontSize: 10, fontWeight: t.typography.weight.bold, textTransform: 'uppercase' },
    amtTxt: { color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.bold },

    cardMid: { gap: 4 },
    addressTxt: { color: t.text.secondary, fontSize: 13, fontWeight: t.typography.weight.medium },
    dateTxt: { color: t.text.tertiary, fontSize: 9, fontWeight: t.typography.weight.medium },

    cardBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: t.background.surfaceRaised
    },
    clientInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    clientAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: t.background.surfaceRaised, justifyContent: 'center', alignItems: 'center' },
    avatarTxt: { color: t.text.tertiary, fontSize: 10, fontWeight: 'bold' },
    clientName: { color: t.text.tertiary, fontSize: 9, fontWeight: t.typography.weight.bold, letterSpacing: 0.5 },

    emptyContainer: { padding: 40, alignItems: 'center', gap: 12 },
    emptyIcon: { fontSize: 40, marginBottom: 8 },
    emptyTitle: { color: t.text.primary, fontSize: 18, fontWeight: t.typography.weight.bold },
    emptySub: { color: t.text.tertiary, fontSize: 13, textAlign: 'center', lineHeight: 20 }
});
