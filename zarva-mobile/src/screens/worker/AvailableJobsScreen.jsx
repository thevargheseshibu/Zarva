import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { colors, spacing } from '../../design-system/tokens';
import WorkerCard from '../../components/WorkerCard';

const MOCK_WORKERS = [
    { id: 1, name: 'Rajan P', category: 'plumber', avg_rating: 4.8 },
    { id: 2, name: 'Suresh M', category: 'electrician', avg_rating: 4.5 },
];

export default function AvailableJobsScreen() {
    return (
        <View style={styles.screen}>
            <Text style={styles.header}>Available Jobs</Text>
            <FlatList
                data={MOCK_WORKERS}
                keyExtractor={(i) => String(i.id)}
                contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
                renderItem={({ item }) => (
                    <WorkerCard worker={item} distance={3.2} />
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary },
    header: { color: colors.text.primary, fontSize: 22, fontWeight: '700', padding: spacing.lg, paddingBottom: 0 },
});
