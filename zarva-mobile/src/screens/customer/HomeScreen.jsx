import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { colors, spacing, radius } from '../../design-system/tokens';
import Card from '../../components/Card';
import StatusPill from '../../components/StatusPill';
import RadarAnimation from '../../components/RadarAnimation';
import GoldButton from '../../components/GoldButton';
import { useT } from '../../hooks/useT';
import { useJobStore } from '../../stores/jobStore';
import apiClient from '../../services/api/client';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import MapPickerModal from '../../components/MapPickerModal';

export default function HomeScreen({ navigation }) {
    const t = useT();
    const [recentJobs, setRecentJobs] = useState([]);

    const [services, setServices] = useState([]);
    const [showAllServices, setShowAllServices] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const { activeJob, searchPhase, clearActiveJob, locationOverride, setLocationOverride, setLastKnownLocation } = useJobStore();

    const [location, setLocation] = useState(locationOverride || { address: 'Fetching location...', lat: null, lng: null });
    const [isMapVisible, setIsMapVisible] = useState(false);

    const isSearching = searchQuery.trim() !== '';
    const displayedServices = isSearching
        ? services.filter(s => s.label.toLowerCase().includes(searchQuery.toLowerCase()))
        : (showAllServices ? services : services.slice(0, 3));

    React.useEffect(() => {
        apiClient.get('/api/jobs/config')
            .then(res => {
                if (res.data?.categories) {
                    setServices(Object.values(res.data.categories));
                }
            })
            .catch(err => console.error('Failed to fetch jobs configuration', err));
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchHomescreenData();
        }, []) // Remove location dependencies to avoid excessive loops if just refreshing
    );

    const fetchHomescreenData = async () => {
        try {
            const res = await apiClient.get('/api/jobs');
            const jobs = res.data?.jobs || [];

            setRecentJobs(jobs.slice(0, 3)); // show last 3 history
        } catch (err) {
            console.error('Failed to fetch home screen stats', err);
        }
    };

    useEffect(() => {
        (async () => {
            // If we already have an override, don't auto-fetch GPS
            if (locationOverride) {
                setLocation(locationOverride);
                return;
            }

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setLocation({ address: 'Permission Denied', lat: null, lng: null });
                return;
            }
            try {
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                const [addressArr] = await Location.reverseGeocodeAsync({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude
                });

                let addressText = 'Unknown Location';
                if (addressArr) {
                    addressText = [addressArr.name, addressArr.city || addressArr.subregion].filter(Boolean).join(', ');
                }

                const newLoc = {
                    address: addressText,
                    lat: loc.coords.latitude,
                    lng: loc.coords.longitude
                };
                setLocation(newLoc);
                setLastKnownLocation(newLoc);
            } catch (error) {
                console.warn('Location fetch failed', error);
                setLocation({ address: 'Location Unavailable', lat: null, lng: null });
            }
        })();
    }, [locationOverride]); // Re-run if override is cleared or changed elsewhere

    React.useEffect(() => {
        if (['completed', 'cancelled', 'no_worker_found'].includes(searchPhase)) {
            const timer = setTimeout(() => { clearActiveJob(); }, 10000);
            return () => clearTimeout(timer);
        }
    }, [searchPhase, clearActiveJob]);

    const handleTryAgain = () => {
        clearActiveJob();
        // Depending on navigation architecture, returning to LocationSchedule or DynamicQuestions
        navigation.navigate('DynamicQuestions', { category: activeJob?.category || 'electrician' });
    };

    return (
        <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
            {/* Header Row */}
            <View style={styles.headerRow}>
                <TouchableOpacity style={styles.locationPill} onPress={() => setIsMapVisible(true)}>
                    <Text style={styles.locationIcon}>📍</Text>
                    <Text style={styles.locationText} numberOfLines={1}>{location.address}</Text>
                    <Text style={styles.locationArrow}>⌄</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.heading}>{t('customer_home_greeting')}</Text>

            {/* Persistent Minimizable Job Widget */}
            {activeJob && searchPhase && (
                <Card glow={searchPhase === 'searching' || searchPhase === 'in_progress'}
                    style={[styles.activeBanner, searchPhase === 'no_worker_found' && styles.errorBanner]}>
                    <View style={styles.activeBannerHeader}>
                        <Text style={[styles.activeTitle, searchPhase === 'no_worker_found' && { color: colors.danger }]}>
                            {searchPhase === 'no_worker_found' ? 'Search Failed' : t('active_job')}
                        </Text>
                        <StatusPill status={searchPhase} />
                    </View>
                    <View style={styles.midRow}>
                        {searchPhase === 'searching' && (
                            <View style={{ width: 40, height: 40, overflow: 'hidden' }}>
                                <RadarAnimation size={40} />
                            </View>
                        )}
                        <Text style={styles.activeService}>{t(`cat_${activeJob.category}`) || activeJob.category}</Text>
                    </View>

                    {searchPhase === 'no_worker_found' ? (
                        <TouchableOpacity style={styles.trackBtn} onPress={handleTryAgain}>
                            <Text style={[styles.trackBtnText, { color: colors.danger }]}>Try Again ↻</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={styles.trackBtn}
                            onPress={() => searchPhase === 'searching' ? navigation.navigate('Searching', { category: activeJob.category, jobId: activeJob.id }) : navigation.navigate('JobStatusDetail', { jobId: activeJob.id })}
                        >
                            <Text style={styles.trackBtnText}>
                                {searchPhase === 'searching' ? 'View Search →' : 'Track Status →'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </Card>
            )}

            {/* Service Grid */}
            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search for a service..."
                    placeholderTextColor={colors.text.muted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            <View style={styles.grid}>
                {services.length > 0 ? (
                    <>
                        {displayedServices.map((s) => (
                            <TouchableOpacity
                                key={s.id}
                                style={styles.serviceCard}
                                activeOpacity={0.8}
                                onPress={() => navigation.navigate('DynamicQuestions', { category: s.id, label: s.label })}
                            >
                                <Text style={styles.serviceIcon}>{s.icon || '🛠️'}</Text>
                                <Text style={styles.serviceLabel}>{s.label}</Text>
                            </TouchableOpacity>
                        ))}
                        {services.length > 3 && !showAllServices && !isSearching && (
                            <TouchableOpacity
                                style={styles.serviceCard}
                                activeOpacity={0.8}
                                onPress={() => setShowAllServices(true)}
                            >
                                <Text style={styles.serviceIcon}>➕</Text>
                                <Text style={styles.serviceLabel}>View All</Text>
                            </TouchableOpacity>
                        )}
                        {showAllServices && !isSearching && (
                            <TouchableOpacity
                                style={styles.serviceCard}
                                activeOpacity={0.8}
                                onPress={() => setShowAllServices(false)}
                            >
                                <Text style={styles.serviceIcon}>➖</Text>
                                <Text style={styles.serviceLabel}>Show Less</Text>
                            </TouchableOpacity>
                        )}
                    </>
                ) : (
                    <View style={{ padding: spacing.xl, alignItems: 'center', width: '100%' }}>
                        <Text style={{ color: colors.gold.muted }}>Loading services...</Text>
                    </View>
                )}
                {isSearching && displayedServices.length === 0 && (
                    <View style={{ padding: spacing.lg, alignItems: 'center', width: '100%' }}>
                        <Text style={{ color: colors.text.muted }}>No services found for "{searchQuery}"</Text>
                    </View>
                )}
            </View>

            {/* Recent Posts Section */}
            <View style={styles.recentSection}>
                <View style={styles.recentHeader}>
                    <Text style={styles.recentTitle}>{t('recent_posts')}</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('MyJobs')}>
                        <Text style={styles.viewAll}>View All</Text>
                    </TouchableOpacity>
                </View>

                {/* Dynamic Recent Jobs */}
                {recentJobs.length > 0 ? (
                    recentJobs.map(job => (
                        <TouchableOpacity
                            key={job.id}
                            activeOpacity={0.8}
                            onPress={() => navigation.navigate('JobStatusDetail', { jobId: job.id })}
                        >
                            <Card style={styles.recentCard}>
                                <View style={styles.recentCardTop}>
                                    <View style={styles.recentIconBox}>
                                        <Text style={{ fontSize: 20 }}>
                                            {services.find(s => s.id === job.category)?.icon || '🛠️'}
                                        </Text>
                                    </View>
                                    <View style={styles.recentInfo}>
                                        <Text style={styles.recentCat}>
                                            {t(`cat_${job.category}`) || job.category} • {job.id.toString().substring(0, 6).toUpperCase()}
                                        </Text>
                                        <Text style={styles.recentDate}>
                                            {new Date(job.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                    </View>
                                    <StatusPill status={job.status} />
                                </View>
                            </Card>
                        </TouchableOpacity>
                    ))
                ) : (
                    <Text style={styles.emptyNote}>No recent jobs yet.</Text>
                )}
            </View>

            <MapPickerModal
                visible={isMapVisible}
                onClose={() => setIsMapVisible(false)}
                initialLocation={location.lat ? { latitude: location.lat, longitude: location.lng } : null}
                onSelectLocation={(loc) => {
                    const newLoc = {
                        address: loc.address,
                        lat: loc.latitude,
                        lng: loc.longitude
                    };
                    setLocation(newLoc);
                    setLocationOverride(newLoc);
                    setIsMapVisible(false);
                }}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary },
    content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xl * 2 },

    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
    locationPill: {
        flex: 1, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
        backgroundColor: colors.bg.surface, paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm, borderRadius: radius.full, gap: 6,
        marginRight: spacing.md
    },
    locationIcon: { fontSize: 16 },
    locationText: { color: colors.text.primary, fontSize: 14, fontWeight: '600', maxWidth: 150 },
    locationArrow: { color: colors.text.muted, fontSize: 16, marginTop: -4 },

    heading: { color: colors.text.primary, fontSize: 24, fontWeight: '700', fontFamily: 'Sohne' },

    activeBanner: { gap: spacing.sm, borderColor: colors.gold.primary, borderWidth: 1 },
    errorBanner: { borderColor: colors.danger },
    activeBannerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    activeTitle: { color: colors.text.secondary, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
    midRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    activeService: { color: colors.text.primary, fontSize: 18, fontWeight: '600' },
    trackBtn: { alignSelf: 'flex-start', marginTop: spacing.xs },
    trackBtnText: { color: colors.gold.primary, fontWeight: '600' },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'space-between' },
    serviceCard: {
        width: '47.5%', backgroundColor: colors.bg.elevated, borderRadius: radius.lg,
        padding: spacing.lg, alignItems: 'center', gap: spacing.sm,
        borderWidth: 1, borderColor: colors.bg.surface,
    },
    serviceIcon: { fontSize: 32 },
    serviceLabel: { color: colors.text.primary, fontSize: 15, fontWeight: '500' },

    recentSection: { gap: spacing.md },
    recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    recentTitle: { color: colors.text.primary, fontSize: 18, fontWeight: '700' },
    viewAll: { color: colors.gold.primary, fontSize: 14, fontWeight: '600' },
    emptyNote: { color: colors.text.muted, fontSize: 14, textAlign: 'center', marginTop: spacing.lg, fontStyle: 'italic' },

    recentCard: { padding: spacing.md },
    recentCardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    recentIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bg.surface, justifyContent: 'center', alignItems: 'center' },
    recentInfo: { flex: 1, gap: 2 },
    recentCat: { color: colors.text.primary, fontSize: 14, fontWeight: '600' },
    recentDate: { color: colors.text.muted, fontSize: 12 },

    searchContainer: { marginBottom: spacing.sm },
    searchInput: {
        backgroundColor: colors.bg.surface,
        borderRadius: radius.full,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        color: colors.text.primary,
        fontSize: 15,
        borderWidth: 1,
        borderColor: colors.bg.surface,
    }
});
