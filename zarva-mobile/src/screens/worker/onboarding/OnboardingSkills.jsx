import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, shadows } from '../../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../../design-system/typography';
import PremiumButton from '../../../components/PremiumButton';
import apiClient from '../../../services/api/client';
import FadeInView from '../../../components/FadeInView';
import Card from '../../../components/Card';
import { useT } from '../../../hooks/useT';

export default function OnboardingSkills({ data, onNext }) {
    const t = useT();

    const EXP_LEVELS = [
        { value: '0-1', label: t('exp_level_0') },
        { value: '1-3', label: t('exp_level_1') },
        { value: '3-5', label: t('exp_level_3') },
        { value: '5+', label: t('exp_level_5') },
    ];

    const [selected, setSelected] = useState(data.categories || []);
    const [exp, setExp] = useState(data.experience || '');
    const [categories, setCategories] = useState([]);
    const [showAllCategories, setShowAllCategories] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    const isSearching = searchQuery.trim() !== '';
    const displayedCategories = isSearching
        ? categories.filter(c => c.label.toLowerCase().includes(searchQuery.toLowerCase()))
        : (showAllCategories ? categories : categories.slice(0, 12));

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await apiClient.get('/api/jobs/config');
                if (res.data?.categories) {
                    const mapped = Object.values(res.data.categories);
                    setCategories(mapped);
                }
            } catch (err) {
                console.error("Failed to load skills categories", err);
            } finally {
                setLoading(false);
            }
        };
        fetchCategories();
    }, []);

    const toggle = (id) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
    };

    const handleExpSelect = (val) => {
        setExp(val);
        Haptics.selectionAsync();
    };

    const isValid = selected.length > 0 && exp;

    if (loading) {
        return (
            <View style={styles.loadingScreen}>
                <ActivityIndicator size="large" color={colors.accent.primary} />
            </View>
        );
    }

    return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <FadeInView delay={50}>
                <Text style={styles.headerSub}>{t('step_02')}</Text>
                <Text style={styles.title}>{t('define_expertise')}</Text>
                <Text style={styles.sub}>{t('define_expertise_desc')}</Text>
            </FadeInView>

            <FadeInView delay={150} style={styles.section}>
                <Text style={styles.label}>{t('competency_selection')}</Text>
                <Card style={styles.searchCard}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder={t('search_competencies')}
                        placeholderTextColor={colors.text.muted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </Card>

                <View style={styles.skillsGrid}>
                    {displayedCategories.map(c => {
                        const active = selected.includes(c.id);
                        return (
                            <TouchableOpacity
                                key={c.id}
                                style={[styles.skillChip, active && styles.skillChipActive]}
                                onPress={() => toggle(c.id)}
                            >
                                <Text style={[styles.skillTxt, active && styles.skillTxtActive]}>{c.label.toUpperCase()}</Text>
                            </TouchableOpacity>
                        );
                    })}

                    {categories.length > 12 && !showAllCategories && !isSearching && (
                        <TouchableOpacity
                            style={styles.moreChip}
                            onPress={() => {
                                setShowAllCategories(true);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                        >
                            <Text style={styles.moreTxt}>{t('view_all_skills')}</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {isSearching && displayedCategories.length === 0 && (
                    <Text style={styles.emptyResults}>{t('no_competencies_found')}</Text>
                )}
            </FadeInView>

            <FadeInView delay={350} style={styles.section}>
                <Text style={styles.label}>{t('cumulative_experience')}</Text>
                <View style={styles.expGrid}>
                    {EXP_LEVELS.map(e => {
                        const active = exp === e.value;
                        return (
                            <TouchableOpacity
                                key={e.value}
                                style={[styles.expChip, active && styles.expChipActive]}
                                onPress={() => handleExpSelect(e.value)}
                            >
                                <Text style={[styles.expLabel, active && styles.expLabelActive]}>{e.label.toUpperCase()}</Text>
                                {active && <View style={styles.activeIndicator} />}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </FadeInView>

            <FadeInView delay={550} style={styles.footer}>
                <PremiumButton
                    title={t('validate_skills')}
                    disabled={!isValid}
                    onPress={() => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        onNext({ categories: selected, experience: exp });
                    }}
                />
            </FadeInView>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    loadingScreen: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: spacing[24], gap: spacing[32], paddingBottom: 60 },
    headerSub: { color: colors.accent.primary, fontSize: 8, fontWeight: fontWeight.bold, letterSpacing: 2 },
    title: { color: colors.text.primary, fontSize: 32, fontWeight: '900', letterSpacing: tracking.hero, marginTop: 4 },
    sub: { color: colors.text.muted, fontSize: fontSize.body, lineHeight: 24, marginTop: 8 },

    section: { gap: 12 },
    label: { color: colors.accent.primary, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 2 },

    searchCard: { backgroundColor: colors.surface, padding: 4, borderWidth: 1, borderColor: colors.surface, marginBottom: 8 },
    searchInput: {
        paddingHorizontal: 16, paddingVertical: 14,
        color: colors.text.primary, fontSize: fontSize.caption, fontWeight: fontWeight.medium
    },

    skillsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    skillChip: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surface
    },
    skillChipActive: { backgroundColor: colors.accent.primary, borderColor: colors.accent.primary },
    skillTxt: { color: colors.text.muted, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 1 },
    skillTxtActive: { color: colors.background },

    moreChip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.lg, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.accent.border + '44' },
    moreTxt: { color: colors.accent.primary, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 1 },

    emptyResults: { color: colors.text.muted, fontSize: 13, fontStyle: 'italic', paddingLeft: 4 },

    expGrid: { gap: 12 },
    expChip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 18,
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.surface
    },
    expChipActive: { borderColor: colors.accent.primary + '44', backgroundColor: colors.accent.primary + '08' },
    expLabel: { color: colors.text.muted, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1 },
    expLabelActive: { color: colors.accent.primary },
    activeIndicator: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent.primary },

    footer: { marginTop: spacing[8] }
});
