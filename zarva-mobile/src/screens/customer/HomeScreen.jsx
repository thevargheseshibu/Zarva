import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing } from '../../design-system/tokens';
import Card from '../../components/Card';
import GoldButton from '../../components/GoldButton';
import RadarAnimation from '../../components/RadarAnimation';

export default function HomeScreen() {
    return (
        <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
            <Text style={styles.greeting}>Good morning 👋</Text>
            <Text style={styles.sub}>What service do you need today?</Text>
            <Card glow style={styles.radarCard}>
                <RadarAnimation size={72} />
                <Text style={styles.radarText}>Find a worker nearby</Text>
                <GoldButton title="Book a Service" onPress={() => { }} style={{ marginTop: spacing.md }} />
            </Card>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary },
    content: { padding: spacing.lg, gap: spacing.md },
    greeting: { color: colors.text.primary, fontSize: 24, fontWeight: '700', marginTop: spacing.lg },
    sub: { color: colors.text.secondary, fontSize: 14 },
    radarCard: { alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
    radarText: { color: colors.text.secondary, fontSize: 14 },
});
