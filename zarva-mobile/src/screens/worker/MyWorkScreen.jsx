import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import dayjs from 'dayjs';
import { useT } from '../../hooks/useT';
import apiClient from '../../services/api/client';
import FadeInView from '../../components/FadeInView';
import Card from '../../components/Card';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import StatusPill from '../../components/StatusPill';
import { colors, radius, spacing, shadows } from '../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../design-system/typography';

const FILTERS = ['All', 'Active', 'Completed', 'Cancelled', 'Disputed'];

export default function MyWorkScreen({ navigation }) {
    const t = useT();
    const [filter, setFilter] = useState('All');
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
            if (filter === 'All') return true;
            if (filter === 'Active') return ['assigned', 'worker_en_route', 'worker_arrived', 'in_progress', 'pending_completion'].includes(h.status);
            return h.status === filter.toLowerCase();
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
                            <Text style={styles.catTxt}>{item.category || 'Service'}</Text>
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
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerSub}>MISSION TRACKER</Text>
                    <Text style={styles.headerTitle}>Professional History</Text>
                </View>
            </View>

            {/* Performance Bar */}
            <FadeInView delay={100} style={styles.statsBar}>
                <View style={styles.statBox}>
                    <Text style={styles.statVal}>{stats.count}</Text>
                    <Text style={styles.statLbl}>COMPLETED</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                    <Text style={styles.statVal}>₹{stats.revenue}</Text>
                    <Text style={styles.statLbl}>LIFETIME PAYOUT</Text>
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
                data={filtered}
                keyExtractor={i => String(i.id)}
                contentContainerStyle={styles.listContent}
                renderItem={renderItem}
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
                            <ActivityIndicator color={colors.accent.primary} />
                        </View>
                    );
                    return (
                        <FadeInView delay={200} style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>📂</Text>
                            <Text style={styles.emptyTitle}>Archive Empty</Text>
                            <Text style={styles.emptySub}>
                                {filter === 'All'
                                    ? 'You have not initiated any missions yet. Success awaits in the marketplace.'
                                    : `No ${filter.toLowerCase()} entries found in your professional record.`}
                            </Text>
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
        paddingBottom: spacing[16]
    },
    headerSub: { color: colors.accent.primary, fontSize: 8, fontWeight: fontWeight.bold, letterSpacing: 2 },
    headerTitle: { color: colors.text.primary, fontSize: 24, fontWeight: '900', letterSpacing: tracking.title },

    statsBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        marginHorizontal: spacing[24],
        padding: spacing[20],
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.accent.border + '11',
        marginBottom: spacing[24]
    },
    statBox: { flex: 1, alignItems: 'center', gap: 4 },
    statVal: { color: colors.text.primary, fontSize: 18, fontWeight: fontWeight.bold },
    statLbl: { color: colors.accent.primary, fontSize: 8, fontWeight: fontWeight.bold, letterSpacing: 1 },
    statDivider: { width: 1, height: 24, backgroundColor: colors.elevated, opacity: 0.5 },

    filterSection: { gap: spacing[12], marginBottom: spacing[16] },
    filterList: { paddingHorizontal: spacing[24], gap: 10 },
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

    sortSection: {
        flexDirection: 'row',
        marginHorizontal: spacing[24],
        backgroundColor: colors.surface,
        padding: 4,
        borderRadius: radius.lg,
        gap: 4
    },
    sortChip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.md },
    sortChipActive: { backgroundColor: colors.elevated },
    sortTxt: { color: colors.text.muted, fontSize: 8, fontWeight: fontWeight.bold, letterSpacing: 1 },
    sortTxtActive: { color: colors.accent.primary },

    listContent: { padding: spacing[24], paddingBottom: 120, gap: spacing[16] },
    historyCard: { padding: spacing[20], gap: spacing[16], backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surface },

    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    catBox: { backgroundColor: colors.accent.primary + '11', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.md },
    catTxt: { color: colors.accent.primary, fontSize: 10, fontWeight: fontWeight.bold, textTransform: 'uppercase' },
    amtTxt: { color: colors.text.primary, fontSize: fontSize.body, fontWeight: fontWeight.bold },

    cardMid: { gap: 4 },
    addressTxt: { color: colors.text.secondary, fontSize: 13, fontWeight: fontWeight.medium },
    dateTxt: { color: colors.text.muted, fontSize: 9, fontWeight: fontWeight.medium },

    cardBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: colors.elevated
    },
    clientInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    clientAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.elevated, justifyContent: 'center', alignItems: 'center' },
    avatarTxt: { color: colors.text.muted, fontSize: 10, fontWeight: 'bold' },
    clientName: { color: colors.text.muted, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 0.5 },

    emptyContainer: { padding: 40, alignItems: 'center', gap: 12 },
    emptyIcon: { fontSize: 40, marginBottom: 8 },
    emptyTitle: { color: colors.text.primary, fontSize: 18, fontWeight: fontWeight.bold },
    emptySub: { color: colors.text.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 }
});
