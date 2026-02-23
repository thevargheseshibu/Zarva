/**
 * src/screens/worker/onboarding/OnboardingBasicInfo.jsx
 * Step 1: Name, DOB picker, gender radio buttons.
 */
import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { colors, spacing, radius } from '../../../design-system/tokens';
import GoldButton from '../../../components/GoldButton';
import LocationInput from '../../../components/LocationInput';

const GENDERS = ['Male', 'Female', 'Other'];
const RANGES = [10, 20, 50];

export default function OnboardingBasicInfo({ data, onNext }) {
    const [gender, setGender] = useState(data.gender || '');
    const [experience, setExperience] = useState(data.experience_years ? String(data.experience_years) : '');
    const [workerLocation, setWorkerLocation] = useState({});
    const [serviceRange, setServiceRange] = useState(data.service_range || 20);

    const isValid = gender && workerLocation.isValid && experience.trim().length > 0;

    return (
        <ScrollView contentContainerStyle={styles.screen}>
            <Text style={styles.title}>Basic Info</Text>
            <Text style={styles.sub}>Tell us a bit about your professional side.</Text>

            <View style={styles.fieldGroup}>
                <Text style={styles.label}>Gender</Text>
                <View style={styles.radioRow}>
                    {GENDERS.map(g => (
                        <TouchableOpacity
                            key={g}
                            style={[styles.radioChip, gender === g && styles.radioChipActive]}
                            onPress={() => setGender(g)}
                        >
                            <Text style={[styles.radioText, gender === g && styles.radioTextActive]}>{g}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.fieldGroup}>
                <Text style={styles.label}>Years of Experience</Text>
                <TextInput
                    style={styles.input}
                    value={experience}
                    onChangeText={t => setExperience(t.replace(/[^0-9]/g, ''))}
                    placeholder="e.g. 5"
                    placeholderTextColor={colors.text.muted}
                    keyboardType="number-pad"
                    maxLength={2}
                />
            </View>

            <View style={styles.fieldGroup}>
                <Text style={styles.label}>Service Range (Radius)</Text>
                <View style={styles.radioRow}>
                    {RANGES.map(r => (
                        <TouchableOpacity
                            key={r}
                            style={[styles.radioChip, serviceRange === r && styles.radioChipActive]}
                            onPress={() => setServiceRange(r)}
                        >
                            <Text style={[styles.radioText, serviceRange === r && styles.radioTextActive]}>{r} km</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.fieldGroup}>
                <Text style={styles.label}>Home / Base Location</Text>
                <LocationInput onChange={setWorkerLocation} />
            </View>

            <GoldButton
                title="Continue"
                disabled={!isValid}
                onPress={() => onNext({ gender, location: workerLocation, experience_years: parseInt(experience, 10) || 0, service_range: serviceRange })}
                style={{ marginTop: spacing.xl }}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    screen: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
    title: { color: colors.text.primary, fontSize: 24, fontWeight: '700' },
    sub: { color: colors.text.secondary, fontSize: 14 },
    fieldGroup: { gap: spacing.xs },
    label: { color: colors.text.secondary, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
    input: {
        backgroundColor: colors.bg.elevated, borderRadius: radius.md,
        paddingHorizontal: spacing.md, paddingVertical: 14,
        color: colors.text.primary, fontSize: 16, borderWidth: 1, borderColor: colors.bg.surface,
    },
    radioRow: { flexDirection: 'row', gap: spacing.sm },
    radioChip: {
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        backgroundColor: colors.bg.elevated, borderRadius: radius.full,
        borderWidth: 1, borderColor: colors.bg.surface,
    },
    radioChipActive: { borderColor: colors.gold.primary, backgroundColor: colors.gold.glow },
    radioText: { color: colors.text.secondary, fontWeight: '500' },
    radioTextActive: { color: colors.gold.primary },
});
