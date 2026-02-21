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

export default function OnboardingBasicInfo({ data, onNext }) {
    const [name, setName] = useState(data.name || '');
    const [dob, setDob] = useState(data.dob || '');
    const [gender, setGender] = useState(data.gender || '');
    const [workerLocation, setWorkerLocation] = useState({});

    const isValid = name.trim().length >= 2 && dob.length === 10 && gender && workerLocation.isValid;

    const handleDob = (t) => {
        // Auto-format DD/MM/YYYY
        const nums = t.replace(/\D/g, '').slice(0, 8);
        let formatted = nums;
        if (nums.length > 4) formatted = nums.slice(0, 2) + '/' + nums.slice(2, 4) + '/' + nums.slice(4);
        else if (nums.length > 2) formatted = nums.slice(0, 2) + '/' + nums.slice(2);
        setDob(formatted);
    };

    return (
        <ScrollView contentContainerStyle={styles.screen}>
            <Text style={styles.title}>Basic Info</Text>
            <Text style={styles.sub}>Tell us a bit about yourself</Text>

            <View style={styles.fieldGroup}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. Rajan Kumar"
                    placeholderTextColor={colors.text.muted}
                    autoCapitalize="words"
                />
            </View>

            <View style={styles.fieldGroup}>
                <Text style={styles.label}>Date of Birth</Text>
                <TextInput
                    style={styles.input}
                    value={dob}
                    onChangeText={handleDob}
                    placeholder="DD/MM/YYYY"
                    placeholderTextColor={colors.text.muted}
                    keyboardType="number-pad"
                />
            </View>

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
                <Text style={styles.label}>Home / Base Location</Text>
                <LocationInput onChange={setWorkerLocation} />
            </View>

            <GoldButton
                title="Continue"
                disabled={!isValid}
                onPress={() => onNext({ name: name.trim(), dob, gender, location: workerLocation })}
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
