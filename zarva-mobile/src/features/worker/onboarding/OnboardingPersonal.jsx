import React, { useState } from 'react';
import { useTokens } from '../@shared/design-system';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';


import PremiumButton from '@shared/ui/PremiumButton';
import LocationInput from '@jobs/components/LocationInput';
import FadeInView from '@shared/ui/FadeInView';
import Card from '@shared/ui/ZCard';
import { useT } from '../@shared/i18n/useTranslation';
import { useUIStore } from '@shared/hooks/uiStore';
import apiClient from '@infra/api/client';
import MainBackground from '@shared/ui/MainBackground';
import { LinearGradient } from 'expo-linear-gradient';

const RANGES = [10, 20, 50];

export default function OnboardingBasicInfo({ data, onNext }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const GENDERS = [
        { key: 'male', label: t('gender_male') },
        { key: 'female', label: t('gender_female') },
        { key: 'other', label: t('gender_other') }
    ];
    const [gender, setGender] = useState(data.gender || '');
    const [experience, setExperience] = useState(data.experience_years ? String(data.experience_years) : '');
    const [workerLocation, setWorkerLocation] = useState({});
    const [serviceRange, setServiceRange] = useState(data.service_range || 20);
    const [loading, setLoading] = useState(false);
    const { showLoader, hideLoader } = useUIStore();

    React.useEffect(() => {
        if (loading) {
            showLoader(t('fetching_location') || "Acquiring Coordinates...");
        } else {
            hideLoader();
        }
    }, [loading]);

    const isValid = gender && workerLocation.isValid && experience.trim().length > 0;

    const handleGenderSelect = (key) => {
        setGender(key);
        Haptics.selectionAsync();
    };

    const handleRangeSelect = (r) => {
        setServiceRange(r);
        Haptics.selectionAsync();
    };

    return (
        <MainBackground>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <FadeInView delay={50}>
                    <Text style={styles.headerSub}>{t('step_01')}</Text>
                    <Text style={styles.title}>{t('professional_foundation')}</Text>
                    <Text style={styles.sub}>{t('professional_foundation_desc')}</Text>
                </FadeInView>

                <FadeInView delay={150} style={styles.section}>
                    <Text style={styles.label}>{t('identity')}</Text>
                    <View style={styles.radioGrid}>
                        {GENDERS.map(item => {
                            const active = gender === item.key;
                            return (
                                <TouchableOpacity
                                    key={item.key}
                                    style={[styles.radioChip, active && styles.radioChipActive]}
                                    onPress={() => handleGenderSelect(item.key)}
                                >
                                    {active && (
                                        <LinearGradient
                                            colors={['#FF4FA3', '#A855F7']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={StyleSheet.absoluteFill}
                                        />
                                    )}
                                    <Text style={[styles.radioText, active && styles.radioTextActive]}>{item.label.toUpperCase()}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </FadeInView>

                <FadeInView delay={250} style={styles.section}>
                    <Text style={styles.label}>{t('expertise_years')}</Text>
                    <Card style={styles.inputCard}>
                        <TextInput
                            style={styles.input}
                            value={experience}
                            onChangeText={t => setExperience(t.replace(/[^0-9]/g, ''))}
                            placeholder={t('eg_years')}
                            placeholderTextColor={t.text.tertiary}
                            keyboardType="number-pad"
                            maxLength={2}
                        />
                    </Card>
                </FadeInView>

                <FadeInView delay={350} style={styles.section}>
                    <Text style={styles.label}>{t('operational_radius')}</Text>
                    <View style={styles.radioGrid}>
                        {RANGES.map(r => {
                            const active = serviceRange === r;
                            return (
                                <TouchableOpacity
                                    key={r}
                                    style={[styles.radioChip, active && styles.radioChipActive]}
                                    onPress={() => handleRangeSelect(r)}
                                >
                                    {active && (
                                        <LinearGradient
                                            colors={['#FF4FA3', '#A855F7']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={StyleSheet.absoluteFill}
                                        />
                                    )}
                                    <Text style={[styles.radioText, active && styles.radioTextActive]}>{r} {t('km_suffix')}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    <Text style={styles.noteTxt}>{t('radius_hint')}</Text>
                </FadeInView>

                <FadeInView delay={450} style={styles.section}>
                    <Text style={styles.label}>{t('mission_base')}</Text>
                    <Card style={styles.locCard}>
                        <LocationInput onChange={setWorkerLocation} onLoading={setLoading} />
                    </Card>
                </FadeInView>

                <FadeInView delay={550} style={styles.footer}>
                    <PremiumButton
                        title={t('initialize_profile')}
                        disabled={!isValid}
                        onPress={() => {
                            if (!isValid) {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                                // We don't necessarily need a full Alert here for every step, 
                                // but for Step 1 it's good to be explicit.
                                return;
                            }
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            onNext({ gender, location: workerLocation, experience_years: parseInt(experience, 10) || 0, service_range: serviceRange });
                        }}
                    />
                </FadeInView>
            </ScrollView>
        </MainBackground>
    );
}

const createStyles = (t) => StyleSheet.create({
    scrollContent: { padding: t.spacing['2xl'], gap: t.spacing[32], paddingBottom: 60 },
    headerSub: { color: t.text.secondary, fontSize: 12, fontWeight: t.typography.weight.bold, letterSpacing: 2 },
    title: { color: t.text.primary, fontSize: 32, fontWeight: '900', letterSpacing: t.typography.tracking.hero, marginTop: 4 },
    sub: { color: t.text.tertiary, fontSize: t.typography.size.body, lineHeight: 24, marginTop: 8 },

    section: { gap: 12 },
    label: { color: t.text.primary, fontSize: 12, fontWeight: t.typography.weight.bold, letterSpacing: 2 },

    radioGrid: { flexDirection: 'row', gap: 10 },
    radioChip: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
        backgroundColor: t.background.surface,
        borderRadius: t.radius.lg,
        borderWidth: 1,
        borderColor: t.background.surface
    },
    radioChipActive: {
        borderColor: 'transparent',
        overflow: 'hidden',
        ...t.shadows.accentGlow
    },
    radioText: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1 },
    radioTextActive: {
        color: 't.text.primary',
        textShadowColor: 'rgba(0,0,0,0.2)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4
    },

    inputCard: { backgroundColor: t.background.surface, padding: 4, borderWidth: 1, borderColor: t.background.surface },
    input: {
        paddingHorizontal: 16, paddingVertical: 14,
        color: t.text.primary, fontSize: 18, fontWeight: t.typography.weight.bold
    },

    locCard: { padding: 4, backgroundColor: t.background.surface, borderWidth: 1, borderColor: t.background.surface },
    noteTxt: { color: t.text.tertiary, fontSize: 10, marginTop: 4, fontStyle: 'italic' },

    footer: { marginTop: t.spacing.lg },

    appMetadata: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 2, textAlign: 'center', marginTop: 24 }
});
