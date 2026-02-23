/**
 * src/screens/auth/RoleSelection.jsx
 * "I am a..." — Customer or Service Provider cards, GoldButton confirm.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, UIManager, Platform, Alert } from 'react-native';

import { colors, spacing, radius } from '../../design-system/tokens';
import GoldButton from '../../components/GoldButton';
import { useAuthStore } from '../../stores/authStore';
import apiClient from '../../services/api/client';
import { useT } from '../../hooks/useT';

export default function RoleSelection() {
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
        <View style={styles.screen}>
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

            <GoldButton
                title={t('continue')}
                disabled={!selected}
                loading={loading}
                onPress={handleContinue}
                style={{ marginTop: spacing.xl }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1, backgroundColor: colors.bg.primary,
        paddingHorizontal: spacing.lg, justifyContent: 'center', gap: spacing.sm,
    },
    title: { color: colors.text.primary, fontSize: 30, fontWeight: '800' },
    sub: { color: colors.text.secondary, fontSize: 14, marginBottom: spacing.md },
    cards: { gap: spacing.md },
    card: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        backgroundColor: colors.bg.elevated, borderRadius: radius.xl,
        padding: spacing.lg, borderWidth: 1.5, borderColor: 'transparent',
    },
    cardSelected: {
        borderColor: colors.gold.primary,
        backgroundColor: colors.gold.glow,
    },
    icon: { fontSize: 40 },
    cardText: { flex: 1 },
    cardTitle: { color: colors.text.secondary, fontSize: 19, fontWeight: '700' },
    cardTitleActive: { color: colors.text.primary },
    cardSub: { color: colors.text.muted, fontSize: 13, marginTop: 3 },
    radio: {
        width: 22, height: 22, borderRadius: 11,
        borderWidth: 2, borderColor: colors.text.muted,
        justifyContent: 'center', alignItems: 'center',
    },
    radioActive: { borderColor: colors.gold.primary },
    radioDot: {
        width: 11, height: 11, borderRadius: 5.5,
        backgroundColor: colors.gold.primary,
    },
});
