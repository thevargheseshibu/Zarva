import React, { useState, useEffect } from 'react';
import { useTokens } from '../../../design-system';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';


import PremiumButton from '@shared/ui/PremiumButton';
import coverageApi from '@infra/api/coverageApi';

const RADIUS_OPTIONS = [5, 10, 20, 30, 50];

export default function ServiceAreaSetupScreen({ data, onNext }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
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

const createStyles = (t) => StyleSheet.create({
    container: { flex: 1 },
    content: { padding: t.spacing['2xl'], paddingBottom: 60, gap: t.spacing['2xl'] },
    headerBox: { marginBottom: t.spacing.sm },
    title: { fontSize: t.typography.size['3xl'] ?? 28, fontWeight: t.typography.weight.bold, color: t.text.primary, marginBottom: t.spacing.sm },
    subtitle: { fontSize: t.typography.size.body, color: t.text.secondary, lineHeight: 22 },
    section: { backgroundColor: t.background.surface, borderRadius: t.radius.xl, padding: t.spacing[20], ...t.shadows.sm, borderWidth: 1, borderColor: t.border.default },
    label: { fontSize: t.typography.size.cardTitle, fontWeight: t.typography.weight.semibold, color: t.text.primary, marginBottom: t.spacing.md },

    locationBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.background.app, padding: t.spacing.lg, borderRadius: t.radius.lg, gap: t.spacing.md },
    emoji: { fontSize: 24 },
    locText: { color: t.status.success.base, fontWeight: t.typography.weight.medium, fontSize: t.typography.size.body },
    locSub: { color: t.text.secondary, fontSize: t.typography.size.micro, marginTop: 4 },
    locWait: { color: t.status.warning.base, fontStyle: 'italic' },

    radiusDesc: { color: t.brand.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.medium, marginBottom: t.spacing.lg },
    radiusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md },
    radiusChip: { flex: 1, minWidth: '28%', paddingVertical: t.spacing.md, alignItems: 'center', backgroundColor: t.background.app, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.border.default },
    radiusChipActive: { backgroundColor: t.brand.primary + '22', borderColor: t.brand.primary },
    radiusText: { color: t.text.primary, fontWeight: t.typography.weight.medium, fontSize: t.typography.size.body },
    radiusTextActive: { color: t.brand.primary, fontWeight: t.typography.weight.bold },

    warningText: { marginTop: t.spacing.lg, fontSize: t.typography.size.micro, color: t.status.warning.base, fontStyle: 'italic', lineHeight: 20 }
});
