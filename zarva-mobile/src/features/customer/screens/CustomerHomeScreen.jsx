import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTokens } from '@shared/design-system';
import { View, Text, StyleSheet, TextInput, Alert, ScrollView, useWindowDimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    useAnimatedScrollHandler,
    interpolate,
    withTiming,
    withRepeat
} from 'react-native-reanimated';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import { useT } from '@shared/i18n/useTranslation';
import { useJobStore } from '@jobs/store';
import apiClient from '@infra/api/client';
import coverageApi from '@infra/api/coverageApi';
import FadeInView from '@shared/ui/FadeInView';
import { LinearGradient } from 'expo-linear-gradient';

import { durations } from '@shared/design-system/motion';
import PressableAnimated from '@shared/design-system/components/PressableAnimated';
import SkeletonCard from '@shared/design-system/components/SkeletonCard';
import StatusPill from '@shared/ui/StatusPill';
import RadarAnimation from '@shared/ui/RadarAnimation';
import Card from '@shared/ui/ZCard';
import MapPickerModal from '@shared/ui/MapPickerModal';
import NotCoveredView from '@shared/ui/NotCoveredView';
import ActivityCard from '@jobs/components/ActivityCard';
import ZarvaHeader from '@shared/ui/ZarvaHeader';

export default function CustomerHomeScreen({ navigation }) {
    const tTheme = useTokens();
    const styles = useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const { width: screenWidth } = useWindowDimensions();
    
    const [recentJobs, setRecentJobs] = useState([]);
    const [services, setServices] = useState([]);
    const [isLoadingServices, setIsLoadingServices] = useState(true);
    const [showAllServices, setShowAllServices] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    const { activeJob, searchPhase, locationOverride, setLocationOverride, setLastKnownLocation, setActiveJob, setSearchPhase } = useJobStore();
    const [location, setLocation] = useState(locationOverride || { address: 'Locating...', lat: null, lng: null });
    const [isMapVisible, setIsMapVisible] = useState(false);
    const [isServiceable, setIsServiceable] = useState(true);

    const ACTIVE_REQUEST_STATUSES = [
        'searching', 'assigned', 'worker_en_route', 'worker_arrived',
        'inspection_active', 'estimate_submitted', 'in_progress',
        'pause_requested', 'work_paused', 'resume_requested',
        'suspend_requested', 'customer_stopping'
    ];
    const MAX_CORE_SERVICES = 6; // Reduced for a cleaner bento look

    const trustBanners = useMemo(() => ([
        { id: 'vetted', icon: '🛡️', title: 'Elite Pros', text: 'Background checked & vetted.' },
        { id: 'pricing', icon: '💎', title: 'Clear Pricing', text: 'No hidden fees, ever.' },
        { id: 'guarantee', icon: '⭐', title: 'Zarva Promise', text: '100% satisfaction.' },
    ]), []);

    const scrollY = useSharedValue(0);
    const searchPulse = useSharedValue(0);
    const liveJobPulse = useSharedValue(0);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    const searchGlowStyle = useAnimatedStyle(() => {
        const opacity = interpolate(searchPulse.value, [0, 1], [0.15, 0.6], 'clamp');
        const scale = interpolate(searchPulse.value, [0, 1], [0.98, 1.02], 'clamp');
        return { opacity, transform: [{ scale }] };
    });

    const liveJobGlowStyle = useAnimatedStyle(() => {
        const opacity = interpolate(liveJobPulse.value, [0, 1], [0.3, 0.8], 'clamp');
        return { opacity };
    });

    const isSearching = searchQuery.trim() !== '';
    const displayedServices = isSearching
        ? services.filter(s => s.label.toLowerCase().includes(searchQuery.toLowerCase()))
        : (showAllServices ? services : services.slice(0, MAX_CORE_SERVICES));
    
    const shouldShowSeeAll = !isSearching && services.length > MAX_CORE_SERVICES;
    
    const gridItemSize = useMemo(() => {
        const padding = 20 * 2;
        const gap = 16;
        return (screenWidth - padding - gap) / 2;
    }, [screenWidth]);

    const getTimeGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return t('good_morning') || 'Good Morning';
        if (hour < 17) return t('good_afternoon') || 'Good Afternoon';
        return t('good_evening') || 'Good Evening';
    };

    useEffect(() => {
        searchPulse.value = withRepeat(withTiming(1, { duration: 3000 }), -1, true);
        liveJobPulse.value = withRepeat(withTiming(1, { duration: 1500 }), -1, true);
    }, []);

    useEffect(() => {
        setIsLoadingServices(true);
        apiClient.get('/api/jobs/config')
            .then(res => {
                if (res.data?.categories) setServices(Object.values(res.data.categories));
            })
            .catch(() => {})
            .finally(() => setIsLoadingServices(false));
    }, []);

    useFocusEffect(useCallback(() => { fetchHomescreenData(); }, []));

    const fetchHomescreenData = async () => {
        try {
            const res = await apiClient.get('/api/jobs');
            const jobs = res.data?.jobs || [];
            setRecentJobs(jobs.slice(0, 3));

            const ongoingJob = jobs.find((job) => ACTIVE_REQUEST_STATUSES.includes(job.status));
            if (ongoingJob) {
                setActiveJob(ongoingJob);
                setSearchPhase(ongoingJob.status);
            } else {
                setActiveJob(null);
                setSearchPhase(null);
            }
        } catch (err) { }
    };

    useEffect(() => {
        (async () => {
            if (locationOverride) {
                setLocation(locationOverride);
                checkServiceability(locationOverride.lat, locationOverride.lng);
                return;
            }
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            try {
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                const [addressArr] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
                let addressText = 'Unknown Location';
                if (addressArr) {
                    addressText = [addressArr.name, addressArr.city, addressArr.subregion]
                        .filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ');
                }
                const newLoc = { address: addressText, lat: loc.coords.latitude, lng: loc.coords.longitude };
                setLocation(newLoc);
                setLastKnownLocation(newLoc);
                checkServiceability(newLoc.lat, newLoc.lng);
            } catch (error) { }
        })();
    }, [locationOverride]);

    const checkServiceability = async (lat, lng) => {
        if (lat == null || lng == null) return;
        try {
            const coverage = await coverageApi.checkServiceability(lat, lng);
            setIsServiceable(coverage.is_serviceable === true);
        } catch (err) {
            setIsServiceable(true);
        }
    };

    return (
        <View style={styles.screen}>
            <ZarvaHeader subtitle="Concierge Services" />

            <Animated.ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
            >
                {!isServiceable ? (
                    <NotCoveredView locationName={location.address} onRetry={() => setIsMapVisible(true)} />
                ) : (
                    <>
                        {/* 1. HERO GREETING & LOCATION */}
                        <FadeInView delay={100} style={styles.heroSection}>
                            <View style={styles.heroHeaderRow}>
                                <View>
                                    <Text style={styles.timeGreeting}>{getTimeGreeting()}</Text>
                                    <Text style={styles.heroGreeting}>How can we help?</Text>
                                </View>
                                <PressableAnimated style={styles.locationPill} onPress={() => setIsMapVisible(true)}>
                                    <View style={styles.locDot} />
                                    <Text style={styles.locationTxt} numberOfLines={1}>{location.address.split(',')[0]}</Text>
                                    <Text style={styles.locationChevron}>⌄</Text>
                                </PressableAnimated>
                            </View>
                        </FadeInView>

                        {/* 2. LIVE ACTIVITY ISLAND (Takes Priority if Active) */}
                        {activeJob && searchPhase && ACTIVE_REQUEST_STATUSES.includes(searchPhase) && (
                            <FadeInView delay={150} style={styles.liveActivityWrap}>
                                <Animated.View style={[styles.liveJobGlow, liveJobGlowStyle, { backgroundColor: tTheme.brand.primary }]} />
                                <PressableAnimated
                                    style={styles.liveActivityCard}
                                    onPress={() => searchPhase === 'searching'
                                        ? navigation.navigate('Searching', { category: activeJob.category, jobId: activeJob.id })
                                        : navigation.navigate('JobStatusDetail', { jobId: activeJob.id })}
                                >
                                    <View style={styles.liveHeader}>
                                        <Text style={styles.livePulseTxt}>● LIVE REQUEST</Text>
                                        <StatusPill status={searchPhase} />
                                    </View>
                                    <View style={styles.liveBody}>
                                        <View style={styles.liveRadarBox}>
                                            <RadarAnimation size={40} />
                                        </View>
                                        <View style={styles.liveInfo}>
                                            <Text style={styles.liveCategory}>{t(`cat_${activeJob.category}`) || activeJob.category}</Text>
                                            <Text style={styles.liveDesc} numberOfLines={1}>
                                                {searchPhase === 'searching' ? 'Matching you with a top pro...' : 'Your service is in progress.'}
                                            </Text>
                                        </View>
                                        <View style={styles.liveActionBtn}>
                                            <Text style={styles.liveActionIcon}>➔</Text>
                                        </View>
                                    </View>
                                </PressableAnimated>
                            </FadeInView>
                        )}

                        {/* 3. FLOATING SEARCH BAR */}
                        <FadeInView delay={200} style={styles.searchSection}>
                            <View style={styles.searchWrap}>
                                <Animated.View pointerEvents="none" style={[styles.searchGlow, searchGlowStyle]}>
                                    <LinearGradient
                                        colors={[tTheme.brand.primary, tTheme.brand.secondary || tTheme.brand.primary, 'transparent']}
                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                        style={StyleSheet.absoluteFillObject}
                                    />
                                </Animated.View>
                                <View style={styles.searchBar}>
                                    <Text style={styles.searchIcon}>✨</Text>
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="Describe what you need done..."
                                        placeholderTextColor={tTheme.text.tertiary}
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                    />
                                </View>
                            </View>
                        </FadeInView>

                        {/* 4. PREMIUM BENTO GRID */}
                        <View style={styles.gridSection}>
                            <Text style={styles.sectionTitle}>Explore Services</Text>
                            <View style={styles.grid}>
                                {isLoadingServices ? (
                                    [1, 2, 3, 4].map((i) => <SkeletonCard key={i} width={gridItemSize} height={gridItemSize} />)
                                ) : (
                                    displayedServices.map((s, i) => (
                                        <FadeInView key={s.id} delay={250 + (i * 40)} style={{ width: gridItemSize }}>
                                            <PressableAnimated
                                                style={styles.bentoCard}
                                                onPress={() => navigation.navigate('DynamicQuestions', { category: s.id, label: s.label })}
                                            >
                                                <View style={styles.bentoIconWrap}>
                                                    <Text style={styles.bentoIcon}>{s.icon || '🛠️'}</Text>
                                                </View>
                                                <Text style={styles.bentoLabel}>{s.label}</Text>
                                                <Text style={styles.bentoSub}>Book Now</Text>
                                            </PressableAnimated>
                                        </FadeInView>
                                    ))
                                )}
                            </View>
                            {shouldShowSeeAll && (
                                <PressableAnimated style={styles.seeAllBtn} onPress={() => setShowAllServices(!showAllServices)}>
                                    <Text style={styles.seeAllTxt}>{showAllServices ? 'Show Less' : 'View All Categories'}</Text>
                                </PressableAnimated>
                            )}
                        </View>

                        {/* 5. VIP CUSTOM REQUEST */}
                        <FadeInView delay={350} style={styles.vipSection}>
                            <PressableAnimated onPress={() => navigation.navigate('MyCustomRequests')}>
                                <LinearGradient
                                    colors={['#1A1A24', '#2D2D3F']}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                    style={styles.vipCard}
                                >
                                    <View style={styles.vipContent}>
                                        <Text style={styles.vipPreTitle}>ZARVA EXCLUSIVE</Text>
                                        <Text style={styles.vipTitle}>Custom Concierge</Text>
                                        <Text style={styles.vipSub}>Need something unique? Let us organize a custom job for you.</Text>
                                    </View>
                                    <View style={styles.vipIconCircle}>
                                        <Text style={styles.vipIcon}>🛎️</Text>
                                    </View>
                                </LinearGradient>
                            </PressableAnimated>
                        </FadeInView>

                        {/* 6. TRUST HORIZONTAL SNAP */}
                        <View style={styles.trustSection}>
                            <Text style={styles.sectionTitle}>The Zarva Standard</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={176} decelerationRate="fast" contentContainerStyle={styles.trustScroll}>
                                {trustBanners.map((banner, i) => (
                                    <FadeInView key={banner.id} delay={400 + (i * 50)}>
                                        <Card style={styles.trustCardSnap}>
                                            <View style={styles.trustHeader}>
                                                <Text style={styles.trustIconLg}>{banner.icon}</Text>
                                            </View>
                                            <Text style={styles.trustTitle}>{banner.title}</Text>
                                            <Text style={styles.trustTextSn}>{banner.text}</Text>
                                        </Card>
                                    </FadeInView>
                                ))}
                            </ScrollView>
                        </View>

                        {/* 7. RECENT ACTIVITY */}
                        {recentJobs.length > 0 && (
                            <View style={styles.recentSection}>
                                <View style={styles.sectionHeaderRow}>
                                    <Text style={styles.sectionTitle}>Your History</Text>
                                    <PressableAnimated onPress={() => navigation.navigate('MyJobs')}>
                                        <Text style={styles.viewAllHistory}>See All</Text>
                                    </PressableAnimated>
                                </View>
                                {recentJobs.map((job, i) => (
                                    <FadeInView key={job.id} delay={450 + (i * 60)}>
                                        <ActivityCard
                                            job={job}
                                            onPress={() => navigation.navigate('JobStatusDetail', { jobId: job.id })}
                                            categoryIcon={services.find(s => s.id === job.category)?.icon}
                                        />
                                    </FadeInView>
                                ))}
                            </View>
                        )}
                    </>
                )}

                <MapPickerModal
                    visible={isMapVisible}
                    onClose={() => setIsMapVisible(false)}
                    onSelectLocation={async (loc) => {
                        Alert.alert('Update Location', 'Set this as your primary service location?', [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: 'Set Primary',
                                onPress: async () => {
                                    const newLoc = { address: loc.address, lat: loc.latitude, lng: loc.longitude };
                                    setLocation(newLoc);
                                    setLocationOverride(newLoc);
                                    setIsMapVisible(false);
                                    try {
                                        await apiClient.post('/api/me/location', newLoc);
                                        const coverage = await coverageApi.checkServiceability(loc.latitude, loc.longitude);
                                        if (!coverage.is_serviceable) {
                                            setIsServiceable(false);
                                            Alert.alert('Area Not Covered', `We don't currently serve ${loc.address}.`);
                                        } else setIsServiceable(true);
                                    } catch (err) {}
                                }
                            }
                        ]);
                    }}
                />
            </Animated.ScrollView>
        </View>
    );
}

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.app },
    scrollView: { flex: 1 },
    content: { padding: 20, paddingTop: 10, paddingBottom: 140 },

    // 1. HERO GREETING
    heroSection: { marginBottom: 24 },
    heroHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    timeGreeting: { color: t.text.tertiary, fontSize: 14, fontWeight: '600', marginBottom: 4 },
    heroGreeting: { color: t.text.primary, fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
    locationPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.background.surfaceRaised, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 6, borderWidth: 1, borderColor: t.border.default + '44' },
    locDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.brand.primary },
    locationTxt: { color: t.text.secondary, fontSize: 11, fontWeight: 'bold', maxWidth: 80 },
    locationChevron: { color: t.text.tertiary, fontSize: 12, fontWeight: '900' },

    // 2. LIVE ACTIVITY
    liveActivityWrap: { position: 'relative', marginBottom: 24, borderRadius: 24, zIndex: 10 },
    liveJobGlow: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: 28, filter: 'blur(10px)' },
    liveActivityCard: { backgroundColor: t.background.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: t.brand.primary + '44' },
    liveHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    livePulseTxt: { color: t.brand.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
    liveBody: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    liveRadarBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: t.background.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
    liveInfo: { flex: 1 },
    liveCategory: { color: t.text.primary, fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
    liveDesc: { color: t.text.secondary, fontSize: 13 },
    liveActionBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.brand.primary, alignItems: 'center', justifyContent: 'center' },
    liveActionIcon: { color: t.background.app, fontSize: 16, fontWeight: 'bold' },

    // 3. SEARCH
    searchSection: { marginBottom: 32, zIndex: 5 },
    searchWrap: { position: 'relative' },
    searchGlow: { position: 'absolute', top: -6, left: -6, right: -6, bottom: -6, borderRadius: 30, filter: 'blur(12px)' },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.background.surfaceRaised, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 18, gap: 16, borderWidth: 1, borderColor: t.border.default + '22' },
    searchIcon: { fontSize: 22 },
    searchInput: { flex: 1, color: t.text.primary, fontSize: 16, fontWeight: '500' },

    // 4. BENTO GRID
    gridSection: { marginBottom: 32 },
    sectionTitle: { color: t.text.primary, fontSize: 20, fontWeight: '800', marginBottom: 16, letterSpacing: -0.3 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    bentoCard: { backgroundColor: t.background.surface, borderRadius: 24, padding: 20, alignItems: 'flex-start', justifyContent: 'space-between', height: 140, borderWidth: 1, borderColor: t.border.default + '15' },
    bentoIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.background.surfaceRaised, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    bentoIcon: { fontSize: 20 },
    bentoLabel: { color: t.text.primary, fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
    bentoSub: { color: t.brand.primary, fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
    seeAllBtn: { marginTop: 16, alignSelf: 'center', backgroundColor: t.background.surface, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, borderWidth: 1, borderColor: t.border.default },
    seeAllTxt: { color: t.text.primary, fontSize: 12, fontWeight: 'bold' },

    // 5. VIP CUSTOM
    vipSection: { marginBottom: 32 },
    vipCard: { borderRadius: 24, padding: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#44445A' },
    vipContent: { flex: 1, paddingRight: 20 },
    vipPreTitle: { color: '#E5C07B', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 8 },
    vipTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold', marginBottom: 6 },
    vipSub: { color: '#A0A0B0', fontSize: 13, lineHeight: 18 },
    vipIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
    vipIcon: { fontSize: 26 },

    // 6. TRUST HORIZONTAL SNAP
    trustSection: { marginBottom: 32 },
    trustScroll: { paddingRight: 20, gap: 16 },
    trustCardSnap: { width: 160, height: 160, backgroundColor: t.background.surface, borderRadius: 24, padding: 20, justifyContent: 'center', borderWidth: 1, borderColor: t.border.default + '22' },
    trustHeader: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.background.surfaceRaised, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    trustIconLg: { fontSize: 18 },
    trustTitle: { color: t.text.primary, fontSize: 15, fontWeight: 'bold', marginBottom: 8 },
    trustTextSn: { color: t.text.secondary, fontSize: 12, lineHeight: 16 },

    // 7. RECENT
    recentSection: { marginBottom: 20 },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
    viewAllHistory: { color: t.brand.primary, fontSize: 13, fontWeight: 'bold', marginBottom: 2 },
});
