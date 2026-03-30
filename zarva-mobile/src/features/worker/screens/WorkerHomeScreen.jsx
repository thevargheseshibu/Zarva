import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Image, Animated, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';

import { useTokens } from '@shared/design-system';
import { useT } from '@shared/i18n/useTranslation';
import apiClient from '@infra/api/client';
import { useWorkerStore } from '@worker/store';

import FadeInView from '@shared/ui/FadeInView';
import Card from '@shared/ui/ZCard';
import PressableAnimated from '@shared/design-system/components/PressableAnimated';
import StatusPill from '@shared/ui/StatusPill';
import MapPickerModal from '@shared/ui/MapPickerModal';
import MainBackground from '@shared/ui/MainBackground';
import ZarvaHeader from '@shared/ui/ZarvaHeader';

// Optional: If you have the RadarAnimation, import it. Otherwise, we simulate a pulsing glow.
// import RadarAnimation from '@shared/ui/RadarAnimation';

const { width } = Dimensions.get('window');

export default function WorkerHomeScreen({ navigation }) {
    const tokens = useTokens();
    const styles = useMemo(() => createStyles(tokens), [tokens]);
    const t = useT();

    const isOnline = useWorkerStore(state => state.isOnline);
    const setOnline = useWorkerStore(state => state.setOnline);
    const setAvailable = useWorkerStore(state => state.setAvailable);
    const activeJob = useWorkerStore(state => state.activeJob);
    const setActiveJob = useWorkerStore(state => state.setActiveJob);
    const locationOverride = useWorkerStore(state => state.locationOverride);
    const setLocationOverride = useWorkerStore(state => state.setLocationOverride);
    
    const [toggling, setToggling] = useState(false);
    const [worker, setWorker] = useState({ id: null, name: '', rating: 0, verified: false, photo: null });
    const [earningsToday, setEarningsToday] = useState(0);
    const [stats, setStats] = useState({ today: 0, week: 0 });
    const [reviews, setReviews] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [isMapVisible, setIsMapVisible] = useState(false);
    const [location, setLocation] = useState(locationOverride || { address: 'Locating...', lat: null, lng: null });

    // Animation values for the Online status glow
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (isOnline) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.15, duration: 1500, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true })
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isOnline]);

    const getTimeGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return t('good_morning') || 'Good Morning';
        if (hour < 17) return t('good_afternoon') || 'Good Afternoon';
        return t('good_evening') || 'Good Evening';
    };

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
            if (addressArr) addressText = [addressArr.name, addressArr.city, addressArr.subregion, addressArr.region]
                .filter(Boolean)
                .filter((v, i, a) => a.indexOf(v) === i)
                .join(', ');
            
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
                { text: 'Set as Active', onPress: async () => updateLocationSync(loc, 'current') },
                { text: 'Set as Base & Active', style: 'default', onPress: async () => updateLocationSync(loc, 'base') }
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
                    latitude: loc.latitude, longitude: loc.longitude, radius_km: 20
                });
            } else {
                await apiClient.put('/api/worker/location', { lat: loc.latitude, lng: loc.longitude });
            }
        } catch (err) {
            Alert.alert(t('sync_error'), t('sync_error_location'));
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
                    rating: parseFloat(u?.profile?.average_rating ?? u.rating) || 0,
                    verified: (u?.profile?.kyc_status || u.kyc_status) === 'approved',
                    photo: u.photo_url
                });
                
                setOnline(u?.profile?.is_online === true || u?.profile?.is_online === 1 || u.is_online === true || u.is_online === 1);
                setAvailable(u?.profile?.is_available === true || u?.profile?.is_available === 1 || u.is_available === true || u.is_available === 1);

                const currentJobId = u?.profile?.current_job_id || u?.current_job_id || null;
                if (currentJobId) await fetchActiveJob(currentJobId);
                else setActiveJob(null);
            }
            if (statsRes.data?.stats) {
                setStats(statsRes.data.stats);
                setEarningsToday(statsRes.data.stats.earnings_today || 0);
            }

            if (u && u.id) {
                const reviewsRes = await apiClient.get(`/api/reviews/worker/${u.id}`);
                setReviews(reviewsRes.data?.data?.reviews || reviewsRes.data?.reviews || []);
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

    const toggleOnline = async () => {
        if (toggling) return;
        const val = !isOnline;
        setToggling(true);
        
        // Satisfying haptic feedback
        if (val) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);

        try {
            const res = await apiClient.put('/api/worker/availability', { is_online: val, is_available: val });
            setOnline(typeof res.data?.is_online === 'boolean' ? res.data.is_online : val);
            setAvailable(typeof res.data?.is_available === 'boolean' ? res.data.is_available : val);
        } catch (err) {
            Alert.alert(val ? 'Cannot Go Online' : 'Cannot Go Offline', err?.response?.data?.message || 'Error');
            loadData();
        } finally {
            setToggling(false);
        }
    };

    const hasActiveJob = activeJob && !['completed', 'cancelled', 'no_worker_found', 'disputed'].includes(activeJob.status);

    return (
        <MainBackground>
            {/* Header mapped with minimal info to leave room for the new Hero section */}
            <ZarvaHeader subtitle={worker.verified ? "Verified Professional" : "Worker Dashboard"} />
            
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={tokens.brand.primary} />}
            >
                {/* 1. WELCOME HERO */}
                <FadeInView delay={100} style={styles.heroSection}>
                    <View style={styles.heroTextWrap}>
                        <Text style={styles.timeGreeting}>{getTimeGreeting()},</Text>
                        <Text style={styles.heroName}>{worker.name.split(' ')[0]}!</Text>
                    </View>
                    <TouchableOpacity style={styles.heroAvatarWrap} onPress={() => navigation.navigate('WorkerProfile')}>
                        <Image
                            source={{ uri: worker.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.name)}&background=101014&color=BD00FF` }}
                            style={styles.heroAvatar}
                        />
                        {worker.verified && <View style={styles.verifiedBadge}><Text style={styles.verifiedTxt}>✓</Text></View>}
                    </TouchableOpacity>
                </FadeInView>

                {/* 2. LOCATION PILL */}
                <FadeInView delay={150}>
                    <TouchableOpacity style={styles.locationPill} onPress={() => setIsMapVisible(true)}>
                        <View style={[styles.statusDot, { backgroundColor: isOnline ? tokens.brand.primary : tokens.text.tertiary }]} />
                        <Text style={styles.locTxt} numberOfLines={1}>{location.address}</Text>
                        <Text style={styles.locEdit}>Change</Text>
                    </TouchableOpacity>
                </FadeInView>

                {/* 3. THE "MAGIC" ACTION CENTER */}
                <FadeInView delay={200} style={styles.actionCenter}>
                    {isOnline && (
                        <Animated.View style={[styles.radarGlow, { transform: [{ scale: pulseAnim }], opacity: pulseAnim.interpolate({ inputRange: [1, 1.15], outputRange: [0.6, 0] }) }]} />
                    )}
                    
                    <PressableAnimated onPress={toggleOnline} disabled={toggling} style={styles.actionButtonInner}>
                        <Card style={[styles.actionCard, isOnline ? styles.actionCardOnline : styles.actionCardOffline]}>
                            <View style={styles.actionContent}>
                                <Text style={styles.actionTitle}>
                                    {isOnline ? "You're Online" : "You're Offline"}
                                </Text>
                                <Text style={styles.actionSubtitle}>
                                    {isOnline ? "Scanning area for new job requests..." : "Tap here when you're ready to work."}
                                </Text>
                            </View>
                            <View style={[styles.toggleCircle, isOnline && styles.toggleCircleOnline]}>
                                <Text style={styles.toggleIcon}>{isOnline ? '⏸' : '▶'}</Text>
                            </View>
                        </Card>
                    </PressableAnimated>
                </FadeInView>

                {/* 4. ACTIVE JOB FOCUS (Only shows if there's a job, taking priority) */}
                {hasActiveJob && (
                    <FadeInView delay={300}>
                        <PressableAnimated onPress={() => navigation.navigate('ActiveJob', { jobId: activeJob.id })}>
                            <Card style={styles.activeJobMasterCard}>
                                <View style={styles.ajPulseIndicator} />
                                <View style={styles.ajHeader}>
                                    <Text style={styles.ajPreTitle}>CURRENTLY ASSIGNED</Text>
                                    <StatusPill status={activeJob.status} />
                                </View>
                                <Text style={styles.ajTitle}>{t(`cat_${activeJob.category}`) || 'Service Assignment'}</Text>
                                <Text style={styles.ajAddress}>📍 {activeJob.location_address}</Text>
                                
                                <View style={styles.ajButton}>
                                    <Text style={styles.ajButtonTxt}>Enter Work Area →</Text>
                                </View>
                            </Card>
                        </PressableAnimated>
                    </FadeInView>
                )}

                {/* 5. SWIPEABLE WIDGETS (Stats & Earnings) */}
                <FadeInView delay={400} style={styles.widgetSection}>
                    <Text style={styles.sectionHeader}>Your Performance</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.widgetScroll}>
                        
                        <PressableAnimated onPress={() => navigation.navigate('EarningsDetail')}>
                            <Card style={[styles.widgetCard, styles.earningsWidget]}>
                                <Text style={styles.widgetLabel}>TODAY's TAKES</Text>
                                <Text style={styles.widgetValuePrimary}>₹{earningsToday}</Text>
                                <Text style={styles.widgetFooterTxt}>Tap for breakdown</Text>
                            </Card>
                        </PressableAnimated>

                        <Card style={styles.widgetCard}>
                            <Text style={styles.widgetLabel}>JOBS DONE</Text>
                            <Text style={styles.widgetValue}>{stats.today}</Text>
                            <Text style={styles.widgetFooterTxt}>{stats.week} this week</Text>
                        </Card>

                        <Card style={styles.widgetCard}>
                            <Text style={styles.widgetLabel}>RATING</Text>
                            <Text style={styles.widgetValue}>⭐ {worker.rating.toFixed(1)}</Text>
                            <Text style={styles.widgetFooterTxt}>Top 10% in area</Text>
                        </Card>
                        
                    </ScrollView>
                </FadeInView>

                {/* 6. RECENT FEEDBACK */}
                <FadeInView delay={500} style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeader}>Customer Love</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('WorkerReputation', { workerId: worker.id, workerName: worker.name })}>
                            <Text style={styles.viewAll}>See All Reviews</Text>
                        </TouchableOpacity>
                    </View>

                    {reviews.length === 0 ? (
                        <Card style={styles.emptyFeedback}>
                            <Text style={styles.emptyTxt}>Complete jobs to earn your first glowing review!</Text>
                        </Card>
                    ) : (
                        reviews.slice(0, 3).map((review, idx) => (
                            <Card key={idx} style={styles.feedbackCard}>
                                <View style={styles.fbHeader}>
                                    <Text style={styles.fbStars}>{'★'.repeat(Math.round(review.overall_score ?? review.rating ?? 0))}</Text>
                                    <Text style={styles.fbUser}>{review.reviewer_identifier}</Text>
                                </View>
                                <Text style={styles.fbComment} numberOfLines={2}>
                                    {review.comment ? `"${review.comment}"` : t('default_feedback')}
                                </Text>
                            </Card>
                        ))
                    )}
                </FadeInView>

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
    scrollContent: { paddingHorizontal: t.spacing['2xl'], paddingTop: 20, paddingBottom: 120 },

    // 1. HERO SECTION
    heroSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: t.spacing.lg },
    heroTextWrap: { flex: 1, paddingRight: 20 },
    timeGreeting: { color: t.text.tertiary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.medium, marginBottom: 4 },
    heroName: { color: t.text.primary, fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
    heroAvatarWrap: { position: 'relative', shadowColor: t.brand.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 10 },
    heroAvatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: t.background.surfaceRaised },
    verifiedBadge: { position: 'absolute', bottom: -4, right: -4, backgroundColor: t.brand.primary, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: t.background.app },
    verifiedTxt: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },

    // 2. LOCATION PILL
    locationPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.background.surfaceRaised, paddingVertical: 10, paddingHorizontal: 16, borderRadius: t.radius.full, marginBottom: t.spacing['2xl'], alignSelf: 'flex-start' },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    locTxt: { color: t.text.secondary, fontSize: 12, fontWeight: t.typography.weight.medium, maxWidth: width * 0.5 },
    locEdit: { color: t.brand.primary, fontSize: 12, fontWeight: t.typography.weight.bold, marginLeft: 12 },

    // 3. ACTION CENTER
    actionCenter: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: t.spacing['2xl'], marginTop: t.spacing.md },
    radarGlow: { position: 'absolute', width: '100%', height: '100%', backgroundColor: t.brand.primary, borderRadius: t.radius.xl, zIndex: 0 },
    actionButtonInner: { width: '100%', zIndex: 1 },
    actionCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: t.spacing.xl, borderRadius: t.radius.xl, borderWidth: 1 },
    actionCardOffline: { backgroundColor: t.background.surface, borderColor: t.border.default },
    actionCardOnline: { backgroundColor: t.background.surfaceRaised, borderColor: t.brand.primary },
    actionContent: { flex: 1, paddingRight: 20 },
    actionTitle: { color: t.text.primary, fontSize: 22, fontWeight: '800', marginBottom: 6 },
    actionSubtitle: { color: t.text.secondary, fontSize: 13, lineHeight: 18 },
    toggleCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: t.background.app, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.border.default },
    toggleCircleOnline: { backgroundColor: t.brand.primary, borderColor: t.brand.primary, shadowColor: t.brand.primary, shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
    toggleIcon: { fontSize: 20, color: '#FFF' },

    // 4. ACTIVE JOB
    activeJobMasterCard: { backgroundColor: t.brand.primary + '15', borderColor: t.brand.primary, borderWidth: 1, borderRadius: t.radius.xl, padding: t.spacing.xl, marginBottom: t.spacing['2xl'], overflow: 'hidden' },
    ajPulseIndicator: { position: 'absolute', top: 0, left: 0, width: 4, height: '200%', backgroundColor: t.brand.primary },
    ajHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    ajPreTitle: { color: t.brand.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
    ajTitle: { color: t.text.primary, fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
    ajAddress: { color: t.text.secondary, fontSize: 13, marginBottom: 20 },
    ajButton: { backgroundColor: t.brand.primary, paddingVertical: 14, borderRadius: t.radius.lg, alignItems: 'center' },
    ajButtonTxt: { color: t.background.app, fontSize: 14, fontWeight: 'bold' },

    // 5. WIDGETS
    widgetSection: { marginBottom: t.spacing['2xl'] },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
    sectionHeader: { color: t.text.primary, fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
    viewAll: { color: t.brand.primary, fontSize: 12, fontWeight: 'bold', marginBottom: 16 },
    widgetScroll: { paddingRight: 20, gap: 12 },
    widgetCard: { width: 140, padding: 16, backgroundColor: t.background.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.border.default + '44' },
    earningsWidget: { width: 180, backgroundColor: t.background.surfaceRaised, borderColor: t.brand.primary + '55' },
    widgetLabel: { color: t.text.tertiary, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 12 },
    widgetValue: { color: t.text.primary, fontSize: 28, fontWeight: '900', marginBottom: 4 },
    widgetValuePrimary: { color: t.brand.primary, fontSize: 32, fontWeight: '900', marginBottom: 4 },
    widgetFooterTxt: { color: t.text.secondary, fontSize: 11 },

    // 6. FEEDBACK
    section: { marginBottom: t.spacing[32] },
    feedbackCard: { backgroundColor: t.background.surface, borderWidth: 1, borderColor: t.border.default + '22', borderRadius: t.radius.lg, padding: 16, marginBottom: 12 },
    fbHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    fbStars: { color: '#FFD700', fontSize: 14, letterSpacing: 2 },
    fbUser: { color: t.text.tertiary, fontSize: 11, fontWeight: 'bold' },
    fbComment: { color: t.text.secondary, fontSize: 13, fontStyle: 'italic', lineHeight: 20 },

    emptyFeedback: { alignItems: 'center', backgroundColor: 'transparent', borderStyle: 'dashed', borderWidth: 1, borderColor: t.border.default, padding: 30 },
    emptyTxt: { color: t.text.tertiary, fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
