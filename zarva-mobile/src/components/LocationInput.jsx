import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as Location from 'expo-location';
import { colors, spacing, radius } from '../design-system/tokens';

export default function LocationInput({ onChange, initialData = {} }) {
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
            const isValid = !!(fields.street && fields.city && fields.state && isValidPincode);

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
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission denied', 'Please allow location access in your phone settings.');
                return;
            }
            setLoading(true);
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
                const generatedGpsText = [place.name, place.street, place.district, place.city, place.region]
                    .filter(Boolean).join(', ');
                setGpsText(generatedGpsText);

                // Auto-fill manual fields where possible
                setFields(prev => ({
                    ...prev,
                    house: place.subregion || place.name || prev.house,
                    street: place.street || prev.street,
                    district: place.district || place.subregion || prev.district,
                    city: place.city || prev.city,
                    state: place.region || prev.state,
                    pincode: place.postalCode || prev.pincode
                }));
            }
        } catch (err) {
            Alert.alert('Could not get location', 'Please type your address manually.');
        } finally {
            setLoading(false);
        }
    };

    const isPincodeError = fields.pincode.length > 0 && !/^\d{6}$/.test(fields.pincode);

    return (
        <View style={styles.container}>
            {/* GPS Row Option */}
            <View style={styles.gpsRow}>
                <TouchableOpacity style={styles.gpsBtn} onPress={handleGpsPress} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator size="small" color={colors.gold.primary} />
                    ) : (
                        <Text style={styles.gpsTxt}>📍 Use my location</Text>
                    )}
                </TouchableOpacity>
                {gpsText ? <Text style={styles.gpsReadout}>{gpsText}</Text> : null}
            </View>

            {/* Manual Fields Wrapper */}
            <View style={styles.manualWrapper}>
                <Text style={styles.manualHeader}>Manual Address Details</Text>

                <TextInput
                    style={styles.input}
                    placeholder="House / Flat No."
                    placeholderTextColor={colors.text.muted}
                    value={fields.house}
                    onChangeText={(val) => updateField('house', val)}
                />
                <TextInput
                    style={styles.input}
                    placeholder="Street / Area Name *"
                    placeholderTextColor={colors.text.muted}
                    value={fields.street}
                    onChangeText={(val) => updateField('street', val)}
                />
                <TextInput
                    style={styles.input}
                    placeholder="Landmark (Optional)"
                    placeholderTextColor={colors.text.muted}
                    value={fields.landmark}
                    onChangeText={(val) => updateField('landmark', val)}
                />

                <View style={styles.row}>
                    <TextInput
                        style={[styles.input, styles.half]}
                        placeholder="District"
                        placeholderTextColor={colors.text.muted}
                        value={fields.district}
                        onChangeText={(val) => updateField('district', val)}
                    />
                    <TextInput
                        style={[styles.input, styles.half]}
                        placeholder="City *"
                        placeholderTextColor={colors.text.muted}
                        value={fields.city}
                        onChangeText={(val) => updateField('city', val)}
                    />
                </View>

                <View style={styles.row}>
                    <TextInput
                        style={[styles.input, styles.half]}
                        placeholder="State *"
                        placeholderTextColor={colors.text.muted}
                        value={fields.state}
                        onChangeText={(val) => updateField('state', val)}
                    />
                    <View style={styles.half}>
                        <TextInput
                            style={[styles.input, isPincodeError && styles.inputError]}
                            placeholder="Pincode *"
                            placeholderTextColor={colors.text.muted}
                            keyboardType="numeric"
                            maxLength={6}
                            value={fields.pincode}
                            onChangeText={(val) => updateField('pincode', val.replace(/[^0-9]/g, ''))}
                        />
                        {isPincodeError && <Text style={styles.errorText}>Exactly 6 digits required</Text>}
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: spacing.lg },
    gpsRow: { gap: spacing.xs },
    gpsBtn: {
        flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
        borderWidth: 1, borderColor: colors.gold.primary, borderRadius: radius.md,
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.gold.glow
    },
    gpsTxt: { color: colors.gold.primary, fontWeight: '700', fontSize: 14 },
    gpsReadout: { color: colors.text.muted, fontSize: 13, marginTop: 4, paddingHorizontal: 4 },

    manualWrapper: { gap: spacing.md, backgroundColor: colors.bg.surface, padding: spacing.md, borderRadius: radius.lg },
    manualHeader: { color: colors.text.secondary, fontSize: 14, fontWeight: '600', marginBottom: spacing.xs },

    input: {
        backgroundColor: colors.bg.primary,
        borderWidth: 1, borderColor: colors.bg.primary, // #1A1A26
        borderRadius: radius.md,
        padding: 14,
        color: colors.text.primary,
        fontSize: 15
    },
    inputError: {
        borderColor: colors.danger,
        backgroundColor: colors.danger + '11'
    },
    errorText: {
        color: colors.danger, fontSize: 12, marginTop: 4, paddingLeft: 4
    },
    row: { flexDirection: 'row', gap: spacing.md },
    half: { flex: 1 }
});
