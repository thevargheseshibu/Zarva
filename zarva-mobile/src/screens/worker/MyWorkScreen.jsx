import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { colors, spacing, radius } from '../../design-system/tokens';
import Card from '../../components/Card';
import StatusPill from '../../components/StatusPill';

const FILTERS = ['All', 'Completed', 'Cancelled', 'Disputed'];

export default function MyWorkScreen({ navigation }) {
    const [filter, setFilter] = useState('All');
    const [refreshing, setRefreshing] = useState(false);

    // Mock History
    const history = [
        { id: '101', category: 'Plumber', address: 'Kaloor, Kochi', amount: '₹1,200', date: 'Yesterday, 4:00 PM', status: 'completed' },
        { id: '102', category: 'Electrician', address: 'Edappally', amount: '₹400', date: 'Mon, 10:00 AM', status: 'completed' },
        { id: '103', category: 'AC Repair', address: 'Vytila', amount: '₹0', date: 'Sun, 2:00 PM', status: 'cancelled' },
    ];

    const filtered = filter === 'All' ? history : history.filter(h => h.status === filter.toLowerCase());

    const onRefresh = () => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 800);
    };

    const renderItem = ({ item }) => (
        <Card style={styles.historyCard}>
            <View style={styles.cardHeader}>
                <Text style={styles.catTxt}>{item.category}</Text>
                <Text style={styles.amountTxt}>{item.amount}</Text>
            </View>
            <Text style={styles.addressTxt} numberOfLines={1}>📍 {item.address}</Text>

            <View style={styles.footerRow}>
                <Text style={styles.dateTxt}>{item.date}</Text>
                <StatusPill status={item.status} />
            </View>
        </Card>
    );

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
                keyExtractor={i => i.id}
                contentContainerStyle={styles.list}
                renderItem={renderItem}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold.primary} />}
                ListEmptyComponent={<Text style={styles.emptyText}>No work history found.</Text>}
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
    list: { padding: spacing.lg, gap: spacing.md },
    historyCard: { padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.bg.elevated },

    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    catTxt: { color: colors.text.primary, fontSize: 16, fontWeight: '700' },
    amountTxt: { color: colors.success, fontSize: 16, fontWeight: '800' },

    addressTxt: { color: colors.text.secondary, fontSize: 14 },

    footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
    dateTxt: { color: colors.text.muted, fontSize: 12 },

    emptyText: { color: colors.text.muted, textAlign: 'center', marginTop: spacing.xl * 2 }
});
