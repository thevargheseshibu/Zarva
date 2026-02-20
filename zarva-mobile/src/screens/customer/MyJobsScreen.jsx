import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { colors, spacing } from '../../design-system/tokens';
import Card from '../../components/Card';
import StatusPill from '../../components/StatusPill';

const MOCK_JOBS = [
    { id: 1, category: 'Plumber', status: 'completed', date: 'Feb 18' },
    { id: 2, category: 'Electrician', status: 'assigned', date: 'Feb 20' },
];

export default function MyJobsScreen() {
    return (
        <View style={styles.screen}>
            <Text style={styles.header}>My Jobs</Text>
            <FlatList
                data={MOCK_JOBS}
                keyExtractor={(i) => String(i.id)}
                contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
                renderItem={({ item }) => (
                    <Card>
                        <Text style={styles.cat}>{item.category}</Text>
                        <Text style={styles.date}>{item.date}</Text>
                        <StatusPill status={item.status} style={{ marginTop: spacing.xs }} />
                    </Card>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary },
    header: { color: colors.text.primary, fontSize: 22, fontWeight: '700', padding: spacing.lg, paddingBottom: 0 },
    cat: { color: colors.text.primary, fontSize: 16, fontWeight: '600' },
    date: { color: colors.text.secondary, fontSize: 13, marginTop: 2 },
});
