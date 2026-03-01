import React, { useState, useEffect, useCallback } from 'react';
import { useTokens } from '../../design-system';
import { View, Text, StyleSheet, TextInput, Alert } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    useAnimatedScrollHandler,
    interpolate
} from 'react-native-reanimated';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import { useT } from '../../hooks/useT';
import { useJobStore } from '../../stores/jobStore';
import apiClient from '../../services/api/client';
import FadeInView from '../../components/FadeInView';
import PremiumButton from '../../components/PremiumButton';


import { durations } from '../../design-system/motion';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import SkeletonCard from '../../design-system/components/SkeletonCard';
import StatusPill from '../../components/StatusPill';
import RadarAnimation from '../../components/RadarAnimation';
import Card from '../../components/Card';
import MapPickerModal from '../../components/MapPickerModal';
import NotCoveredView from '../../components/NotCoveredView';
import ActivityCard from '../../components/ActivityCard';

/**
 * HomeScreen.jsx - Standardized version to resolve tag mismatch and theme naming.
 */
export default function HomeScreen({ navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const [recentJobs, setRecentJobs] = useState([]);
    const [services, setServices] = useState([]);
    const [isLoadingServices, setIsLoadingServices] = useState(true);
    const [showAllServices, setShowAllServices] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const { activeJob, searchPhase, locationOverride, setLocationOverride, setLastKnownLocation } = useJobStore();
    const [location, setLocation] = useState(locationOverride || { address: 'Fetching location...', lat: null, lng: null });
    const [isMapVisible, setIsMapVisible] = useState(false);
    const [isServiceable, setIsServiceable] = useState(true);

    const scrollY = useSharedValue(0);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    const headerStyle = useAnimatedStyle(() => {
        const opacity = interpolate(scrollY.value, [0, 60], [0, 1], 'clamp');
        return {
            opacity,
            backgroundColor: tTheme.background.app + 'EE',
        };
    });

    const isSearching = searchQuery.trim() !== '';
    const displayedServices = isSearching
        ? services.filter(s => s.label.toLowerCase().includes(searchQuery.toLowerCase()))
        : (showAllServices ? services : services.slice(0, 6));

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
            setRecentJobs((res.data?.jobs || []).slice(0, 3));
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
            const coverage = await apiClient.post('/api/coverage/check', {
                latitude: lat,
                longitude: lng
            });
            setIsServiceable(coverage.data.is_serviceable === true);
        } catch (err) {
            console.error('[HomeScreen] Coverage check failed', err);
            // Default to serviceable on error to not block users unnecessarily
            setIsServiceable(true);
        }
    };

    return (
        <View style={styles.screen}>
            {/* Animated Header */}
            <Animated.View style={[styles.headerFloating, headerStyle]}>
                <Text style={styles.headerTitle}>Zarva</Text>
            </Animated.View>

            <Animated.ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
            >
                <View style={styles.topBar}>
                    <PressableAnimated style={styles.locationPill} onPress={() => setIsMapVisible(true)}>
                        <Text style={styles.locationTxt} numberOfLines={1}>📍 {location.address}</Text>
                        <Text style={styles.locationChevron}>⌄</Text>
                    </PressableAnimated>
                </View>

                {!isServiceable ? (
                    <NotCoveredView
                        locationName={location.address}
                        onRetry={() => setIsMapVisible(true)}
                    />
                ) : (
                    <>
                        <FadeInView delay={100}>
                            <Text style={styles.greeting}>{t('customer_home_greeting')}</Text>
                            <Text style={styles.subGreeting}>{t('premium_services_desc')}</Text>
                        </FadeInView>

                        {activeJob && searchPhase && (
                            <FadeInView delay={200}>
                                <Card glow style={styles.activeJobCard}>
                                    <View style={styles.activeHeader}>
                                        <Text style={styles.activeLabel}>{t('active_request')}</Text>
                                        <StatusPill status={searchPhase} />
                                    </View>
                                    <View style={styles.activeBody}>
                                        <View style={styles.serviceIconWrap}>
                                            <RadarAnimation size={40} />
                                        </View>
                                        <View style={styles.activeInfo}>
                                            <Text style={styles.activeName}>{t(`cat_${activeJob.category}`) || activeJob.category}</Text>
                                            <Text style={styles.activeStatusDesc}>
                                                {searchPhase === 'searching' ? t('finding_best_worker') : t('service_in_progress')}
                                            </Text>
                                        </View>
                                    </View>
                                    <PremiumButton
                                        title={t('track_status')}
                                        onPress={() => searchPhase === 'searching' ? navigation.navigate('Searching', { category: activeJob.category, jobId: activeJob.id }) : navigation.navigate('JobStatusDetail', { jobId: activeJob.id })}
                                    />
                                </Card>
                            </FadeInView>
                        )}

                        <FadeInView delay={300} style={styles.searchSection}>
                            <View style={styles.searchBar}>
                                <Text style={styles.searchIcon}>🔍</Text>
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder={t('what_need_help_with')}
                                    placeholderTextColor={tTheme.text.secondary}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                            </View>
                        </FadeInView>

                        <View style={styles.gridSection}>
                            <Text style={styles.sectionTitle}>{t('categories')}</Text>
                            <View style={styles.grid}>
                                {isLoadingServices ? (
                                    [1, 2, 3, 4, 5, 6].map((i) => (
                                        <SkeletonCard key={i} width={'47%'} height={120} />
                                    ))
                                ) : (
                                    displayedServices.map((s, i) => (
                                        <FadeInView key={s.id} delay={100 + (i * 50)} style={styles.gridItem}>
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

                            <FadeInView delay={400} style={{ marginTop: 24, gap: 12 }}>

                                <PressableAnimated
                                    style={{
                                        backgroundColor: tTheme.background.surfaceRaised,
                                        padding: 16,
                                        borderRadius: tTheme.radius.xl,
                                        borderWidth: 1,
                                        borderColor: tTheme.status.warning.base + '40',
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}
                                    onPress={() => navigation.navigate('MyCustomRequests')}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: tTheme.text.primary, fontSize: tTheme.typography.size.body, fontWeight: 'bold' }}>
                                            Track Custom Requests
                                        </Text>
                                        <Text style={{ color: tTheme.text.secondary, fontSize: 12, marginTop: 4 }}>
                                            View status or post approved custom requests live.
                                        </Text>
                                    </View>
                                    <Text style={{ fontSize: 20 }}>📋</Text>
                                </PressableAnimated>
                            </FadeInView>
                        </View>

                        {recentJobs.length > 0 && (
                            <View style={styles.recentSection}>
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionTitle}>{t('recent_activity')}</Text>
                                    <PressableAnimated onPress={() => navigation.navigate('MyJobs')}>
                                        <Text style={styles.viewAllTxt}>{t('view_all')}</Text>
                                    </PressableAnimated>
                                </View>
                                {recentJobs.map((job, i) => (
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
                                            const coverage = await apiClient.post('/api/coverage/check', {
                                                latitude: loc.latitude,
                                                longitude: loc.longitude
                                            });

                                            if (!coverage.data.is_serviceable) {
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
    content: { padding: t.spacing['2xl'], paddingTop: 100, paddingBottom: 120 },

    headerFloating: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 100,
        paddingTop: 50,
        alignItems: 'center',
        zIndex: 10,
    },
    headerTitle: {
        color: t.text.primary,
        fontSize: t.typography.size.body,
        fontWeight: t.typography.weight.bold,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },

    topBar: { marginBottom: t.spacing[32] },
    locationPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: t.background.surface,
        alignSelf: 'flex-start',
        paddingHorizontal: t.spacing.lg,
        paddingVertical: t.spacing.md,
        borderRadius: t.radius.full,
        gap: t.spacing.sm,
        ...t.shadows.premium
    },
    locationTxt: { color: t.text.primary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.medium, maxWidth: 200 },
    locationChevron: { color: t.brand.primary, fontSize: 16 },

    greeting: { color: t.text.primary, fontSize: t.typography.size.hero, fontWeight: t.typography.weight.semibold, letterSpacing: t.typography.tracking.hero },
    subGreeting: { color: t.text.secondary, fontSize: t.typography.size.body, marginTop: 4, letterSpacing: t.typography.tracking.body },

    activeJobCard: { marginTop: t.spacing[32], gap: t.spacing.lg },
    activeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    activeLabel: { color: t.brand.primary, fontSize: t.typography.size.micro, fontWeight: t.typography.weight.bold, letterSpacing: 1.5 },
    activeBody: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.lg, marginVertical: t.spacing.sm },
    serviceIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.background.surfaceRaised, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    activeInfo: { flex: 1 },
    activeName: { color: t.text.primary, fontSize: t.typography.size.cardTitle, fontWeight: t.typography.weight.bold, letterSpacing: t.typography.tracking.cardTitle },
    activeStatusDesc: { color: t.text.secondary, fontSize: t.typography.size.micro, marginTop: 2 },

    searchSection: { marginTop: t.spacing[32] },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: t.background.surface,
        borderRadius: t.radius.lg,
        paddingHorizontal: t.spacing['2xl'],
        paddingVertical: t.spacing.lg,
        gap: t.spacing.lg,
        ...t.shadows.premium
    },
    searchIcon: { fontSize: 18 },
    searchInput: { flex: 1, color: t.text.primary, fontSize: t.typography.size.body, paddingVertical: 4 },

    gridSection: { marginTop: t.spacing[32] },
    sectionTitle: { color: t.text.primary, fontSize: t.typography.size.cardTitle, fontWeight: t.typography.weight.semibold, marginBottom: t.spacing.lg, letterSpacing: t.typography.tracking.cardTitle },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.lg },
    gridItem: { width: '47%' },
    serviceCard: {
        backgroundColor: t.background.surface,
        borderRadius: t.radius.xl,
        padding: t.spacing['2xl'],
        alignItems: 'center',
        gap: t.spacing.lg,
        ...t.shadows.premium
    },
    iconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: t.background.surfaceRaised, justifyContent: 'center', alignItems: 'center' },
    gridIcon: { fontSize: 28 },
    gridLabel: { color: t.text.primary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.bold, letterSpacing: t.typography.tracking.caption },

    recentSection: { marginTop: t.spacing[32] },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: t.spacing.lg },
    viewAllTxt: { color: t.brand.primary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.bold },
    recentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.lg,
        backgroundColor: t.background.surface,
        padding: t.spacing.lg,
        borderRadius: t.radius.lg,
        marginBottom: t.spacing.lg,
        ...t.shadows.premium
    },
    recentIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: t.background.surfaceRaised, justifyContent: 'center', alignItems: 'center' },
    recentIcon: { fontSize: 20 },
    recentInfo: { flex: 1 },
    recentTitle: { color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.medium, letterSpacing: t.typography.tracking.body },
    recentDate: { color: t.text.secondary, fontSize: t.typography.size.micro, marginTop: 2 }
});
