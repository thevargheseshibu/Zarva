import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, shadows } from '../../../design-system/tokens';
import { fontSize, fontWeight } from '../../../design-system/typography';
import PremiumButton from '../../../components/PremiumButton';
import coverageApi from '../../../services/api/coverageApi';

const RADIUS_OPTIONS = [5, 10, 20, 30, 50];

export default function ServiceAreaSetupScreen({ data, onNext }) {
    const [loading, setLoading] = useState(false);
    const [location, setLocation] = useState(null);
    const [radiusKm, setRadiusKm] = useState(20);

    // Initial load: get current location
    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location is required to set your service area.');
                return;
            }
            try {
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                setLocation({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude
                });
            } catch (err) {
                console.warn('Failed to get location:', err);
            }
        })();
    }, []);

    const handleSelectRadius = (km) => {
        Haptics.selectionAsync();
        setRadiusKm(km);
    };

    const handleSave = async () => {
        if (!location) {
            Alert.alert('Locating...', 'Please wait while we fetch your location.');
            return;
        }

        Alert.alert(
            'Confirm Location Change',
            'Saving this will change your base location and service area.\n\nAre you sure you want to proceed?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Yes',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const result = await coverageApi.updateServiceArea(
                                location.latitude,
                                location.longitude,
                                radiusKm,
                                data.categories || [] // passing the categories from previous step
                            );

                            // Pass the data forward into OnboardingWelcome's state
                            // Let the overarching flow also keep location for unified submit if needed
                            onNext({
                                service_area_geojson: result.service_area,
                                location: {
                                    ...data.location,
                                    lat: location.latitude,
                                    lng: location.longitude,
                                    service_range: radiusKm
                                }
                            });
                        } catch (err) {
                            Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to update service area.');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.headerBox}>
                <Text style={styles.title}>Service Coverage</Text>
                <Text style={styles.subtitle}>
                    Set your base location and how far you're willing to travel for jobs. Customer requests outside this radius will not be sent to you.
                </Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.label}>Your Base Location</Text>
                <View style={styles.locationBox}>
                    <Text style={styles.emoji}>📍</Text>
                    <View style={{ flex: 1 }}>
                        {location ? (
                            <>
                                <Text style={styles.locText}>GPS Acquired</Text>
                                <Text style={styles.locSub}>{location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</Text>
                            </>
                        ) : (
                            <Text style={styles.locWait}>Fetching GPS coordinates...</Text>
                        )}
                    </View>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.label}>Travel Radius</Text>
                <Text style={styles.radiusDesc}>Receive jobs within {radiusKm} km of your base.</Text>

                <View style={styles.radiusGrid}>
                    {RADIUS_OPTIONS.map(km => {
                        const active = radiusKm === km;
                        return (
                            <TouchableOpacity
                                key={km}
                                style={[styles.radiusChip, active && styles.radiusChipActive]}
                                onPress={() => handleSelectRadius(km)}
                            >
                                <Text style={[styles.radiusText, active && styles.radiusTextActive]}>
                                    {km} km
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {radiusKm >= 30 && (
                    <Text style={styles.warningText}>
                        <Text style={{ fontWeight: 'bold' }}>Note:</Text> A large radius implies higher travel time and fuel costs.
                    </Text>
                )}
            </View>

            <PremiumButton
                title="Save & Continue"
                onPress={handleSave}
                loading={loading}
                disabled={!location}
                style={{ marginTop: 24 }}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: spacing[24], paddingBottom: 60, gap: spacing[24] },
    headerBox: { marginBottom: spacing[8] },
    title: { fontSize: fontSize['3xl'], fontWeight: fontWeight.bold, color: colors.text.primary, marginBottom: spacing[8] },
    subtitle: { fontSize: fontSize.base, color: colors.text.secondary, lineHeight: 22 },
    section: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[20], ...shadows.sm, borderWidth: 1, borderColor: colors.border },
    label: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text.primary, marginBottom: spacing[12] },

    locationBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, padding: spacing[16], borderRadius: radius.lg, gap: spacing[12] },
    emoji: { fontSize: 24 },
    locText: { color: colors.success, fontWeight: fontWeight.medium, fontSize: fontSize.base },
    locSub: { color: colors.text.secondary, fontSize: fontSize.sm, marginTop: 4 },
    locWait: { color: colors.warning, fontStyle: 'italic' },

    radiusDesc: { color: colors.accent.primary, fontSize: fontSize.base, fontWeight: fontWeight.medium, marginBottom: spacing[16] },
    radiusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[12] },
    radiusChip: { flex: 1, minWidth: '28%', paddingVertical: spacing[12], alignItems: 'center', backgroundColor: colors.background, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
    radiusChipActive: { backgroundColor: colors.accent.primary + '22', borderColor: colors.accent.primary },
    radiusText: { color: colors.text.primary, fontWeight: fontWeight.medium, fontSize: fontSize.base },
    radiusTextActive: { color: colors.accent.primary, fontWeight: fontWeight.bold },

    warningText: { marginTop: spacing[16], fontSize: fontSize.sm, color: colors.warning, fontStyle: 'italic', lineHeight: 20 }
});
