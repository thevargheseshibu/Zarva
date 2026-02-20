import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { colors, spacing, radius } from '../../design-system/tokens';
import Card from '../../components/Card';

const CATEGORIES = ['All', 'Electrician', 'Plumber', 'Carpenter', 'AC Repair', 'Painter', 'Cleaning'];

export default function AvailableJobsScreen({ navigation }) {
    const [filter, setFilter] = useState('All');
    const [refreshing, setRefreshing] = useState(false);

    // DEV MOCK STATE
    const isOnline = true; // In real app, fetch from authStore/workerStore

    const mockJobs = [
        { id: 'job-1', category: 'Electrician', icon: '⚡', dist: '1.2', est: '₹300 - ₹500', desc: 'Ceiling fan making weird noise, needs minor repair.', time: '10m ago' },
        { id: 'job-2', category: 'Plumber', icon: '🔧', dist: '3.4', est: '₹800+', desc: 'Pipe broken under the kitchen sink. Water leaking fast.', time: '22m ago' },
        { id: 'job-3', category: 'Electrician', icon: '⚡', dist: '5.0', est: '₹200 - ₹400', desc: 'Need living room switchboard replaced completely.', time: '1h ago' },
    ];

    const filtered = filter === 'All' ? mockJobs : mockJobs.filter(j => j.category === filter);

    const onRefresh = () => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 800);
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

    const renderJob = ({ item }) => (
        <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('JobDetailPreview', { job: item })}>
            <Card glow style={styles.jobCard}>
                <View style={styles.cardHeader}>
                    <View style={styles.catRow}>
                        <Text style={styles.catIcon}>{item.icon}</Text>
                        <Text style={styles.catName}>{item.category}</Text>
                    </View>
                    <Text style={styles.timeTxt}>{item.time}</Text>
                </View>

                <View style={styles.distRow}>
                    <Text style={styles.distTxt}>📍 {item.dist} km away</Text>
                    <Text style={styles.estTxt}>Est: {item.est}</Text>
                </View>

                <Text style={styles.descTxt} numberOfLines={2}>"{item.desc}"</Text>

                <View style={styles.actionRow}>
                    <Text style={styles.viewTxt}>View Details →</Text>
                </View>
            </Card>
        </TouchableOpacity>
    );

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <Text style={styles.title}>Jobs Near You</Text>
            </View>

            <View style={styles.filterWrap}>
                <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={CATEGORIES}
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
                keyExtractor={i => i.id}
                contentContainerStyle={styles.list}
                renderItem={renderJob}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold.primary} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyWrap}>
                        <Text style={styles.emptyText}>No requests in this category right now.</Text>
                        <Text style={styles.emptySub}>We will notify you when a nearby customer posts a job.</Text>
                    </View>
                }
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
    filterList: { paddingHorizontal: spacing.lg, gap: spacing.sm },
    chip: {
        paddingHorizontal: spacing.md, paddingVertical: 8,
        borderRadius: radius.full, backgroundColor: colors.bg.surface,
        borderWidth: 1, borderColor: colors.bg.surface
    },
    chipActive: { backgroundColor: colors.gold.glow, borderColor: colors.gold.primary },
    chipText: { color: colors.text.secondary, fontSize: 13, fontWeight: '600' },
    chipTextActive: { color: colors.gold.primary },

    // List
    list: { padding: spacing.lg, gap: spacing.lg },
    jobCard: { gap: spacing.sm },

    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    catRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    catIcon: { fontSize: 16 },
    catName: { color: colors.text.primary, fontSize: 16, fontWeight: '700' },
    timeTxt: { color: colors.text.muted, fontSize: 12 },

    distRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
    distTxt: { color: colors.text.secondary, fontSize: 13 },
    estTxt: { color: colors.gold.primary, fontSize: 14, fontWeight: '800' },

    descTxt: { color: colors.text.muted, fontSize: 14, fontStyle: 'italic', marginVertical: spacing.xs },

    actionRow: { alignItems: 'flex-end', marginTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.bg.surface, paddingTop: spacing.sm },
    viewTxt: { color: colors.gold.primary, fontSize: 13, fontWeight: '700' },

    emptyWrap: { marginTop: spacing.xl * 2, alignItems: 'center', gap: spacing.sm },
    emptyText: { color: colors.text.secondary, fontSize: 15, fontWeight: '600' },
    emptySub: { color: colors.text.muted, fontSize: 13, textAlign: 'center' }
});
