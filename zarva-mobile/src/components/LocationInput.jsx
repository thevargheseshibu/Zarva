import React, { useState, useEffect } from 'react';
import { useTokens } from '../design-system';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';

import PressableAnimated from '../design-system/components/PressableAnimated';
import Card from './Card';
import FadeInView from './FadeInView';
import ZLoader from './ZLoader';

export default function LocationInput({ onChange, onLoading, initialData = {} }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const [loading, setLoading] = useState(false);
    const [gpsText, setGpsText] = useState('');

    const [coords, setCoords] = useState({ lat: initialData.lat || null, lng: initialData.lng || null });
    const [fields, setFields] = useState({
        house: initialData.house || '',
        street: initialData.street || '',
        landmark: initialData.landmark || '',
        district: initialData.district || '',
        city: initialData.city || '',
        state: initialData.state || '',
        pincode: initialData.pincode || '',
    });

    const updateField = (key, value) => {
        setFields(prev => ({ ...prev, [key]: value }));
    };

    useEffect(() => {
        const emitChange = () => {
            const isValidPincode = /^\d{6}$/.test(fields.pincode);
            const isValid = !!(fields.house && fields.street && fields.city && fields.state && isValidPincode);

            const fullAddress = [
                fields.house, fields.street, fields.landmark,
                fields.district, fields.city, fields.state, fields.pincode
            ].filter(Boolean).join(', ');

            onChange({
                ...coords,
                ...fields,
                full_address: fullAddress,
                isValid
            });
        };
        emitChange();
    }, [fields, coords]); // eslint-disable-line

    const handleGpsPress = async () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission denied', 'Please allow location access in your phone settings.');
                return;
            }
            setLoading(true);
            if (onLoading) onLoading(true);
            const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });

            setCoords({
                lat: position.coords.latitude,
                lng: position.coords.longitude
            });

            const [place] = await Location.reverseGeocodeAsync({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
            });

            if (place) {
                // expo-location has varying accuracy by region.
                // subregion usually matches District in India. city matches City/Town.
                const cityVal = place.city || place.subregion || place.region || '';
                const districtVal = place.subregion || place.district || place.city || '';

                const generatedGpsText = [place.name, place.street, districtVal, cityVal, place.region]
                    .filter(Boolean)
                    .filter((v, i, a) => a.indexOf(v) === i) // Remove duplicates (e.g if city == district)
                    .join(', ');
                setGpsText(generatedGpsText);

                setFields(prev => ({
                    ...prev,
                    house: place.name && place.name !== place.street ? place.name : prev.house,
                    street: place.street || prev.street,
                    district: districtVal || prev.district,
                    city: cityVal || prev.city,
                    state: place.region || prev.state,
                    pincode: place.postalCode || prev.pincode
                }));
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        } catch (err) {
            Alert.alert('Could not get location', 'Please type your address manually.');
        } finally {
            setLoading(false);
            if (onLoading) onLoading(false);
        }
    };

    const isPincodeError = fields.pincode.length > 0 && !/^\d{6}$/.test(fields.pincode);

    return (
        <View style={styles.container}>
            <ZLoader visible={loading} text="Fetching Location..." />
            <FadeInView delay={100}>
                <PressableAnimated style={styles.gpsBtn} onPress={handleGpsPress} disabled={loading}>
                    <View style={styles.gpsBtnContent}>
                        <Text style={styles.gpsIcon}>📍</Text>
                        <Text style={styles.gpsTxt}>Use Current Location</Text>
                    </View>
                </PressableAnimated>
                {gpsText ? <Text style={styles.gpsReadout}>{gpsText}</Text> : null}
            </FadeInView>

            <FadeInView delay={200}>
                <Card style={styles.manualWrapper}>
                    <Text style={styles.manualHeader}>ADDRESS DETAILS</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="House / Flat No. *"
                        placeholderTextColor={tTheme.text.tertiary}
                        value={fields.house}
                        onChangeText={(val) => updateField('house', val)}
                        selectionColor={tTheme.brand.primary}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Street / Area Name *"
                        placeholderTextColor={tTheme.text.tertiary}
                        value={fields.street}
                        onChangeText={(val) => updateField('street', val)}
                        selectionColor={tTheme.brand.primary}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Landmark (Optional)"
                        placeholderTextColor={tTheme.text.tertiary}
                        value={fields.landmark}
                        onChangeText={(val) => updateField('landmark', val)}
                        selectionColor={tTheme.brand.primary}
                    />

                    <View style={styles.row}>
                        <TextInput
                            style={[styles.input, styles.half]}
                            placeholder="District"
                            placeholderTextColor={tTheme.text.tertiary}
                            value={fields.district}
                            onChangeText={(val) => updateField('district', val)}
                            selectionColor={tTheme.brand.primary}
                        />
                        <TextInput
                            style={[styles.input, styles.half]}
                            placeholder="City *"
                            placeholderTextColor={tTheme.text.tertiary}
                            value={fields.city}
                            onChangeText={(val) => updateField('city', val)}
                            selectionColor={tTheme.brand.primary}
                        />
                    </View>

                    <View style={styles.row}>
                        <TextInput
                            style={[styles.input, styles.half]}
                            placeholder="State *"
                            placeholderTextColor={tTheme.text.tertiary}
                            value={fields.state}
                            onChangeText={(val) => updateField('state', val)}
                            selectionColor={tTheme.brand.primary}
                        />
                        <View style={styles.half}>
                            <TextInput
                                style={[styles.input, isPincodeError && styles.inputError]}
                                placeholder="Pincode *"
                                placeholderTextColor={tTheme.text.tertiary}
                                keyboardType="numeric"
                                maxLength={6}
                                value={fields.pincode}
                                onChangeText={(val) => updateField('pincode', val.replace(/[^0-9]/g, ''))}
                                selectionColor={tTheme.brand.primary}
                            />
                            {isPincodeError && <Text style={styles.errorText}>Invalid pincode</Text>}
                        </View>
                    </View>
                </Card>
            </FadeInView>
        </View>
    );
}

const createStyles = (t) => StyleSheet.create({
    container: { gap: t.spacing['2xl'] },
    gpsBtn: {
        backgroundColor: t.background.surface,
        borderRadius: t.radius.xl,
        borderWidth: 1,
        borderColor: t.border.default,
        paddingVertical: t.spacing.lg,
        paddingHorizontal: t.spacing['2xl']
    },
    gpsBtnContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
    gpsIcon: { fontSize: 18 },
    gpsTxt: { color: t.brand.primary, fontSize: 16, fontWeight: '700' },
    gpsReadout: { color: t.text.tertiary, fontSize: 10, marginTop: 8, textAlign: 'center', paddingHorizontal: 16, fontStyle: 'italic' },
    manualWrapper: { padding: t.spacing['2xl'], gap: t.spacing.lg, backgroundColor: t.background.surface, borderWidth: 1, borderColor: t.border.default + '22' },
    manualHeader: { color: t.brand.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
    input: {
        backgroundColor: t.background.surfaceRaised,
        borderRadius: t.radius.lg,
        padding: t.spacing.lg,
        color: t.text.primary,
        fontSize: 16,
        borderWidth: 1,
        borderColor: t.background.surface
    },
    inputError: { borderColor: t.brand.primary + '88', backgroundColor: t.brand.primary + '11' },
    errorText: { color: t.brand.primary, fontSize: 10, marginTop: 4, paddingLeft: 4 },
    row: { flexDirection: 'row', gap: t.spacing.lg },
    half: { flex: 1 }
});
