import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../../design-system/tokens';
import Card from '../../components/Card';
import StatusPill from '../../components/StatusPill';
import JobAlertBottomSheet from '../../components/JobAlertBottomSheet';
import { useT } from '../../hooks/useT';
import apiClient from '../../services/api/client';

export default function WorkerHomeScreen({ navigation }) {
    const t = useT();
    const [isOnline, setIsOnline] = useState(false);
    const [toggling, setToggling] = useState(false);
    const [worker, setWorker] = useState({ name: '', rating: 0, verified: false });
    const [earningsToday, setEarningsToday] = useState(0);
    const [stats, setStats] = useState({ today: 0, week: 0 });
    const [activeJob, setActiveJob] = useState(null);

    const fetchProfile = async () => {
        try {
            const res = await apiClient.get('/api/me');
            const data = res.data?.user || res.data;
            if (data) {
                setWorker({
                    name: data.worker_profile?.full_name || data.name || 'Worker',
                    rating: data.worker_profile?.rating || 0,
                    verified: !!data.worker_profile?.is_verified,
                });
                setIsOnline(!!data.worker_profile?.is_online);
            }
        } catch (err) {
            console.error('[WorkerHome] Failed to fetch profile:', err);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchProfile();
        }, [])
    );

    const toggleOnline = async (val) => {
        if (toggling) return;
        setToggling(true);
        try {
            const res = await apiClient.put('/api/worker/availability', { is_online: val });
            setIsOnline(res.data?.is_online ?? val);
            if (res.data?.warning) {
                Alert.alert('Warning', res.data.warning);
            }
        } catch (err) {
            const msg = err?.response?.data?.message || 'Failed to update status. Try again.';
            Alert.alert('Error', msg);
        } finally {
            setToggling(false);
        }
    };

    return (
        <View style={styles.screen}>
            {/* Header Area */}
            <View style={styles.header}>
                <View style={styles.headerRow}>
                    <View>
                        <Text style={styles.greeting}>{t('worker_home_greeting', { name: '' })}</Text>
                        <View style={styles.nameRow}>
                            <Text style={styles.name}>{worker.name || 'Worker'}</Text>
                            {worker.verified && <Text style={styles.badge}>✅</Text>}
                        </View>
                        <Text style={styles.rating}>⭐ {worker.rating?.toFixed(1) || '–'} Average Rating</Text>
                    </View>

                    {/* Online Toggle */}
                    <View style={styles.toggleBox}>
                        <Text style={[styles.toggleTxt, isOnline && styles.toggleTxtActive]}>
                            {isOnline ? 'ONLINE' : 'OFFLINE'}
                        </Text>
                        <Switch
                            value={isOnline}
                            onValueChange={toggleOnline}
                            disabled={toggling}
                            trackColor={{ false: colors.bg.surface, true: colors.success }}
                            thumbColor={toggling ? colors.text.muted : colors.text.primary}
                        />
                    </View>
                </View>

                {/* Earnings Card */}
                <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('EarningsDetail')}>
                    <Card glow style={styles.earningsCard}>
                        <Text style={styles.eLabel}>{t('earnings_today')}</Text>
                        <Text style={styles.eValue}>₹{earningsToday}</Text>
                        <Text style={styles.eSub}>Tap to view history →</Text>
                    </Card>
                </TouchableOpacity>

                {/* Quick Stats */}
                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <Text style={styles.sValue}>{stats.today}</Text>
                        <Text style={styles.sLabel}>{t('stats_jobs')}</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.sValue}>{stats.week}</Text>
                        <Text style={styles.sLabel}>{t('tab_this_week')}</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.sValue}>{worker.rating?.toFixed(1) || '–'}</Text>
                        <Text style={styles.sLabel}>{t('stats_rating')}</Text>
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Online Status Banner */}
                {!isOnline && (
                    <View style={styles.offlineBanner}>
                        <Text style={styles.offlineBannerTxt}>💤 You are offline. Toggle online to receive jobs.</Text>
                    </View>
                )}

                {/* Active Job Section */}
                {activeJob && (
                    <View style={styles.activeSection}>
                        <Text style={styles.sectionTitle}>{t('active_job')}</Text>
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

            <JobAlertBottomSheet navigation={navigation} />
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

    offlineBanner: {
        backgroundColor: colors.bg.elevated, padding: spacing.md,
        borderRadius: radius.md, borderWidth: 1, borderColor: colors.bg.surface, marginBottom: spacing.lg
    },
    offlineBannerTxt: { color: colors.text.muted, fontSize: 14, textAlign: 'center' },

    sectionTitle: { color: colors.text.primary, fontSize: 18, fontWeight: '700', marginBottom: spacing.md },
    activeSection: {},
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
