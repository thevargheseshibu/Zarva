import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { colors, spacing, radius } from '../../design-system/tokens';
import Card from '../../components/Card';
import StatusPill from '../../components/StatusPill';

const SERVICES = [
    { id: 'electrician', label: 'Electrician', icon: '⚡' },
    { id: 'plumber', label: 'Plumber', icon: '🔧' },
    { id: 'carpenter', label: 'Carpenter', icon: '🪵' },
    { id: 'ac_repair', label: 'AC Repair', icon: '❄️' },
    { id: 'painter', label: 'Painter', icon: '🎨' },
    { id: 'cleaning', label: 'Cleaning', icon: '🧹' },
    { id: 'driver', label: 'Driver', icon: '🚗' },
    { id: 'helper', label: 'Helper', icon: '📦' },
];

export default function HomeScreen({ navigation }) {
    // Mock active job for now
    const activeJob = null;

    return (
        <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
            {/* Location Pill */}
            <TouchableOpacity style={styles.locationPill}>
                <Text style={styles.locationIcon}>📍</Text>
                <Text style={styles.locationText}>Kochi, Kerala</Text>
                <Text style={styles.locationArrow}>⌄</Text>
            </TouchableOpacity>

            <Text style={styles.heading}>What do you need today?</Text>

            {/* Active Job Banner */}
            {activeJob && (
                <Card glow style={styles.activeBanner}>
                    <View style={styles.activeBannerHeader}>
                        <Text style={styles.activeTitle}>Active Job</Text>
                        <StatusPill status={activeJob.status} />
                    </View>
                    <Text style={styles.activeService}>{activeJob.category}</Text>
                    <TouchableOpacity
                        style={styles.trackBtn}
                        onPress={() => navigation.navigate('JobStatusDetail', { jobId: activeJob.id })}
                    >
                        <Text style={styles.trackBtnText}>Track Status →</Text>
                    </TouchableOpacity>
                </Card>
            )}

            {/* Service Grid */}
            <View style={styles.grid}>
                {SERVICES.map((s) => (
                    <TouchableOpacity
                        key={s.id}
                        style={styles.serviceCard}
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate('DynamicQuestions', { category: s.id, label: s.label })}
                    >
                        <Text style={styles.serviceIcon}>{s.icon}</Text>
                        <Text style={styles.serviceLabel}>{s.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Recent Posts Section */}
            <View style={styles.recentSection}>
                <View style={styles.recentHeader}>
                    <Text style={styles.recentTitle}>Recent Posts</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('MyJobs')}>
                        <Text style={styles.viewAll}>View All</Text>
                    </TouchableOpacity>
                </View>

                {/* Mock Recent Post */}
                <Card style={styles.recentCard}>
                    <View style={styles.recentCardTop}>
                        <View style={styles.recentIconBox}><Text>🔧</Text></View>
                        <View style={styles.recentInfo}>
                            <Text style={styles.recentCat}>Plumber • Fix leaky tap</Text>
                            <Text style={styles.recentDate}>Today, 10:30 AM</Text>
                        </View>
                        <StatusPill status="completed" />
                    </View>
                </Card>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary },
    content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xl * 2 },

    locationPill: {
        flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
        backgroundColor: colors.bg.surface, paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm, borderRadius: radius.full, gap: 6,
        marginTop: spacing.md,
    },
    locationIcon: { fontSize: 16 },
    locationText: { color: colors.text.primary, fontSize: 14, fontWeight: '600' },
    locationArrow: { color: colors.text.muted, fontSize: 16, marginTop: -4 },

    heading: { color: colors.text.primary, fontSize: 24, fontWeight: '700', fontFamily: 'Sohne' },

    activeBanner: { gap: spacing.sm, borderColor: colors.gold.primary, borderWidth: 1 },
    activeBannerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    activeTitle: { color: colors.text.secondary, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
    activeService: { color: colors.text.primary, fontSize: 18, fontWeight: '600' },
    trackBtn: { alignSelf: 'flex-start', marginTop: spacing.xs },
    trackBtnText: { color: colors.gold.primary, fontWeight: '600' },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'space-between' },
    serviceCard: {
        width: '47.5%', backgroundColor: colors.bg.elevated, borderRadius: radius.lg,
        padding: spacing.lg, alignItems: 'center', gap: spacing.sm,
        borderWidth: 1, borderColor: colors.bg.surface,
    },
    serviceIcon: { fontSize: 32 },
    serviceLabel: { color: colors.text.primary, fontSize: 15, fontWeight: '500' },

    recentSection: { gap: spacing.md },
    recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    recentTitle: { color: colors.text.primary, fontSize: 18, fontWeight: '700' },
    viewAll: { color: colors.gold.primary, fontSize: 14, fontWeight: '600' },

    recentCard: { padding: spacing.md },
    recentCardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    recentIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bg.surface, justifyContent: 'center', alignItems: 'center' },
    recentInfo: { flex: 1, gap: 2 },
    recentCat: { color: colors.text.primary, fontSize: 14, fontWeight: '600' },
    recentDate: { color: colors.text.muted, fontSize: 12 },
});
