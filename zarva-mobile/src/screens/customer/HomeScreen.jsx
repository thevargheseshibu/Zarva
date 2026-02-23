import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
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
import { colors, radius, spacing, shadows } from '../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../design-system/typography';
import { durations } from '../../design-system/motion';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import SkeletonCard from '../../design-system/components/SkeletonCard';
import StatusPill from '../../components/StatusPill';
import RadarAnimation from '../../components/RadarAnimation';
import Card from '../../components/Card';
import MapPickerModal from '../../components/MapPickerModal';

export default function HomeScreen({ navigation }) {
    const t = useT();
    const [recentJobs, setRecentJobs] = useState([]);
    const [services, setServices] = useState([]);
    const [isLoadingServices, setIsLoadingServices] = useState(true);
    const [showAllServices, setShowAllServices] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const { activeJob, searchPhase, locationOverride, setLocationOverride, setLastKnownLocation } = useJobStore();
    const [location, setLocation] = useState(locationOverride || { address: 'Fetching location...', lat: null, lng: null });
    const [isMapVisible, setIsMapVisible] = useState(false);

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
            backgroundColor: colors.background + 'EE',
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
            if (locationOverride) { setLocation(locationOverride); return; }
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            try {
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                const [addressArr] = await Location.reverseGeocodeAsync({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude
                });
                let addressText = addressArr ? [addressArr.name, addressArr.city || addressArr.subregion].filter(Boolean).join(', ') : 'Unknown';
                const newLoc = { address: addressText, lat: loc.coords.latitude, lng: loc.coords.longitude };
                setLocation(newLoc);
                setLastKnownLocation(newLoc);
            } catch (error) { }
        })();
    }, [locationOverride]);

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

                <FadeInView delay={100}>
                    <Text style={styles.greeting}>{t('customer_home_greeting')}</Text>
                    <Text style={styles.subGreeting}>A selection of premium services at your doorstep.</Text>
                </FadeInView>

                {activeJob && searchPhase && (
                    <FadeInView delay={200}>
                        <Card glow style={styles.activeJobCard}>
                            <View style={styles.activeHeader}>
                                <Text style={styles.activeLabel}>ACTIVE REQUEST</Text>
                                <StatusPill status={searchPhase} />
                            </View>
                            <View style={styles.activeBody}>
                                <View style={styles.serviceIconWrap}>
                                    <RadarAnimation size={40} />
                                </View>
                                <View style={styles.activeInfo}>
                                    <Text style={styles.activeName}>{t(`cat_${activeJob.category}`) || activeJob.category}</Text>
                                    <Text style={styles.activeStatusDesc}>
                                        {searchPhase === 'searching' ? 'Finding the best worker...' : 'Service in progress'}
                                    </Text>
                                </View>
                            </View>
                            <PremiumButton
                                title="Track Status"
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
                            placeholder="What do you need help with?"
                            placeholderTextColor={colors.text.secondary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                </FadeInView>

                <View style={styles.gridSection}>
                    <Text style={styles.sectionTitle}>Categories</Text>
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
                </View>

                {recentJobs.length > 0 && (
                    <View style={styles.recentSection}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Recent Activity</Text>
                            <PressableAnimated onPress={() => navigation.navigate('MyJobs')}>
                                <Text style={styles.viewAllTxt}>View All</Text>
                            </PressableAnimated>
                        </View>
                        {recentJobs.map((job, i) => (
                            <FadeInView key={job.id} delay={200 + (i * 60)}>
                                <PressableAnimated
                                    onPress={() => navigation.navigate('JobStatusDetail', { jobId: job.id })}
                                    style={styles.recentRow}
                                >
                                    <View style={styles.recentIconBox}>
                                        <Text style={styles.recentIcon}>
                                            {services.find(s => s.id === job.category)?.icon || '🛠️'}
                                        </Text>
                                    </View>
                                    <View style={styles.recentInfo}>
                                        <Text style={styles.recentTitle}>{t(`cat_${job.category}`) || job.category}</Text>
                                        <Text style={styles.recentDate}>{new Date(job.created_at).toLocaleDateString()}</Text>
                                    </View>
                                    <StatusPill status={job.status} />
                                </PressableAnimated>
                            </FadeInView>
                        ))}
                    </View>
                )}

                <MapPickerModal
                    visible={isMapVisible}
                    onClose={() => setIsMapVisible(false)}
                    onSelectLocation={(loc) => {
                        const newLoc = { address: loc.address, lat: loc.latitude, lng: loc.longitude };
                        setLocation(newLoc);
                        setLocationOverride(newLoc);
                        setIsMapVisible(false);
                    }}
                />
            </Animated.ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    scrollView: { flex: 1 },
    content: { padding: spacing[24], paddingTop: 100, paddingBottom: 100 },

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
        color: colors.text.primary,
        fontSize: fontSize.body,
        fontWeight: fontWeight.bold,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },

    topBar: { marginBottom: spacing[32] },
    locationPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        alignSelf: 'flex-start',
        paddingHorizontal: spacing[16],
        paddingVertical: spacing[12],
        borderRadius: radius.full,
        gap: spacing[8],
        ...shadows.premium
    },
    locationTxt: { color: colors.text.primary, fontSize: fontSize.caption, fontWeight: fontWeight.medium, maxWidth: 200 },
    locationChevron: { color: colors.accent.primary, fontSize: 16 },

    greeting: { color: colors.text.primary, fontSize: fontSize.hero, fontWeight: fontWeight.semibold, letterSpacing: tracking.hero },
    subGreeting: { color: colors.text.secondary, fontSize: fontSize.body, marginTop: 4, letterSpacing: tracking.body },

    activeJobCard: { marginTop: spacing[32], padding: spacing[24], gap: spacing[16] },
    activeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    activeLabel: { color: colors.accent.primary, fontSize: fontSize.micro, fontWeight: fontWeight.bold, letterSpacing: 1.5 },
    activeBody: { flexDirection: 'row', alignItems: 'center', gap: spacing[16], marginVertical: spacing[8] },
    serviceIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.elevated, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    activeInfo: { flex: 1 },
    activeName: { color: colors.text.primary, fontSize: fontSize.cardTitle, fontWeight: fontWeight.bold, letterSpacing: tracking.cardTitle },
    activeStatusDesc: { color: colors.text.secondary, fontSize: fontSize.micro, marginTop: 2 },

    searchSection: { marginTop: spacing[32] },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        paddingHorizontal: spacing[24],
        paddingVertical: spacing[16],
        gap: spacing[16],
        ...shadows.premium
    },
    searchIcon: { fontSize: 18 },
    searchInput: { flex: 1, color: colors.text.primary, fontSize: fontSize.body, paddingVertical: 4 },

    gridSection: { marginTop: spacing[32] },
    sectionTitle: { color: colors.text.primary, fontSize: fontSize.cardTitle, fontWeight: fontWeight.semibold, marginBottom: spacing[16], letterSpacing: tracking.cardTitle },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[16] },
    gridItem: { width: '47%' },
    serviceCard: {
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        padding: spacing[24],
        alignItems: 'center',
        gap: spacing[16],
        ...shadows.premium
    },
    iconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.elevated, justifyContent: 'center', alignItems: 'center' },
    gridIcon: { fontSize: 28 },
    gridLabel: { color: colors.text.primary, fontSize: fontSize.caption, fontWeight: fontWeight.bold, letterSpacing: tracking.caption },

    recentSection: { marginTop: spacing[32] },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[16] },
    viewAllTxt: { color: colors.accent.primary, fontSize: fontSize.caption, fontWeight: fontWeight.bold },
    recentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[16],
        backgroundColor: colors.surface,
        padding: spacing[16],
        borderRadius: radius.lg,
        marginBottom: spacing[16],
        ...shadows.premium
    },
    recentIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.elevated, justifyContent: 'center', alignItems: 'center' },
    recentIcon: { fontSize: 20 },
    recentInfo: { flex: 1 },
    recentTitle: { color: colors.text.primary, fontSize: fontSize.body, fontWeight: fontWeight.medium, letterSpacing: tracking.body },
    recentDate: { color: colors.text.secondary, fontSize: fontSize.micro, marginTop: 2 }
});
