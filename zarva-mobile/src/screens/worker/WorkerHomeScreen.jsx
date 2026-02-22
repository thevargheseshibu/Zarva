import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { colors, spacing, radius } from '../../design-system/tokens';
import Card from '../../components/Card';
import StatusPill from '../../components/StatusPill';
import JobAlertBottomSheet from '../../components/JobAlertBottomSheet';
import { useT } from '../../hooks/useT';
import { useWorkerStore } from '../../stores/workerStore';
import apiClient from '../../services/api/client';

const LOCATION_TASK_NAME = 'background-location-task';

export default function WorkerHomeScreen({ navigation }) {
    const t = useT();
    const { isOnline, setOnline, isAvailable, setAvailable, activeJob, setActiveJob } = useWorkerStore();
    const [toggling, setToggling] = useState(false);
    const [worker, setWorker] = useState({ name: '', rating: 0, verified: false });
    const [earningsToday, setEarningsToday] = useState(0);
    const [stats, setStats] = useState({ today: 0, week: 0 });

    const fetchActiveJob = async (jobId) => {
        try {
            const res = await apiClient.get(`/api/worker/jobs/${jobId}`);
            if (res.data?.job) {
                setActiveJob(res.data.job);
            }
        } catch (err) {
            console.error('[WorkerHome] Failed to fetch active job:', err);
        }
    };

    const fetchProfile = async () => {
        try {
            const res = await apiClient.get('/api/me');
            const user = res.data?.user;
            if (user && user.profile) {
                const p = user.profile;
                setWorker({
                    name: p.name || 'Worker',
                    rating: Number(p.average_rating || 0),
                    verified: !!p.is_verified,
                });
                setOnline(!!p.is_online);
                setAvailable(!!p.is_available);

                if (p.current_job_id) {
                    fetchActiveJob(p.current_job_id);
                } else {
                    setActiveJob(null);
                }
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
            const online = res.data?.is_online ?? val;
            setOnline(online);

            if (online) {
                await startBackgroundTracking();
            } else {
                await stopBackgroundTracking();
            }

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

    const startBackgroundTracking = async () => {
        try {
            const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
            if (fgStatus !== 'granted') return;

            const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
            if (bgStatus !== 'granted') {
                Alert.alert('Permission Required', 'Background location is needed to find jobs while you are online.');
                return;
            }

            await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
                accuracy: Location.Accuracy.Balanced,
                timeInterval: 60000, // Sync every minute
                distanceInterval: 100, // or 100 meters
                foregroundService: {
                    notificationTitle: "ZARVA Online",
                    notificationBody: "Actively looking for jobs near you.",
                    notificationColor: colors.gold.primary
                }
            });
            console.log('[WorkerHome] Background tracking started');
        } catch (e) {
            console.error('[WorkerHome] Failed to start bg tracking', e);
        }
    };

    const stopBackgroundTracking = async () => {
        try {
            const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
            if (started) {
                await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
                console.log('[WorkerHome] Background tracking stopped');
            }
        } catch (e) {
            console.error('[WorkerHome] Failed to stop bg tracking', e);
        }
    };

    const toggleAvailable = async (val) => {
        if (toggling) return;
        setToggling(true);
        try {
            const res = await apiClient.put('/api/worker/availability', { is_available: val });
            setAvailable(res.data?.is_available ?? val);
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to update availability.');
        } finally {
            setToggling(false);
        }
    };

    // Safely format rating for display
    const rawRating = worker.rating !== undefined && worker.rating !== null ? Number(worker.rating) : 0;
    const displayRating = (isNaN(rawRating) ? 0 : rawRating).toFixed(1);

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
                        <Text style={styles.rating}>⭐ {displayRating} Average Rating</Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: spacing.md }}>
                        {/* Online Toggle */}
                        <View style={styles.toggleBox}>
                            <Text style={[styles.toggleTxt, isOnline && styles.toggleTxtActive]}>
                                {isOnline ? 'NET: ON' : 'NET: OFF'}
                            </Text>
                            <Switch
                                value={isOnline}
                                onValueChange={toggleOnline}
                                disabled={toggling}
                                trackColor={{ false: colors.bg.surface, true: colors.success }}
                                thumbColor={toggling ? colors.text.muted : colors.text.primary}
                            />
                        </View>
                        {/* Dispatch Available Toggle */}
                        <View style={styles.toggleBox}>
                            <Text style={[styles.toggleTxt, isAvailable && styles.toggleTxtActive]}>
                                {isAvailable ? 'DISPATCH: Y' : 'DISPATCH: N'}
                            </Text>
                            <Switch
                                value={isAvailable}
                                onValueChange={toggleAvailable}
                                disabled={toggling}
                                trackColor={{ false: colors.bg.surface, true: colors.gold.glow }}
                                thumbColor={toggling ? colors.text.muted : colors.text.primary}
                            />
                        </View>
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
                        <Text style={styles.sValue}>{displayRating}</Text>
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
                            <Text style={styles.ajDate}>{activeJob.date || activeJob.created_at ? new Date(activeJob.created_at).toLocaleDateString() : 'Today'}</Text>
                            <Text style={styles.ajAddress} numberOfLines={2}>📍 {activeJob.address || 'Address not found'}</Text>
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
