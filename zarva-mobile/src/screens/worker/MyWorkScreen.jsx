import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../../design-system/tokens';
import Card from '../../components/Card';
import StatusPill from '../../components/StatusPill';
import apiClient from '../../services/api/client';
import dayjs from 'dayjs';

const FILTERS = ['All', 'Completed', 'Cancelled', 'Disputed'];

export default function MyWorkScreen({ navigation }) {
    const [filter, setFilter] = useState('All');
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

    const filtered = filter === 'All' ? history : history.filter(h => h.status === filter.toLowerCase());

    const onRefresh = () => {
        setRefreshing(true);
        fetchHistory();
    };

    const renderItem = ({ item }) => (
        <Card style={styles.historyCard}>
            <View style={styles.cardHeader}>
                <Text style={styles.catTxt}>{item.category || 'Service'}</Text>
                <Text style={styles.amountTxt}>{item.amount}</Text>
            </View>
            <Text style={styles.addressTxt} numberOfLines={1}>📍 {item.address}</Text>

            <View style={styles.footerRow}>
                <Text style={styles.dateTxt}>{dayjs(item.date).format('MMM D, h:mm A')}</Text>
                <StatusPill status={item.status} />
            </View>
        </Card>
    );

    const renderEmpty = () => {
        if (loading) return <ActivityIndicator size="large" color={colors.gold.primary} style={{ marginTop: spacing.xl * 2 }} />;
        return (
            <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>📉</Text>
                <Text style={styles.emptyTitle}>No History Found</Text>
                <Text style={styles.emptySub}>
                    {filter === 'All'
                        ? 'You have not completed any jobs yet. Head over to Available Jobs to find work!'
                        : `You have no ${filter.toLowerCase()} jobs to display.`}
                </Text>
            </View>
        );
    };

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <Text style={styles.title}>Work History</Text>
            </View>

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
                keyExtractor={i => String(i.id)}
                contentContainerStyle={styles.list}
                renderItem={renderItem}
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

    // List
    list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
    historyCard: { padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.bg.elevated },

    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    catTxt: { color: colors.text.primary, fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
    amountTxt: { color: colors.success, fontSize: 16, fontWeight: '800' },

    addressTxt: { color: colors.text.secondary, fontSize: 14 },

    footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
    dateTxt: { color: colors.text.muted, fontSize: 12 },

    emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: spacing.xl * 3 },
    emptyIcon: { fontSize: 48, marginBottom: spacing.md },
    emptyTitle: { color: colors.text.primary, fontSize: 20, fontWeight: '700', marginBottom: spacing.xs },
    emptySub: { color: colors.text.muted, fontSize: 14, textAlign: 'center', paddingHorizontal: spacing.xl, lineHeight: 22 }
});
