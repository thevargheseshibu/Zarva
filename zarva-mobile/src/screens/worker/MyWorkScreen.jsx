import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../../design-system/tokens';
import Card from '../../components/Card';
import StatusPill from '../../components/StatusPill';

export default function MyWorkScreen() {
    return (
        <View style={styles.screen}>
            <Text style={styles.header}>My Work</Text>
            <Card glow style={styles.earningsCard}>
                <Text style={styles.label}>Today's Earnings</Text>
                <Text style={styles.amount}>₹ 0</Text>
            </Card>
            <Card style={styles.statusCard}>
                <Text style={styles.label}>Active Job</Text>
                <StatusPill status="assigned" style={{ marginTop: spacing.xs }} />
            </Card>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary, padding: spacing.lg, gap: spacing.md },
    header: { color: colors.text.primary, fontSize: 22, fontWeight: '700', marginTop: spacing.md },
    earningsCard: { alignItems: 'center', paddingVertical: spacing.xl },
    label: { color: colors.text.secondary, fontSize: 13 },
    amount: { color: colors.gold.primary, fontSize: 40, fontWeight: '800', marginTop: spacing.xs },
    statusCard: {},
});
