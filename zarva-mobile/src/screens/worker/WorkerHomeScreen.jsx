import React, { useState, useCallback, useEffect } from 'react';
import { useTokens } from '../../design-system';
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

/**
 * WorkerHomeScreen.jsx - Cleaned and Verified
 */
export default function WorkerHomeScreen({ navigation }) {
    const tokens = useTokens();
    const styles = React.useMemo(() => createStyles(tokens), [tokens]);
    const t = useT();

    const { isOnline, setOnline, setAvailable, activeJob, setActiveJob, locationOverride, setLocationOverride } = useWorkerStore();
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
                await apiClient.post('/api/worker/onboarding/service-area', {
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    radius_km: 20
                });
                Alert.alert('Base Location Updated', 'Your permanent service area center has been updated.');
            } else {
                await apiClient.put('/api/worker/location', { lat: loc.latitude, lng: loc.longitude });
                Alert.alert('Active Location Updated', 'Your current location for job matching is updated.');
            }
        } catch (err) {
            console.error('[WorkerHome] Location sync failed:', err);
            Alert.alert('Sync Error', 'Failed to update location on server.');
        }
    };

    const loadData = useCallback(async () => {
        setRefreshing(true);
        try {
            const [meRes, statsRes] = await Promise.all([
                apiClient.get('/api/me'),
                apiClient.get('/api/worker/stats')
            ]);

            let u;
            if (meRes.data?.user) {
                u = meRes.data.user;
                setWorker({
                    id: u.id,
                    name: u.name || 'Worker',
                    rating: parseFloat(u.rating) || 0,
                    verified: u.kyc_status === 'verified',
                    photo: u.photo_url
                });
                setOnline(u.is_online);
                setAvailable(u.is_available);
            }
            if (statsRes.data?.stats) {
                setStats(statsRes.data.stats);
                setEarningsToday(statsRes.data.stats.earnings_today || 0);
            }

            if (u && u.id) {
                const reviewsRes = await apiClient.get(`/api/reviews/worker/${u.id}`);
                if (reviewsRes.data?.reviews) {
                    setReviews(reviewsRes.data.reviews);
                }
            }

            captureAndSyncLocation();
        } catch (err) {
            console.error('[WorkerHome] Data load failed:', err);
        } finally {
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadData();
            if (activeJob?.id) fetchActiveJob(activeJob.id);
        }, [loadData, activeJob?.id])
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
                            trackColor={{ false: tokens.background.surfaceRaised, true: tokens.brand.primary }}
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
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={tokens.brand.primary} />}
            >
                <TouchableOpacity style={styles.locationBar} onPress={() => setIsMapVisible(true)}>
                    <Text style={styles.locIcon}>📍</Text>
                    <Text style={styles.locTxt} numberOfLines={1}>{location.address}</Text>
                    <Text style={styles.locEdit}>{t('edit')}</Text>
                </TouchableOpacity>

                {activeJob ? (
                    <FadeInView delay={400} style={styles.section}>
                        <Text style={styles.sectionHeader}>{t('current_engagement')}</Text>
                        <Card style={styles.activeJobCard}>
                            <View style={styles.ajTitleRow}>
                                <Text style={styles.ajCategory}>{t(`cat_${activeJob.category}`) || t('cat_service')}</Text>
                                <StatusPill status={activeJob.status} />
                            </View>
                            <Text style={styles.ajAddress}>{activeJob.location_address}</Text>
                            <TouchableOpacity style={styles.ajAction} onPress={() => navigation.navigate('ActiveJob', { jobId: activeJob.id })}>
                                <Text style={styles.ajActionTxt}>{t('resume_operations')}</Text>
                            </TouchableOpacity>
                        </Card>
                    </FadeInView>
                ) : null}

                <FadeInView delay={500} style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeader}>{t('recent_feedback')}</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('WorkerReputation', { workerId: worker.id, workerName: worker.name })}>
                            <Text style={styles.viewAll}>{t('see_all')}</Text>
                        </TouchableOpacity>
                    </View>

                    {reviews.length === 0 ? (
                        <Card style={styles.emptyFeedback}>
                            <Text style={styles.emptyTxt}>{t('empty_feedback_desc')}</Text>
                        </Card>
                    ) : (
                        reviews.slice(0, 3).map((review, idx) => (
                            <Card key={idx} style={styles.feedbackCard}>
                                <View style={styles.fbHeader}>
                                    <Text style={styles.fbStars}>{'★'.repeat(Math.round(review.rating))}</Text>
                                    <Text style={styles.fbUser}>{review.reviewer_identifier}</Text>
                                </View>
                                <Text style={styles.fbComment} numberOfLines={2}>
                                    {review.comment ? `"${review.comment}"` : t('default_feedback')}
                                </Text>
                            </Card>
                        ))
                    )}
                </FadeInView>

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

const createStyles = (t) => StyleSheet.create({
    header: {
        paddingTop: 60,
        paddingHorizontal: t.spacing['2xl'],
        backgroundColor: 'transparent',
        paddingBottom: t.spacing['2xl'],
    },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: t.spacing['2xl'] },
    profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    photoWrap: { position: 'relative' },
    photo: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: t.border.default },
    verifiedDot: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#00D1FF', borderWidth: 2, borderColor: t.background.surface },
    headerText: { gap: 2 },
    greeting: { color: t.text.tertiary, fontSize: 12, fontWeight: t.typography.weight.bold, letterSpacing: 1.5 },
    name: { color: t.text.primary, fontSize: t.typography.size.title, fontWeight: t.typography.weight.bold },

    statusBox: { alignItems: 'center', gap: 4 },
    statusTxt: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1 },
    statusTxtActive: { color: t.brand.primary },

    earningsCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: t.background.surfaceRaised,
        borderWidth: 1,
        borderColor: t.background.surface,
        marginBottom: t.spacing[20]
    },
    eInfo: { gap: 4 },
    eLabel: { color: t.brand.primary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1.5 },
    eValue: { color: t.text.primary, fontSize: 40, fontWeight: '900', marginTop: 4 },
    eAction: { backgroundColor: t.background.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: t.radius.full },
    eActionTxt: { color: t.text.primary, fontSize: 12, fontWeight: t.typography.weight.bold },

    statsGrid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    statItem: { flex: 1, alignItems: 'center', gap: 4 },
    statVal: { color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.bold },
    statLbl: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1 },
    statDivider: { width: 1, height: 20, backgroundColor: t.background.surface },

    scrollContent: { padding: t.spacing['2xl'], paddingBottom: 120 },

    locationBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: t.background.surface,
        padding: t.spacing.lg,
        borderRadius: t.radius.xl,
        borderWidth: 1,
        borderColor: t.border.default + '11',
        gap: 12,
        marginBottom: t.spacing[32]
    },
    locIcon: { fontSize: 14 },
    locTxt: { flex: 1, color: t.text.secondary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.medium },
    locEdit: { color: t.brand.primary, fontSize: 12, fontWeight: t.typography.weight.bold },

    section: { marginBottom: t.spacing[32], gap: t.spacing.lg },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sectionHeader: { color: t.brand.primary, fontSize: 12, fontWeight: t.typography.weight.bold, letterSpacing: 2 },
    viewAll: { color: t.text.tertiary, fontSize: 12, fontWeight: t.typography.weight.bold },

    activeJobCard: { gap: t.spacing.md, backgroundColor: t.background.surface, borderWidth: 1, borderColor: t.border.default + '22' },
    ajTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    ajCategory: { color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.bold },
    ajAddress: { color: t.text.secondary, fontSize: t.typography.size.micro },
    ajAction: { backgroundColor: t.brand.primary, paddingVertical: 14, borderRadius: t.radius.lg, alignItems: 'center', marginTop: 10 },
    ajActionTxt: { color: t.background.app, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1 },

    feedbackCard: { backgroundColor: t.background.surface, borderWidth: 1, borderColor: t.background.surface, gap: 10 },
    fbHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    fbStars: { color: t.brand.primary, fontSize: 12, letterSpacing: 2 },
    fbUser: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.bold },
    fbComment: { color: t.text.secondary, fontSize: t.typography.size.caption, fontStyle: 'italic', lineHeight: 20 },

    emptyFeedback: { alignItems: 'center', backgroundColor: t.background.surface, borderStyle: 'dashed', borderWidth: 1, borderColor: t.background.surface },
    emptyTxt: { color: t.text.tertiary, fontSize: t.typography.size.caption, textAlign: 'center' },

    offlineBox: { padding: t.spacing.lg, alignItems: 'center', backgroundColor: t.brand.primary + '10', borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.brand.primary + '15' },
    offlineTxt: { color: t.brand.primary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1 }
});
