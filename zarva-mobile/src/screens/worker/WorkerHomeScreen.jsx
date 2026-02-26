import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity, Alert, RefreshControl, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useT } from '../../hooks/useT';
import apiClient from '../../services/api/client';
import { useWorkerStore } from '../../stores/workerStore';
import FadeInView from '../../components/FadeInView';
import Card from '../../components/Card';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import StatusPill from '../../components/StatusPill';
import MapPickerModal from '../../components/MapPickerModal';
import MainBackground from '../../components/MainBackground';
import { colors, radius, spacing, shadows } from '../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../design-system/typography';

const LOCATION_TASK_NAME = 'background-location-task';

export default function WorkerHomeScreen({ navigation }) {
    const t = useT();
    const { isOnline, setOnline, isAvailable, setAvailable, activeJob, setActiveJob, locationOverride, setLocationOverride } = useWorkerStore();
    const [toggling, setToggling] = useState(false);
    const [worker, setWorker] = useState({ id: null, name: '', rating: 0, verified: false, photo: null });
    const [earningsToday, setEarningsToday] = useState(0);
    const [stats, setStats] = useState({ today: 0, week: 0 });
    const [reviews, setReviews] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [isMapVisible, setIsMapVisible] = useState(false);
    const [location, setLocation] = useState(locationOverride || { address: 'Locating...', lat: null, lng: null });

    const fetchActiveJob = async (jobId) => {
        try {
            const res = await apiClient.get(`/api/worker/jobs/${jobId}`);
            if (res.data?.job) setActiveJob(res.data.job);
        } catch (err) {
            console.error('[WorkerHome] Failed to fetch active job:', err);
        }
    };

    const captureAndSyncLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const { latitude, longitude } = loc.coords;
            const [addressArr] = await Location.reverseGeocodeAsync({ latitude, longitude });
            let addressText = 'Unknown Location';
            if (addressArr) addressText = [addressArr.name, addressArr.city || addressArr.subregion, addressArr.region].filter(Boolean).join(', ');
            const newLoc = { address: addressText, lat: latitude, lng: longitude };
            if (!locationOverride) {
                setLocation(newLoc);
                await apiClient.put('/api/worker/location', { lat: latitude, lng: longitude });
            }
        } catch (err) {
            console.error('[WorkerHome] Failed to sync location:', err);
        }
    };

    const handleMapSelect = async (loc) => {
        Alert.alert(
            'Location Update',
            'How would you like to use this location?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Set as Active',
                    onPress: async () => {
                        await updateLocationSync(loc, 'current');
                    }
                },
                {
                    text: 'Set as Base & Active',
                    style: 'default',
                    onPress: async () => {
                        await updateLocationSync(loc, 'base');
                    }
                }
            ]
        );
    };

    const updateLocationSync = async (loc, type) => {
        const newLoc = { address: loc.address, lat: loc.latitude, lng: loc.longitude };
        setLocation(newLoc);
        setLocationOverride(newLoc);
        setIsMapVisible(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        try {
            if (type === 'base') {
                // Hits the service-area endpoint which updates home_location + service_center
                await apiClient.post('/api/worker/onboarding/service-area', {
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    radius_km: 20 // Default or fetch current
                });
                Alert.alert('Base Location Updated', 'Your permanent service area center has been updated.');
            } else {
                // Just updates current_location for live tracking
                await apiClient.put('/api/worker/location', { lat: loc.latitude, lng: loc.longitude });
                Alert.alert('Active Location Updated', 'Your current location for job matching is updated.');
            }
        } catch (err) {
            console.error('[WorkerHome] sync failure:', err);
            Alert.alert('Sync Error', 'Failed to update location on server.');
        }
    };

    const fetchProfile = async () => {
        try {
            const res = await apiClient.get('/api/me');
            const user = res.data?.user;
            if (user && user.profile) {
                const p = user.profile;
                setWorker({
                    id: user.id,
                    name: user.name || 'Professional',
                    rating: Number(p.average_rating || 0),
                    verified: !!p.is_verified,
                    photo: user.photo
                });
                setOnline(!!p.is_online);
                setAvailable(!!p.is_available);
                setEarningsToday(p.earnings_today || 0);
                setStats({ today: p.jobs_today || 0, week: p.jobs_week || 0 });
                if (p.current_job_id) fetchActiveJob(p.current_job_id);
                else setActiveJob(null);

                try {
                    const revRes = await apiClient.get(`/api/reviews/worker/${user.id}`);
                    setReviews(revRes.data?.data?.reviews || revRes.data?.reviews || []);
                } catch (rErr) { }
            }
        } catch (err) {
            console.error('[WorkerHome] Failed to fetch profile:', err);
        } finally {
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        fetchProfile();
    }, [fetchProfile]);

    useFocusEffect(
        useCallback(() => {
            fetchProfile();
            captureAndSyncLocation();
        }, [])
    );

    const toggleOnline = async (val) => {
        if (toggling) return;
        setToggling(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            const res = await apiClient.put('/api/worker/availability', { is_online: val });
            const online = res.data?.is_online ?? val;
            setOnline(online);
            if (online) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to update status.');
        } finally {
            setToggling(false);
        }
    };

    return (
        <MainBackground>
            {/* Header / Profile Summary */}
            <View style={styles.header}>
                <FadeInView delay={100} style={styles.headerTop}>
                    <View style={styles.profileRow}>
                        <View style={styles.photoWrap}>
                            <Image
                                source={{ uri: worker.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.name)}&background=101014&color=BD00FF` }}
                                style={styles.photo}
                            />
                            {worker.verified && <View style={styles.verifiedDot} />}
                        </View>
                        <View style={styles.headerText}>
                            <Text style={styles.greeting}>{t('good_day')}</Text>
                            <Text style={styles.name}>{worker.name.split(' ')[0]}</Text>
                        </View>
                    </View>

                    <View style={styles.statusBox}>
                        <Text style={[styles.statusTxt, isOnline && styles.statusTxtActive]}>
                            {isOnline ? t('online').toUpperCase() : t('offline').toUpperCase()}
                        </Text>
                        <Switch
                            value={isOnline}
                            onValueChange={toggleOnline}
                            disabled={toggling}
                            trackColor={{ false: colors.elevated, true: colors.accent.primary }}
                            thumbColor="#FFF"
                        />
                    </View>
                </FadeInView>

                <FadeInView delay={200}>
                    <PressableAnimated onPress={() => navigation.navigate('EarningsDetail')}>
                        <Card style={styles.earningsCard}>
                            <View style={styles.eInfo}>
                                <Text style={styles.eLabel}>{t('earnings_today')}</Text>
                                <Text style={styles.eValue}>₹{earningsToday}</Text>
                            </View>
                            <View style={styles.eAction}>
                                <Text style={styles.eActionTxt}>{t('profit_tracker')}</Text>
                            </View>
                        </Card>
                    </PressableAnimated>
                </FadeInView>

                <FadeInView delay={300} style={styles.statsGrid}>
                    <View style={styles.statItem}>
                        <Text style={styles.statVal}>{stats.today}</Text>
                        <Text style={styles.statLbl}>{t('jobs_today')}</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statVal}>{stats.week}</Text>
                        <Text style={styles.statLbl}>{t('this_week')}</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statVal}>⭐ {worker.rating.toFixed(1)}</Text>
                        <Text style={styles.statLbl}>{t('rating')}</Text>
                    </View>
                </FadeInView>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.accent.primary}
                    />
                }
            >
                {/* Location Bar */}
                <FadeInView delay={400}>
                    <PressableAnimated style={styles.locationBar} onPress={() => setIsMapVisible(true)}>
                        <Text style={styles.locIcon}>📍</Text>
                        <Text style={styles.locTxt} numberOfLines={1}>{location.address}</Text>
                        <Text style={styles.locEdit}>{t('edit')}</Text>
                    </PressableAnimated>
                </FadeInView>

                {/* Active Job Section */}
                {activeJob && (
                    <FadeInView delay={500} style={styles.section}>
                        <Text style={styles.sectionHeader}>{t('current_engagement')}</Text>
                        <Card style={styles.activeJobCard}>
                            <View style={styles.ajTitleRow}>
                                <Text style={styles.ajCategory}>{t(`cat_${activeJob.category}`) || activeJob.category || t('cat_service')}</Text>
                                <StatusPill status={activeJob.status} />
                            </View>
                            <Text style={styles.ajAddress} numberOfLines={1}>{t('request_from')} {activeJob.customer_address?.split(',')[0]}</Text>
                            <PressableAnimated
                                style={styles.ajAction}
                                onPress={() => navigation.navigate('ActiveJob', { jobId: activeJob.id })}
                            >
                                <Text style={styles.ajActionTxt}>{t('resume_operations')}</Text>
                            </PressableAnimated>
                        </Card>
                    </FadeInView>
                )}

                {/* Feed / Feedback Summary */}
                <FadeInView delay={600} style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeader}>{t('recent_feedback')}</Text>
                        {reviews.length > 0 && (
                            <TouchableOpacity onPress={() => navigation.navigate('WorkerReputation', { workerId: worker.id, workerName: worker.name })}>
                                <Text style={styles.viewAll}>{t('see_all')}</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {reviews.length === 0 ? (
                        <Card style={styles.emptyFeedback}>
                            <Text style={styles.emptyTxt}>
                                {t('empty_feedback_desc')}
                            </Text>
                        </Card>
                    ) : (
                        reviews?.slice(0, 3).map((review, index) => (
                            <Card key={index} style={styles.feedbackCard}>
                                <View style={styles.fbHeader}>
                                    <Text style={styles.fbStars}>
                                        {"★".repeat(review.overall_score)}
                                    </Text>
                                    <Text style={styles.fbUser}>
                                        {review.reviewer_identifier}
                                    </Text>
                                </View>
                                <Text style={styles.fbComment} numberOfLines={2}>
                                    {review.comment
                                        ? `"${review.comment}"`
                                        : t('default_feedback')}
                                </Text>
                            </Card>
                        ))
                    )}
                </FadeInView>

                {/* Status Indicator */}
                {!isOnline && (
                    <FadeInView delay={700} style={styles.offlineBox}>
                        <Text style={styles.offlineTxt}>{t('offline_desc')}</Text>
                    </FadeInView>
                )}
            </ScrollView>

            <MapPickerModal
                visible={isMapVisible}
                onClose={() => setIsMapVisible(false)}
                initialLocation={location.lat ? { latitude: location.lat, longitude: location.lng } : null}
                onSelectLocation={handleMapSelect}
            />
        </MainBackground>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    header: {
        paddingTop: 60,
        paddingHorizontal: spacing[24],
        backgroundColor: 'transparent',
        paddingBottom: spacing[24],
    },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[24] },
    profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    photoWrap: { position: 'relative' },
    photo: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.accent.border },
    verifiedDot: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#00D1FF', borderWidth: 2, borderColor: colors.surface },
    headerText: { gap: 2 },
    greeting: { color: colors.text.muted, fontSize: 12, fontWeight: fontWeight.bold, letterSpacing: 1.5 },
    name: { color: colors.text.primary, fontSize: fontSize.title, fontWeight: fontWeight.bold },

    statusBox: { alignItems: 'center', gap: 4 },
    statusTxt: { color: colors.text.muted, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1 },
    statusTxtActive: { color: colors.accent.primary },

    earningsCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.elevated,
        borderWidth: 1,
        borderColor: colors.surface,
        marginBottom: spacing[20]
    },
    eLabel: { color: colors.accent.primary, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1.5 },
    eValue: { color: colors.text.primary, fontSize: 40, fontWeight: '1000', marginTop: 4 },
    eAction: { backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full },
    eActionTxt: { color: colors.text.primary, fontSize: 12, fontWeight: fontWeight.bold },

    statsGrid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    statItem: { flex: 1, alignItems: 'center', gap: 4 },
    statVal: { color: colors.text.primary, fontSize: fontSize.body, fontWeight: fontWeight.bold },
    statLbl: { color: colors.text.muted, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1 },
    statDivider: { width: 1, height: 20, backgroundColor: colors.surface },

    scrollContent: { padding: spacing[24], paddingBottom: 120 },

    locationBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: spacing[16],
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.accent.border + '11',
        gap: 12,
        marginBottom: spacing[32]
    },
    locIcon: { fontSize: 14 },
    locTxt: { flex: 1, color: colors.text.secondary, fontSize: fontSize.caption, fontWeight: fontWeight.medium },
    locEdit: { color: colors.accent.primary, fontSize: 12, fontWeight: fontWeight.bold },

    section: { marginBottom: spacing[32], gap: spacing[16] },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sectionHeader: { color: colors.accent.primary, fontSize: 12, fontWeight: fontWeight.bold, letterSpacing: 2 },
    viewAll: { color: colors.text.muted, fontSize: 12, fontWeight: fontWeight.bold },

    activeJobCard: { gap: spacing[12], backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accent.border + '22' },
    ajTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    ajCategory: { color: colors.text.primary, fontSize: fontSize.body, fontWeight: fontWeight.bold },
    ajAddress: { color: colors.text.secondary, fontSize: fontSize.micro },
    ajAction: { backgroundColor: colors.accent.primary, paddingVertical: 14, borderRadius: radius.lg, alignItems: 'center', marginTop: 10 },
    ajActionTxt: { color: colors.background, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1 },

    feedbackCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surface, gap: 10 },
    fbHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    fbStars: { color: colors.accent.primary, fontSize: 12, letterSpacing: 2 },
    fbUser: { color: colors.text.muted, fontSize: 10, fontWeight: fontWeight.bold },
    fbComment: { color: colors.text.secondary, fontSize: fontSize.caption, fontStyle: 'italic', lineHeight: 20 },

    emptyFeedback: { alignItems: 'center', backgroundColor: colors.surface, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.surface },
    emptyTxt: { color: colors.text.muted, fontSize: fontSize.caption, textAlign: 'center' },

    offlineBox: { padding: spacing[16], alignItems: 'center', backgroundColor: colors.accent.primary + '10', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.accent.primary + '15' },
    offlineTxt: { color: colors.accent.primary, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1 }
});
