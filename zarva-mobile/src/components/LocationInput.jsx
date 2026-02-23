import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, shadows } from '../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../design-system/typography';
import PressableAnimated from '../design-system/components/PressableAnimated';
import Card from './Card';
import FadeInView from './FadeInView';

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
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

                setFields(prev => ({
                    ...prev,
                    house: place.name && place.name !== place.street ? place.name : prev.house,
                    street: place.street || prev.street,
                    district: place.district || place.subregion || place.city || prev.district,
                    city: place.city || place.subregion || prev.city,
                    state: place.region || prev.state,
                    pincode: place.postalCode || prev.pincode
                }));
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
            <FadeInView delay={100}>
                <PressableAnimated style={styles.gpsBtn} onPress={handleGpsPress} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator size="small" color={colors.accent.primary} />
                    ) : (
                        <View style={styles.gpsBtnContent}>
                            <Text style={styles.gpsIcon}>📍</Text>
                            <Text style={styles.gpsTxt}>Use Current Location</Text>
                        </View>
                    )}
                </PressableAnimated>
                {gpsText ? <Text style={styles.gpsReadout}>{gpsText}</Text> : null}
            </FadeInView>

            <FadeInView delay={200}>
                <Card style={styles.manualWrapper}>
                    <Text style={styles.manualHeader}>ADDRESS DETAILS</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="House / Flat No."
                        placeholderTextColor={colors.text.muted}
                        value={fields.house}
                        onChangeText={(val) => updateField('house', val)}
                        selectionColor={colors.accent.primary}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Street / Area Name *"
                        placeholderTextColor={colors.text.muted}
                        value={fields.street}
                        onChangeText={(val) => updateField('street', val)}
                        selectionColor={colors.accent.primary}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Landmark (Optional)"
                        placeholderTextColor={colors.text.muted}
                        value={fields.landmark}
                        onChangeText={(val) => updateField('landmark', val)}
                        selectionColor={colors.accent.primary}
                    />

                    <View style={styles.row}>
                        <TextInput
                            style={[styles.input, styles.half]}
                            placeholder="District"
                            placeholderTextColor={colors.text.muted}
                            value={fields.district}
                            onChangeText={(val) => updateField('district', val)}
                            selectionColor={colors.accent.primary}
                        />
                        <TextInput
                            style={[styles.input, styles.half]}
                            placeholder="City *"
                            placeholderTextColor={colors.text.muted}
                            value={fields.city}
                            onChangeText={(val) => updateField('city', val)}
                            selectionColor={colors.accent.primary}
                        />
                    </View>

                    <View style={styles.row}>
                        <TextInput
                            style={[styles.input, styles.half]}
                            placeholder="State *"
                            placeholderTextColor={colors.text.muted}
                            value={fields.state}
                            onChangeText={(val) => updateField('state', val)}
                            selectionColor={colors.accent.primary}
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
                                selectionColor={colors.accent.primary}
                            />
                            {isPincodeError && <Text style={styles.errorText}>Invalid pincode</Text>}
                        </View>
                    </View>
                </Card>
            </FadeInView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: spacing[24] },

    gpsBtn: {
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.accent.border,
        paddingVertical: spacing[16],
        paddingHorizontal: spacing[24],
        ...shadows.premium
    },
    gpsBtnContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
    gpsIcon: { fontSize: 18 },
    gpsTxt: {
        color: colors.accent.primary,
        fontSize: fontSize.body,
        fontWeight: fontWeight.bold,
        letterSpacing: tracking.body
    },
    gpsReadout: {
        color: colors.text.muted,
        fontSize: fontSize.micro,
        marginTop: 8,
        textAlign: 'center',
        paddingHorizontal: spacing[16],
        fontStyle: 'italic'
    },

    manualWrapper: {
        padding: spacing[24],
        gap: spacing[16],
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.accent.border + '22'
    },
    manualHeader: {
        color: colors.accent.primary,
        fontSize: fontSize.micro,
        fontWeight: fontWeight.bold,
        letterSpacing: 1.5,
        marginBottom: 4
    },

    input: {
        backgroundColor: colors.elevated,
        borderRadius: radius.lg,
        padding: spacing[16],
        color: colors.text.primary,
        fontSize: fontSize.body,
        borderWidth: 1,
        borderColor: colors.surface,
        letterSpacing: tracking.body
    },
    inputError: {
        borderColor: colors.accent.primary + '88',
        backgroundColor: colors.accent.primary + '11'
    },
    errorText: {
        color: colors.accent.primary,
        fontSize: 10,
        marginTop: 4,
        paddingLeft: 4,
        fontWeight: fontWeight.bold
    },
    row: { flexDirection: 'row', gap: spacing[16] },
    half: { flex: 1 }
});
