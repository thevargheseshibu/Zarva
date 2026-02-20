import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { colors, spacing, radius } from '../../design-system/tokens';
import Card from '../../components/Card';
import StatusPill from '../../components/StatusPill';

export default function WorkerHomeScreen({ navigation }) {
    // Mock user state
    const [isOnline, setIsOnline] = useState(false);
    const worker = { name: 'Rahul R', rating: 4.8, verified: true };
    const stats = { today: 2, week: 14 };
    const earningsToday = 1450;

    // Mock Active Job
    const activeJob = {
        id: 'job-1234',
        category: 'Plumber',
        address: '404 Skyline Apartments, Kakkanad',
        status: 'assigned',
        date: 'Today, 10:30 AM'
    };

    const toggleOnline = (val) => {
        setIsOnline(val);
        // Normally PUT /api/worker/availability
        Alert.alert('Status Updated', `You are now ${val ? 'Online 🟢' : 'Offline ⚪'}`);
    };

    return (
        <View style={styles.screen}>
            {/* Header Area */}
            <View style={styles.header}>
                <View style={styles.headerRow}>
                    <View>
                        <Text style={styles.greeting}>Welcome back,</Text>
                        <View style={styles.nameRow}>
                            <Text style={styles.name}>{worker.name}</Text>
                            {worker.verified && <Text style={styles.badge}>✅</Text>}
                        </View>
                        <Text style={styles.rating}>⭐ {worker.rating} Average Rating</Text>
                    </View>

                    {/* Online Toggle */}
                    <View style={styles.toggleBox}>
                        <Text style={[styles.toggleTxt, isOnline && styles.toggleTxtActive]}>
                            {isOnline ? 'ONLINE' : 'OFFLINE'}
                        </Text>
                        <Switch
                            value={isOnline}
                            onValueChange={toggleOnline}
                            trackColor={{ false: colors.bg.surface, true: colors.success }}
                            thumbColor={colors.text.primary}
                        />
                    </View>
                </View>

                {/* Earnings Card */}
                <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('EarningsDetail')}>
                    <Card glow style={styles.earningsCard}>
                        <Text style={styles.eLabel}>Earnings Today</Text>
                        <Text style={styles.eValue}>₹{earningsToday}</Text>
                        <Text style={styles.eSub}>Tap to view history →</Text>
                    </Card>
                </TouchableOpacity>

                {/* Quick Stats */}
                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <Text style={styles.sValue}>{stats.today}</Text>
                        <Text style={styles.sLabel}>Jobs Today</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.sValue}>{stats.week}</Text>
                        <Text style={styles.sLabel}>This Week</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.sValue}>{worker.rating}</Text>
                        <Text style={styles.sLabel}>Rating</Text>
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Active Job Section */}
                {activeJob && (
                    <View style={styles.activeSection}>
                        <Text style={styles.sectionTitle}>Current Job</Text>
                        <Card style={styles.activeJobCard}>
                            <View style={styles.ajHeader}>
                                <Text style={styles.ajCategory}>{activeJob.category}</Text>
                                <StatusPill status={activeJob.status} />
                            </View>
                            <Text style={styles.ajDate}>{activeJob.date}</Text>
                            <Text style={styles.ajAddress} numberOfLines={2}>📍 {activeJob.address}</Text>

                            <TouchableOpacity
                                style={styles.viewJobBtn}
                                onPress={() => navigation.navigate('ActiveJob', { jobId: activeJob.id })}
                            >
                                <Text style={styles.viewJobTxt}>View Job Details →</Text>
                            </TouchableOpacity>
                        </Card>
                    </View>
                )}

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary },
    header: {
        paddingTop: spacing.xl + 20, paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg, backgroundColor: colors.bg.elevated,
        borderBottomWidth: 1, borderBottomColor: colors.bg.surface
    },

    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xl },
    greeting: { color: colors.text.secondary, fontSize: 14 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginVertical: 4 },
    name: { color: colors.gold.primary, fontSize: 24, fontWeight: '800' },
    badge: { fontSize: 16 },
    rating: { color: colors.text.muted, fontSize: 13, fontWeight: '600' },

    toggleBox: { alignItems: 'center', gap: 4 },
    toggleTxt: { color: colors.text.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
    toggleTxtActive: { color: colors.success },

    earningsCard: { alignItems: 'center', padding: spacing.xl, marginBottom: spacing.lg, borderColor: colors.gold.primary, borderWidth: 1 },
    eLabel: { color: colors.text.secondary, fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
    eValue: { color: colors.gold.primary, fontSize: 48, fontWeight: '800', fontFamily: 'Courier', marginVertical: spacing.sm },
    eSub: { color: colors.text.muted, fontSize: 13 },

    statsRow: { flexDirection: 'row', gap: spacing.sm },
    statBox: { flex: 1, backgroundColor: colors.bg.surface, padding: spacing.md, borderRadius: radius.md, alignItems: 'center' },
    sValue: { color: colors.text.primary, fontSize: 20, fontWeight: '800' },
    sLabel: { color: colors.text.muted, fontSize: 12, marginTop: 2 },

    content: { padding: spacing.lg },
    sectionTitle: { color: colors.text.primary, fontSize: 18, fontWeight: '700', marginBottom: spacing.md },

    activeJobCard: { gap: spacing.sm, borderWidth: 1, borderColor: colors.gold.primary + '55' },
    ajHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    ajCategory: { color: colors.text.primary, fontSize: 16, fontWeight: '700' },
    ajDate: { color: colors.text.secondary, fontSize: 13 },
    ajAddress: { color: colors.text.muted, fontSize: 14, marginTop: spacing.xs, lineHeight: 20 },

    viewJobBtn: {
        marginTop: spacing.md, backgroundColor: colors.gold.glow,
        padding: spacing.md, borderRadius: radius.md, alignItems: 'center'
    },
    viewJobTxt: { color: colors.gold.primary, fontWeight: '700' }
});
