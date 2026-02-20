/**
 * src/screens/auth/LanguageScreen.jsx
 * CRED-style dark screen with radial gold glow, ZARVA wordmark, two language cards.
 */
import React, { useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../../design-system/tokens';
import { useAuthStore } from '../../stores/authStore';

const { width, height } = Dimensions.get('window');

const LANGS = [
    { code: 'en', primary: 'English', flag: '🇬🇧', sub: 'Continue in English' },
    { code: 'ml', primary: 'മലയാളം', flag: '🇮🇳', sub: 'മലയാളത്തിൽ തുടരുക' },
];

export default function LanguageScreen({ navigation }) {
    const [selected, setSelected] = useState('ml');
    const setUser = useAuthStore(s => s.setUser);

    const handleContinue = () => {
        // Persist language preference in store
        setUser({ language: selected });
        navigation.navigate('Phone');
    };

    return (
        <View style={styles.screen}>
            {/* Radial gold glow background */}
            <View style={styles.glowContainer} pointerEvents="none">
                <View style={styles.glow} />
            </View>

            {/* Wordmark */}
            <View style={styles.header}>
                <Text style={styles.wordmark}>ZARVA</Text>
                <Text style={styles.tagline}>Choose your language</Text>
            </View>

            {/* Language Cards */}
            <View style={styles.cards}>
                {LANGS.map((lang) => {
                    const isSelected = selected === lang.code;
                    return (
                        <TouchableOpacity
                            key={lang.code}
                            style={[styles.card, isSelected && styles.cardSelected]}
                            onPress={() => setSelected(lang.code)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.flag}>{lang.flag}</Text>
                            <View style={styles.cardText}>
                                <Text style={[styles.langPrimary, isSelected && styles.langPrimaryActive]}>
                                    {lang.primary}
                                </Text>
                                <Text style={styles.langSub}>{lang.sub}</Text>
                            </View>
                            {isSelected && (
                                <View style={styles.checkCircle}>
                                    <Text style={styles.check}>✓</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Continue Button */}
            <TouchableOpacity style={styles.continueBtn} onPress={handleContinue} activeOpacity={0.88}>
                <Text style={styles.continueTxt}>Continue</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.bg.primary,
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xl,
    },
    glowContainer: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        justifyContent: 'center', alignItems: 'center',
    },
    glow: {
        width: 320, height: 320, borderRadius: 160,
        backgroundColor: colors.gold.glow,
        shadowColor: colors.gold.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5, shadowRadius: 80, elevation: 0,
    },
    header: { alignItems: 'center', marginBottom: spacing.xl * 1.5 },
    wordmark: {
        color: colors.gold.primary, fontSize: 48, fontWeight: '800',
        letterSpacing: 10, marginBottom: spacing.sm,
    },
    tagline: { color: colors.text.secondary, fontSize: 15, letterSpacing: 0.5 },
    cards: { gap: spacing.md, marginBottom: spacing.xl },
    card: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        backgroundColor: colors.bg.elevated, borderRadius: radius.xl,
        padding: spacing.lg, borderWidth: 1.5, borderColor: 'transparent',
    },
    cardSelected: {
        borderColor: colors.gold.primary,
        backgroundColor: colors.gold.glow,
    },
    flag: { fontSize: 36 },
    cardText: { flex: 1 },
    langPrimary: {
        color: colors.text.secondary, fontSize: 20, fontWeight: '600',
    },
    langPrimaryActive: { color: colors.text.primary },
    langSub: { color: colors.text.muted, fontSize: 13, marginTop: 3 },
    checkCircle: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: colors.gold.primary,
        justifyContent: 'center', alignItems: 'center',
    },
    check: { color: colors.text.inverse, fontWeight: '700', fontSize: 14 },
    continueBtn: {
        height: 56, backgroundColor: colors.gold.primary,
        borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center',
        marginTop: spacing.lg,
    },
    continueTxt: {
        color: colors.text.inverse, fontSize: 16,
        fontWeight: '700', letterSpacing: 0.5,
    },
});
