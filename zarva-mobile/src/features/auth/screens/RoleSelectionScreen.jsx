/**
 * src/screens/auth/RoleSelection.jsx
 * "I am a..." — Customer or Service Provider cards, GoldButton confirm.
 */
import React, { useState } from 'react';
import { useTokens } from '../../design-system';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, UIManager, Platform, Alert } from 'react-native';


import PremiumButton from '@shared/ui/PremiumButton';
import { useAuthStore } from '@auth/store';
import apiClient from '@infra/api/client';
import { useT } from '../../hooks/useT';
import MainBackground from '@shared/ui/MainBackground';
import { LinearGradient } from 'expo-linear-gradient';

export default function RoleSelection() {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(false);
    const { user, token, login } = useAuthStore();
    const t = useT();

    const ROLES = [
        {
            role: 'customer',
            icon: '🏠',
            title: t('customer'),
            sub: t('customer_desc'),
        },
        {
            role: 'worker',
            icon: '🔧',
            title: t('worker'),
            sub: t('worker_desc'),
        },
    ];

    const handleContinue = async () => {
        if (!selected) return;
        setLoading(true);
        try {
            const res = await apiClient.put('/api/me', { active_role: selected });
            const userResponse = res.data?.user || res.data;
            const updated = {
                ...user,
                role: selected,
                active_role: selected,
                onboarding_complete: selected === 'customer',
                ...userResponse
            };
            login(updated, token);
        } catch (err) {
            if (err.response?.status === 409) {
                // Role already set in DB, likely logged in elsewhere and synced back
                const dbProfile = err.response.data?.user;
                if (dbProfile) {
                    Alert.alert(t('role_locked'), err.response.data?.message || t('role_cannot_change'));
                    login({ ...user, ...dbProfile }, token);
                }
            } else {
                // Dev fallback / Network Error
                console.warn('Role selection update failed, applying locally: ', err);
                const updated = { ...user, role: selected, active_role: selected, onboarding_complete: selected === 'customer' };
                login(updated, token);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <MainBackground>
            <View style={styles.content}>
                <Text style={styles.title}>{t('choose_role')}</Text>

                <View style={styles.cards}>
                    {ROLES.map((r) => {
                        const isSelected = selected === r.role;
                        return (
                            <TouchableOpacity
                                key={r.role}
                                style={[styles.card, isSelected && styles.cardSelected]}
                                onPress={() => {
                                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                    setSelected(r.role);
                                }}
                                activeOpacity={0.85}
                            >
                                {isSelected && (
                                    <LinearGradient
                                        colors={['#FF4FA315', '#A855F715']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={StyleSheet.absoluteFill}
                                    />
                                )}
                                <Text style={styles.icon}>{r.icon}</Text>
                                <View style={styles.cardText}>
                                    <Text style={[styles.cardTitle, isSelected && styles.cardTitleActive]}>
                                        {r.title}
                                    </Text>
                                    <Text style={styles.cardSub}>{r.sub}</Text>
                                </View>
                                <View style={[styles.radio, isSelected && styles.radioActive]}>
                                    {isSelected && <View style={styles.radioDot} />}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <PremiumButton
                    title={t('continue')}
                    disabled={!selected}
                    loading={loading}
                    onPress={handleContinue}
                    style={{ marginTop: tTheme.spacing.xl }}
                />
            </View>
        </MainBackground>
    );
}

const createStyles = (t) => StyleSheet.create({
    content: {
        flex: 1,
        paddingHorizontal: t.spacing.lg, justifyContent: 'center', gap: t.spacing.sm,
    },
    title: { color: t.text.primary, fontSize: 30, fontWeight: '800' },
    sub: { color: t.text.secondary, fontSize: 14, marginBottom: t.spacing.md },
    cards: { gap: t.spacing.md },
    card: {
        flexDirection: 'row', alignItems: 'center', gap: t.spacing.md,
        backgroundColor: t.background.surface, borderRadius: t.radius.xl,
        padding: t.spacing.lg, borderWidth: 1.5, borderColor: 'transparent',
        overflow: 'hidden'
    },
    cardSelected: {
        borderColor: t.brand.primary + '44',
    },
    icon: { fontSize: 40 },
    cardText: { flex: 1 },
    cardTitle: { color: t.text.secondary, fontSize: 19, fontWeight: '700' },
    cardTitleActive: { color: t.text.primary },
    cardSub: { color: t.text.tertiary, fontSize: 13, marginTop: 3 },
    radio: {
        width: 22, height: 22, borderRadius: 11,
        borderWidth: 2, borderColor: t.text.tertiary,
        justifyContent: 'center', alignItems: 'center',
    },
    radioActive: { borderColor: t.brand.primary },
    radioDot: {
        width: 11, height: 11, borderRadius: 5.5,
        backgroundColor: t.brand.primary,
    },
});
