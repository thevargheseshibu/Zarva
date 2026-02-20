/**
 * src/screens/worker/onboarding/OnboardingSkills.jsx
 * Step 2: Category chip multi-select + experience slider.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, radius } from '../../../design-system/tokens';
import GoldButton from '../../../components/GoldButton';

const CATEGORIES = [
    { id: 'electrician', label: '⚡ Electrician' },
    { id: 'plumber', label: '🔧 Plumber' },
    { id: 'carpenter', label: '🪵 Carpenter' },
    { id: 'ac_repair', label: '❄️ AC Repair' },
    { id: 'painter', label: '🎨 Painter' },
    { id: 'cleaning', label: '🧹 Cleaning' },
    { id: 'auto', label: '🚗 Auto Repair' },
    { id: 'appliance', label: '🔌 Appliances' },
];

const EXP_LEVELS = [
    { value: '0-1', label: 'Less than 1 yr' },
    { value: '1-3', label: '1–3 years' },
    { value: '3-5', label: '3–5 years' },
    { value: '5+', label: '5+ years' },
];

export default function OnboardingSkills({ data, onNext }) {
    const [selected, setSelected] = useState(data.categories || []);
    const [exp, setExp] = useState(data.experience || '');

    const toggle = (id) => {
        setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
    };

    const isValid = selected.length > 0 && exp;

    return (
        <ScrollView contentContainerStyle={styles.screen}>
            <Text style={styles.title}>Your Skills</Text>
            <Text style={styles.sub}>Select all that apply — you can add more later.</Text>

            <View style={styles.grid}>
                {CATEGORIES.map(c => {
                    const active = selected.includes(c.id);
                    return (
                        <TouchableOpacity
                            key={c.id}
                            style={[styles.chip, active && styles.chipActive]}
                            onPress={() => toggle(c.id)}
                        >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <Text style={[styles.label, { marginTop: spacing.lg }]}>Years of Experience</Text>
            <View style={styles.expRow}>
                {EXP_LEVELS.map(e => (
                    <TouchableOpacity
                        key={e.value}
                        style={[styles.expChip, exp === e.value && styles.expChipActive]}
                        onPress={() => setExp(e.value)}
                    >
                        <Text style={[styles.expText, exp === e.value && styles.expTextActive]}>{e.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <GoldButton
                title="Continue"
                disabled={!isValid}
                onPress={() => onNext({ categories: selected, experience: exp })}
                style={{ marginTop: spacing.xl }}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    screen: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
    title: { color: colors.text.primary, fontSize: 24, fontWeight: '700' },
    sub: { color: colors.text.secondary, fontSize: 14 },
    label: { color: colors.text.secondary, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
        paddingHorizontal: spacing.md, paddingVertical: 10,
        backgroundColor: colors.bg.elevated, borderRadius: radius.full,
        borderWidth: 1, borderColor: colors.bg.surface,
    },
    chipActive: { borderColor: colors.gold.primary, backgroundColor: colors.gold.glow },
    chipText: { color: colors.text.secondary, fontSize: 14, fontWeight: '500' },
    chipTextActive: { color: colors.gold.primary },
    expRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    expChip: {
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        backgroundColor: colors.bg.elevated, borderRadius: radius.lg,
        borderWidth: 1, borderColor: colors.bg.surface,
    },
    expChipActive: { borderColor: colors.gold.primary, backgroundColor: colors.gold.glow },
    expText: { color: colors.text.secondary, fontSize: 13 },
    expTextActive: { color: colors.gold.primary, fontWeight: '600' },
});
