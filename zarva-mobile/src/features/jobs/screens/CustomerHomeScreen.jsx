import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTokens } from '@shared/design-system';
import { View, Text, StyleSheet, TextInput, Alert, ScrollView, useWindowDimensions, TouchableOpacity } from 'react-native';
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

    const trustBanners = useMemo(() => ([
        { id: 'vetted', icon: '🛡️', title: 'Elite Pros', text: 'Top 5% vetted experts.' },
        { id: 'pricing', icon: '💎', title: 'Fixed Pricing', text: 'No surprises, ever.' },
        { id: 'guarantee', icon: '⭐', title: 'Zarva Promise', text: 'Flawless execution.' },
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
        const opacity = interpolate(searchPulse.value, [0, 1], [0.1, 0.4], 'clamp');
        return { opacity };
    });

    const liveJobGlowStyle = useAnimatedStyle(() => {
        const opacity = interpolate(liveJobPulse.value, [0, 1], [0.3, 0.8], 'clamp');
        return { opacity };
    });

    const displayedServices = searchQuery.trim() !== ''
        ? services.filter(s => s.label.toLowerCase().includes(searchQuery.toLowerCase()))
        : services;

    const getTimeGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return t('good_morning') || 'Good Morning';
        if (hour < 17) return t('good_afternoon') || 'Good Afternoon';
        return t('good_evening') || 'Good Evening';
    };

    useEffect(() => {
        searchPulse.value = withRepeat(withTiming(1, { duration: 4000 }), -1, true);
        liveJobPulse.value = withRepeat(withTiming(1, { duration: 1500 }), -1, true);
    }, []);

    useEffect(() => {
        setIsLoadingServices(true);
        apiClient.get('/api/jobs/config')
            .then(res => {
                if (res.data?.categories) setServices(Object.values(res.data.categories));
            })
            .catch(() => { })
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
            {/* Minimalist Header */}
            <ZarvaHeader hideSubtitle />

            {/* 1. THE LOCATION HUB (Sticky feeling, highly integrated) */}
            <View style={styles.locationHub}>
                <View style={styles.locationHubInner}>
                    <View style={styles.locIconWrap}>
                        <Text style={styles.locIcon}>📍</Text>
                    </View>
                    <TouchableOpacity style={styles.locTextWrap} onPress={() => setIsMapVisible(true)}>
                        <Text style={styles.locLabel}>SERVICE LOCATION</Text>
                        <View style={styles.locValueRow}>
                            <Text style={styles.locValue} numberOfLines={1}>{location.address}</Text>
                            <Text style={styles.locChevron}>▾</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>

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
                        {/* 2. HERO & SMART SEARCH */}
                        <FadeInView delay={100} style={styles.heroSection}>
                            <Text style={styles.heroGreeting}>{getTimeGreeting()}</Text>
                            <Text style={styles.heroQuestion}>What do you need done?</Text>

                            <View style={styles.searchContainer}>
                                <Animated.View pointerEvents="none" style={[styles.searchGlow, searchGlowStyle, { backgroundColor: tTheme.brand.primary }]} />
                                <View style={styles.searchBox}>
                                    <Text style={styles.searchIcon}>✨</Text>
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="E.g., Fix my AC, Mount a TV..."
                                        placeholderTextColor={tTheme.text.tertiary}
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                    />
                                    {searchQuery.trim() !== '' && (
                                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                                            <Text style={styles.searchClear}>✕</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        </FadeInView>

                        {/* 3. LIVE ACTIVITY ISLAND */}
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
                                        <Text style={styles.livePulseTxt}>● ACTIVE CONCIERGE</Text>
                                        <StatusPill status={searchPhase} />
                                    </View>
                                    <View style={styles.liveBody}>
                                        <View style={styles.liveRadarBox}>
                                            <RadarAnimation size={36} />
                                        </View>
                                        <View style={styles.liveInfo}>
                                            <Text style={styles.liveCategory}>{t(`cat_${activeJob.category}`) || activeJob.category}</Text>
                                            <Text style={styles.liveDesc} numberOfLines={1}>
                                                {searchPhase === 'searching' ? 'Securing a professional...' : 'Service is underway.'}
                                            </Text>
                                        </View>
                                        <Text style={styles.liveActionIcon}>➔</Text>
                                    </View>
                                </PressableAnimated>
                            </FadeInView>
                        )}

                        {/* 4. QUICK ACTION CAROUSEL (Replacing the massive Grid) */}
                        <View style={styles.quickActionSection}>
                            {isLoadingServices ? (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.qaScroll}>
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <View key={i} style={styles.qaItem}>
                                            <SkeletonCard width={64} height={64} style={{ borderRadius: 32 }} />
                                            <SkeletonCard width={50} height={10} style={{ marginTop: 8 }} />
                                        </View>
                                    ))}
                                </ScrollView>
                            ) : (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.qaScroll}>
                                    {displayedServices.map((s, i) => (
                                        <FadeInView key={s.id} delay={200 + (i * 30)}>
                                            <PressableAnimated
                                                style={styles.qaItem}
                                                onPress={() => navigation.navigate('DynamicQuestions', { category: s.id, label: s.label })}
                                            >
                                                <View style={styles.qaIconCircle}>
                                                    <Text style={styles.qaIcon}>{s.icon || '🛠️'}</Text>
                                                </View>
                                                <Text style={styles.qaLabel} numberOfLines={1}>{s.label}</Text>
                                            </PressableAnimated>
                                        </FadeInView>
                                    ))}
                                    {/* Appended 'Custom' action directly in the scroll for easy access */}
                                    <FadeInView delay={400}>
                                        <PressableAnimated
                                            style={styles.qaItem}
                                            onPress={() => navigation.navigate('CreateCustomJob')}
                                        >
                                            <View style={[styles.qaIconCircle, styles.qaIconCircleSpecial]}>
                                                <Text style={styles.qaIcon}>🛎️</Text>
                                            </View>
                                            <Text style={[styles.qaLabel, styles.qaLabelSpecial]} numberOfLines={1}>Custom</Text>
                                        </PressableAnimated>
                                    </FadeInView>
                                </ScrollView>
                            )}
                        </View>

                        {/* 5. ZARVA BLUEPRINT: CUSTOM CONCIERGE */}
                        <FadeInView delay={300} style={styles.blueprintSection}>
                            <PressableAnimated onPress={() => navigation.navigate('CreateCustomJob')}>
                                <LinearGradient
                                    colors={['#0F172A', '#1E293B']} // Deep architectural navy
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                    style={styles.blueprintCard}
                                >
                                    <View style={styles.blueprintLeft}>
                                        <View style={styles.blueprintBadgeRow}>
                                            <Text style={styles.blueprintBadgeIcon}>📐</Text>
                                            <Text style={styles.blueprintBadge}>ZARVA BLUEPRINT</Text>
                                        </View>
                                        <Text style={styles.blueprintTitle}>Craft Your Job</Text>
                                        <Text style={styles.blueprintSub}>
                                            Have a unique requirement? Outline your needs and we'll assemble the perfect talent to build it.
                                        </Text>
                                    </View>
                                    <View style={styles.blueprintRight}>
                                        <Text style={styles.blueprintRightIcon}>+</Text>
                                    </View>
                                </LinearGradient>
                            </PressableAnimated>
                        </FadeInView>

                        {/* 6. TRUST SNAPPERS (Compact) */}
                        <View style={styles.trustSection}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={140} decelerationRate="fast" contentContainerStyle={styles.trustScroll}>
                                {trustBanners.map((banner, i) => (
                                    <FadeInView key={banner.id} delay={350 + (i * 50)}>
                                        <View style={styles.trustChip}>
                                            <Text style={styles.trustIconSm}>{banner.icon}</Text>
                                            <View>
                                                <Text style={styles.trustTitleSm}>{banner.title}</Text>
                                                <Text style={styles.trustTextXs}>{banner.text}</Text>
                                            </View>
                                        </View>
                                    </FadeInView>
                                ))}
                            </ScrollView>
                        </View>

                        {/* 7. RECENT ACTIVITY */}
                        {recentJobs.length > 0 && (
                            <View style={styles.recentSection}>
                                <View style={styles.sectionHeaderRow}>
                                    <Text style={styles.sectionTitle}>Recent History</Text>
                                    <PressableAnimated onPress={() => navigation.navigate('MyJobs')}>
                                        <Text style={styles.viewAllHistory}>See All</Text>
                                    </PressableAnimated>
                                </View>
                                {recentJobs.map((job, i) => (
                                    <FadeInView key={job.id} delay={400 + (i * 60)}>
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
                                    } catch (err) { }
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

    // 1. LOCATION HUB
    locationHub: { backgroundColor: t.background.app, paddingHorizontal: 20, paddingBottom: 10, zIndex: 10 },
    locationHubInner: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.background.surface, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: t.border.default + '33' },
    locIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: t.background.surfaceRaised, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    locIcon: { fontSize: 16 },
    locTextWrap: { flex: 1 },
    locLabel: { color: t.brand.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 },
    locValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    locValue: { color: t.text.primary, fontSize: 14, fontWeight: 'bold', flexShrink: 1 },
    locChevron: { color: t.text.tertiary, fontSize: 12, fontWeight: 'bold' },

    scrollView: { flex: 1 },
    content: { paddingTop: 10, paddingBottom: 140 },

    // 2. HERO & SEARCH
    heroSection: { paddingHorizontal: 20, marginBottom: 32, marginTop: 10 },
    heroGreeting: { color: t.text.secondary, fontSize: 16, fontWeight: '500', marginBottom: 4 },
    heroQuestion: { color: t.text.primary, fontSize: 32, fontWeight: '900', letterSpacing: -0.5, marginBottom: 24 },
    searchContainer: { position: 'relative' },
    searchGlow: { position: 'absolute', top: -10, left: -10, right: -10, bottom: -10, borderRadius: 32, filter: 'blur(20px)' },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.background.surfaceRaised, borderRadius: 20, paddingHorizontal: 20, height: 64, borderWidth: 1, borderColor: t.border.default + '44', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10 },
    searchIcon: { fontSize: 22, marginRight: 16 },
    searchInput: { flex: 1, color: t.text.primary, fontSize: 16, fontWeight: '600' },
    searchClear: { color: t.text.tertiary, fontSize: 18, fontWeight: 'bold', padding: 8 },

    // 3. LIVE ACTIVITY
    liveActivityWrap: { position: 'relative', marginHorizontal: 20, marginBottom: 32, borderRadius: 20, zIndex: 10 },
    liveJobGlow: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: 24, filter: 'blur(12px)' },
    liveActivityCard: { backgroundColor: t.background.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: t.border.default },
    liveHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    livePulseTxt: { color: t.brand.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
    liveBody: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    liveRadarBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.background.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
    liveInfo: { flex: 1 },
    liveCategory: { color: t.text.primary, fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
    liveDesc: { color: t.text.secondary, fontSize: 12 },
    liveActionIcon: { color: t.brand.primary, fontSize: 20, fontWeight: 'bold' },

    // 4. QUICK ACTION CAROUSEL
    quickActionSection: { marginBottom: 36 },
    qaScroll: { paddingHorizontal: 20, gap: 20 },
    qaItem: { alignItems: 'center', width: 72 },
    qaIconCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: t.background.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 10, borderWidth: 1, borderColor: t.border.default + '33', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
    qaIconCircleSpecial: { backgroundColor: '#2D2D3F', borderColor: '#44445A' },
    qaIcon: { fontSize: 28 },
    qaLabel: { color: t.text.secondary, fontSize: 11, fontWeight: '700', textAlign: 'center' },
    qaLabelSpecial: { color: '#E5C07B' },

    // 5. ZARVA BLUEPRINT
    blueprintSection: { paddingHorizontal: 20, marginBottom: 32 },
    blueprintCard: {
        borderRadius: 20,
        padding: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 12,
        borderWidth: 1,
        borderColor: '#334155'
    },
    blueprintLeft: { flex: 1, paddingRight: 20 },
    blueprintBadgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 6 },
    blueprintBadgeIcon: { fontSize: 12 },
    blueprintBadge: { color: '#94A3B8', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
    blueprintTitle: { color: '#F8FAFC', fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
    blueprintSub: { color: '#CBD5E1', fontSize: 13, lineHeight: 20 },
    blueprintRight: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        borderStyle: 'dashed' // Gives it a subtle "blueprint" drafting feel
    },
    blueprintRightIcon: { color: '#F8FAFC', fontSize: 24, fontWeight: '300' },

    // 6. COMPACT TRUST CHIPS
    trustSection: { marginBottom: 32 },
    trustScroll: { paddingHorizontal: 20, gap: 12 },
    trustChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.background.surface, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: t.border.default + '22', width: 200, gap: 12 },
    trustIconSm: { fontSize: 20, backgroundColor: t.background.surfaceRaised, padding: 8, borderRadius: 12, overflow: 'hidden' },
    trustTitleSm: { color: t.text.primary, fontSize: 13, fontWeight: 'bold', marginBottom: 2 },
    trustTextXs: { color: t.text.secondary, fontSize: 10 },

    // 7. RECENT ACTIVITY
    recentSection: { paddingHorizontal: 20, marginBottom: 20 },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
    sectionTitle: { color: t.text.primary, fontSize: 18, fontWeight: '800' },
    viewAllHistory: { color: t.brand.primary, fontSize: 12, fontWeight: 'bold', marginBottom: 2 },
});
