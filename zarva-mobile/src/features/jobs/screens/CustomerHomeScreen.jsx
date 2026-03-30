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
import { LinearGradient } from 'expo-linear-gradient';

/**
 * HomeScreen.jsx - Standardized version to resolve tag mismatch and theme naming.
 */
export default function HomeScreen({ navigation }) {
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
    const [location, setLocation] = useState(locationOverride || { address: 'Fetching location...', lat: null, lng: null });
    const [isMapVisible, setIsMapVisible] = useState(false);
    const [isServiceable, setIsServiceable] = useState(true);
    // Only these statuses should be treated as an active request tile on Home.
    const ACTIVE_REQUEST_STATUSES = [
        'searching', 'assigned', 'worker_en_route', 'worker_arrived',
        'inspection_active', 'estimate_submitted', 'in_progress',
        'pause_requested', 'work_paused', 'resume_requested',
        'suspend_requested', 'customer_stopping'
    ];
    const MAX_CORE_SERVICES = 8;

    const trustBanners = useMemo(() => ([
        { id: 'vetted', icon: '🛡️', text: 'Elite Professionals. Vetted & Background Checked.' },
        { id: 'pricing', icon: '💎', text: 'Transparent Pricing. No Hidden Fees.' },
        { id: 'guarantee', icon: '⭐', text: 'ZARVA Guarantee. 100% Satisfaction.' },
    ]), []);

    const scrollY = useSharedValue(0);
    const searchPulse = useSharedValue(0);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    const searchGlowStyle = useAnimatedStyle(() => {
        const opacity = interpolate(searchPulse.value, [0, 1], [0.25, 0.85], 'clamp');
        const scale = interpolate(searchPulse.value, [0, 1], [0.985, 1.015], 'clamp');
        return {
            opacity,
            transform: [{ scale }],
        };
    });

    const isSearching = searchQuery.trim() !== '';
    const displayedServices = isSearching
        ? services.filter(s => s.label.toLowerCase().includes(searchQuery.toLowerCase()))
        : (showAllServices ? services : services.slice(0, MAX_CORE_SERVICES));
    const shouldShowSeeAll = !isSearching && services.length > MAX_CORE_SERVICES;
    const gridItemSize = useMemo(() => {
        const horizontalPadding = tTheme.spacing['2xl'] * 2;
        const gap = tTheme.spacing.lg;
        const available = screenWidth - horizontalPadding - gap;
        return available / 2;
    }, [screenWidth, tTheme]);

    useEffect(() => {
        searchPulse.value = withRepeat(
            withTiming(1, { duration: durations.screen * 4 }),
            -1,
            true
        );
    }, []);

    useEffect(() => {
        setIsLoadingServices(true);
        apiClient.get('/api/jobs/config')
            .then(res => {
                if (res.data?.categories) setServices(Object.values(res.data.categories));
            })
            .catch(err => console.error('Failed to fetch jobs configuration', err))
            .finally(() => setIsLoadingServices(false));
    }, []);

    useFocusEffect(useCallback(() => { fetchHomescreenData(); }, []));

    const fetchHomescreenData = async () => {
        try {
            const res = await apiClient.get('/api/jobs');
            const jobs = res.data?.jobs || [];
            setRecentJobs(jobs.slice(0, 2));

            // Keep a persistent Active Job tile by deriving ongoing job from server truth on every Home focus.
            const ongoingJob = jobs.find((job) => ACTIVE_REQUEST_STATUSES.includes(job.status));

            // Sync Zustand state so tile persists even after app relaunch/navigation reset.
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
                const [addressArr] = await Location.reverseGeocodeAsync({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude
                });
                let addressText = addressArr
                    ? [addressArr.name, addressArr.city, addressArr.subregion]
                        .filter(Boolean)
                        .filter((v, i, a) => a.indexOf(v) === i)
                        .join(', ')
                    : 'Unknown';
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
            console.error('[HomeScreen] Coverage check failed', err);
            // Default to serviceable on error to not block users unnecessarily
            setIsServiceable(true);
        }
    };

    return (
        <View style={styles.screen}>
            {/* Fixed Zarva Header */}
            <ZarvaHeader
                subtitle="Home Services"
                onPressNotification={null}
            />

            <View style={styles.headerDock}>
                <PressableAnimated style={styles.locationPill} onPress={() => setIsMapVisible(true)}>
                    <Text style={styles.locationTxt} numberOfLines={1}>📍 Current Location</Text>
                    <Text style={styles.locationChevron}>⌄</Text>
                </PressableAnimated>
            </View>
            <Animated.ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
            >
                {!isServiceable ? (
                    <NotCoveredView
                        locationName={location.address}
                        onRetry={() => setIsMapVisible(true)}
                    />
                ) : (
                    <>
                        <FadeInView delay={100} style={styles.heroSection}>
                            <Text style={styles.greeting}>{t('customer_home_greeting')}</Text>
                            <Text style={styles.subGreeting}>{t('premium_services_desc')}</Text>
                        </FadeInView>

                        <FadeInView delay={160} style={styles.searchSection}>
                            <View style={styles.searchWrap}>
                                <Animated.View pointerEvents="none" style={[styles.searchGlow, searchGlowStyle]}>
                                    <LinearGradient
                                        colors={[
                                            tTheme.brand.primary + '66',
                                            tTheme.brand.secondary + '55',
                                            (tTheme.brand.accent || tTheme.brand.primary) + '44',
                                        ]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={StyleSheet.absoluteFillObject}
                                    />
                                </Animated.View>
                                <View style={styles.searchBar}>
                                    <Text style={styles.searchIcon}>🔍</Text>
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="What do you need help with today?"
                                        placeholderTextColor={tTheme.text.secondary}
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                    />
                                </View>
                            </View>
                        </FadeInView>

                        {activeJob && searchPhase && ACTIVE_REQUEST_STATUSES.includes(searchPhase) && (
                            <FadeInView delay={220} style={styles.activeMiniWrap}>
                                <Card glow style={styles.activeMiniCard}>
                                    <View style={styles.activeMiniLeft}>
                                        <View style={styles.activeRadar}>
                                            <RadarAnimation size={30} />
                                        </View>
                                        <View style={styles.activeMiniInfo}>
                                            <Text style={styles.activeMiniLabel}>{t('active_request')}</Text>
                                            <Text style={styles.activeMiniName} numberOfLines={1}>
                                                {t(`cat_${activeJob.category}`) || activeJob.category}
                                            </Text>
                                            <Text style={styles.activeMiniDesc} numberOfLines={1}>
                                                {searchPhase === 'searching' ? t('finding_best_worker') : t('service_in_progress')}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.activeMiniRight}>
                                        <StatusPill status={searchPhase} />
                                        <PressableAnimated
                                            style={styles.activeMiniBtn}
                                            onPress={() => searchPhase === 'searching'
                                                ? navigation.navigate('Searching', { category: activeJob.category, jobId: activeJob.id })
                                                : navigation.navigate('JobStatusDetail', { jobId: activeJob.id })}
                                        >
                                            <Text style={styles.activeMiniBtnText}>Track</Text>
                                        </PressableAnimated>
                                    </View>
                                </Card>
                            </FadeInView>
                        )}

                        <View style={styles.gridSection}>
                            <Text style={styles.sectionTitle}>{t('categories')}</Text>
                            <View style={styles.grid}>
                                {isLoadingServices ? (
                                    [1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                        <SkeletonCard key={i} width={gridItemSize} height={gridItemSize} />
                                    ))
                                ) : (
                                    displayedServices.map((s, i) => (
                                        <FadeInView key={s.id} delay={100 + (i * 50)} style={[styles.gridItem, { width: gridItemSize }]}>
                                            <PressableAnimated
                                                style={styles.serviceCard}
                                                onPress={() => navigation.navigate('DynamicQuestions', { category: s.id, label: s.label })}
                                            >
                                                <View style={styles.iconCircle}>
                                                    <Text style={styles.gridIcon}>{s.icon || '🛠️'}</Text>
                                                </View>
                                                <Text style={styles.gridLabel}>{s.label}</Text>
                                            </PressableAnimated>
                                        </FadeInView>
                                    ))
                                )}
                            </View>

                            {shouldShowSeeAll && (
                                <PressableAnimated
                                    style={styles.seeAllBtn}
                                    onPress={() => setShowAllServices(!showAllServices)}
                                >
                                    <Text style={styles.seeAllTxt}>{showAllServices ? 'Show Less' : 'See All'}</Text>
                                </PressableAnimated>
                            )}
                        </View>

                        <View style={styles.trustSection}>
                            <Text style={styles.sectionTitle}>Premium Assurance</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.trustRow}
                            >
                                {trustBanners.map((banner, i) => (
                                    <FadeInView key={banner.id} delay={160 + (i * 60)} style={styles.trustItem}>
                                        <Card glow style={styles.trustCard}>
                                            <LinearGradient
                                                colors={[
                                                    tTheme.brand.primary + '22',
                                                    tTheme.brand.secondary + '18',
                                                    (tTheme.brand.accent || tTheme.brand.primary) + '12',
                                                ]}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                                style={StyleSheet.absoluteFillObject}
                                            />
                                            <View style={styles.trustIconWrap}>
                                                <Text style={styles.trustIcon}>{banner.icon}</Text>
                                            </View>
                                            <Text style={styles.trustText}>{banner.text}</Text>
                                        </Card>
                                    </FadeInView>
                                ))}
                            </ScrollView>
                        </View>

                        <FadeInView delay={360} style={styles.conciergeSection}>
                            <PressableAnimated
                                style={styles.conciergeCard}
                                onPress={() => navigation.navigate('MyCustomRequests')}
                            >
                                <View style={styles.conciergeLeft}>
                                    <Text style={styles.conciergeTitle}>Track Custom Requests</Text>
                                    <Text style={styles.conciergeSub}>
                                        View status or post approved custom requests live.
                                    </Text>
                                </View>
                                <Text style={styles.conciergeChevron}>›</Text>
                            </PressableAnimated>
                        </FadeInView>

                        {recentJobs.length > 0 && (
                            <View style={styles.recentSection}>
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionTitle}>{t('recent_activity')}</Text>
                                    <PressableAnimated onPress={() => navigation.navigate('MyJobs')}>
                                        <Text style={styles.viewAllTxt}>View All History</Text>
                                    </PressableAnimated>
                                </View>
                                {recentJobs.slice(0, 2).map((job, i) => (
                                    <FadeInView key={job.id} delay={200 + (i * 60)}>
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
                        Alert.alert(
                            'Update Location',
                            'Would you like to set this as your primary service location?',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Set Primary',
                                    onPress: async () => {
                                        const newLoc = { address: loc.address, lat: loc.latitude, lng: loc.longitude };
                                        setLocation(newLoc);
                                        setLocationOverride(newLoc);
                                        setIsMapVisible(false);

                                        try {
                                            // 1. Persist to customer profile
                                            await apiClient.post('/api/me/location', newLoc);

                                            // 2. Proactively check if anyone at all is serving this area
                                            const coverage = await coverageApi.checkServiceability(
                                                loc.latitude, loc.longitude
                                            );

                                            if (!coverage.is_serviceable) {
                                                setIsServiceable(false);
                                                Alert.alert(
                                                    'Area Not Covered',
                                                    `We don't currently have professionals available in ${loc.address}. We hope to expand here soon!`
                                                );
                                            } else {
                                                setIsServiceable(true);
                                            }
                                        } catch (err) {
                                            console.error('[HomeScreen] Location Sync / Coverage check failed', err);
                                        }
                                    }
                                }
                            ]
                        );
                    }}
                />
            </Animated.ScrollView>
        </View>
    );
}

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.app },
    scrollView: { flex: 1 },
    content: { padding: t.spacing['2xl'], paddingTop: t.spacing['2xl'], paddingBottom: 120 },

    headerDock: {
        paddingHorizontal: t.spacing['2xl'],
        paddingBottom: t.spacing.md,
        backgroundColor: t.background.app,
        zIndex: 5,
    },
    locationPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: t.background.surface,
        alignSelf: 'flex-start',
        paddingHorizontal: t.spacing.md,
        paddingVertical: t.spacing.sm,
        borderRadius: t.radius.full,
        borderWidth: 1,
        borderColor: t.brand.primary + '22',
        gap: t.spacing.sm,
        ...t.shadows.premium
    },
    locationTxt: { color: t.text.primary, fontSize: t.typography.size.micro, fontWeight: t.typography.weight.semibold, letterSpacing: 0.6 },
    locationChevron: { color: t.text.secondary, fontSize: 14 },

    heroSection: { marginTop: t.spacing.sm },
    greeting: { color: t.text.primary, fontSize: t.typography.size.hero, fontWeight: t.typography.weight.semibold, letterSpacing: t.typography.tracking.hero },
    subGreeting: { color: t.text.secondary, fontSize: t.typography.size.body, marginTop: 4, letterSpacing: t.typography.tracking.body },

    searchSection: { marginTop: t.spacing.lg },
    searchWrap: { position: 'relative', borderRadius: t.radius.full, overflow: 'visible' },
    searchGlow: {
        position: 'absolute',
        top: -2,
        left: -2,
        right: -2,
        bottom: -2,
        borderRadius: t.radius.full,
        shadowColor: t.brand.primary,
        shadowOpacity: 0.45,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 0 },
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: t.background.surface,
        borderRadius: t.radius.full,
        paddingHorizontal: t.spacing['2xl'],
        paddingVertical: t.spacing.xl,
        gap: t.spacing.lg,
        borderWidth: 1,
        borderColor: t.brand.primary + '22',
        ...t.shadows.premium
    },
    searchIcon: { fontSize: 20 },
    searchInput: { flex: 1, color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.medium, paddingVertical: 4 },

    activeMiniWrap: { marginTop: t.spacing.lg },
    activeMiniCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: t.spacing.lg, gap: t.spacing.lg },
    activeMiniLeft: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, flex: 1 },
    activeRadar: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.background.surfaceRaised, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    activeMiniInfo: { flex: 1 },
    activeMiniLabel: { color: t.brand.primary, fontSize: t.typography.size.micro, fontWeight: t.typography.weight.bold, letterSpacing: 1.6, textTransform: 'uppercase' },
    activeMiniName: { color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.semibold, marginTop: 2 },
    activeMiniDesc: { color: t.text.secondary, fontSize: t.typography.size.micro, marginTop: 2 },
    activeMiniRight: { alignItems: 'flex-end', gap: t.spacing.sm },
    activeMiniBtn: {
        paddingHorizontal: t.spacing.md,
        paddingVertical: 6,
        borderRadius: t.radius.full,
        borderWidth: 1,
        borderColor: t.brand.primary + '55',
        backgroundColor: t.background.surfaceRaised,
    },
    activeMiniBtnText: { color: t.brand.primary, fontSize: t.typography.size.micro, fontWeight: t.typography.weight.bold, letterSpacing: 1.1, textTransform: 'uppercase' },

    gridSection: { marginTop: t.spacing['2xl'] },
    sectionTitle: { color: t.text.primary, fontSize: t.typography.size.cardTitle, fontWeight: t.typography.weight.semibold, marginBottom: t.spacing.lg, letterSpacing: t.typography.tracking.cardTitle },
    grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: t.spacing.lg, columnGap: t.spacing.lg },
    gridItem: { alignItems: 'stretch' },
    serviceCard: {
        width: '100%',
        aspectRatio: 1,
        backgroundColor: t.background.surface,
        borderRadius: t.radius.xl,
        padding: t.spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
        gap: t.spacing.md,
        ...t.shadows.premium
    },
    iconCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: t.background.surfaceRaised, justifyContent: 'center', alignItems: 'center' },
    gridIcon: { fontSize: 30 },
    gridLabel: {
        color: t.text.primary,
        fontSize: t.typography.size.micro,
        fontWeight: t.typography.weight.bold,
        letterSpacing: 1.6,
        textTransform: 'uppercase',
        textAlign: 'center'
    },
    seeAllBtn: {
        alignSelf: 'flex-end',
        marginTop: t.spacing.md,
        paddingHorizontal: t.spacing.md,
        paddingVertical: t.spacing.sm,
        borderRadius: t.radius.full,
        borderWidth: 1,
        borderColor: t.brand.primary + '30',
    },
    seeAllTxt: { color: t.brand.primary, fontSize: t.typography.size.micro, fontWeight: t.typography.weight.bold, letterSpacing: 1.4, textTransform: 'uppercase' },

    trustSection: { marginTop: t.spacing['2xl'] },
    trustRow: { paddingRight: t.spacing['2xl'], gap: t.spacing.lg },
    trustItem: {},
    trustCard: {
        width: 260,
        minHeight: 120,
        padding: t.spacing.lg,
        borderRadius: t.radius.xl,
        backgroundColor: t.background.surface,
        overflow: 'hidden',
        justifyContent: 'space-between',
        ...t.shadows.premium
    },
    trustIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: t.background.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
    trustIcon: { fontSize: 18 },
    trustText: { color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.medium, marginTop: t.spacing.sm },

    conciergeSection: { marginTop: t.spacing['2xl'] },
    conciergeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: t.background.surface,
        padding: t.spacing.lg,
        borderRadius: t.radius.xl,
        borderWidth: 1,
        borderColor: t.brand.primary + '22',
        ...t.shadows.premium
    },
    conciergeLeft: { flex: 1, paddingRight: t.spacing.md },
    conciergeTitle: { color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.semibold, letterSpacing: t.typography.tracking.body },
    conciergeSub: { color: t.text.secondary, fontSize: t.typography.size.micro, marginTop: 4 },
    conciergeChevron: { color: t.text.secondary, fontSize: 22 },

    recentSection: { marginTop: t.spacing['2xl'] },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: t.spacing.lg },
    viewAllTxt: { color: t.brand.primary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.bold, letterSpacing: 0.6 },
});

