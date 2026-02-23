/**
 * src/screens/auth/LanguageScreen.jsx
 */
import React, { useState, useMemo } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Dimensions, FlatList, TextInput
} from 'react-native';
import { colors, spacing, radius } from '../../design-system/tokens';
import { useAuthStore } from '../../stores/authStore';
import { SUPPORTED_LANGUAGES } from '../../i18n/languages';
import { useLanguageStore } from '../../i18n';

export default function LanguageScreen({ navigation }) {
    const defaultLang = useLanguageStore(s => s.language) || 'ml';
    const loadLanguage = useLanguageStore(s => s.loadLanguage);
    const setUser = useAuthStore(s => s.setUser);

    const [selected, setSelected] = useState(defaultLang);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredLangs = useMemo(() => {
        if (!searchQuery.trim()) return SUPPORTED_LANGUAGES;
        const q = searchQuery.toLowerCase();
        return SUPPORTED_LANGUAGES.filter(
            lang => lang.label.toLowerCase().includes(q)
                || lang.nativeLabel.toLowerCase().includes(q)
                || lang.region.toLowerCase().includes(q)
        );
    }, [searchQuery]);

    const handleContinue = async () => {
        // Persist language preference in auth store – safely merge if user exists
        if (user) {
            setUser({ ...user, language: selected });
        } else {
            setUser({ language: selected });
        }

        // Load the language dynamically and wait for it
        // so the next screen (Phone) is already translated
        await loadLanguage(selected);

        // Navigate
        navigation.navigate('Phone');
    };

    const renderItem = ({ item }) => {
        const isSelected = selected === item.code;
        return (
            <TouchableOpacity
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => setSelected(item.code)}
                activeOpacity={0.8}
            >
                <Text style={styles.flag}>{item.flag}</Text>
                <View style={styles.cardText}>
                    <Text style={[styles.langPrimary, isSelected && styles.langPrimaryActive]}>
                        {item.nativeLabel}
                    </Text>
                    <Text style={styles.langSub}>{item.label} • {item.region}</Text>
                </View>
                {isSelected && (
                    <View style={styles.checkCircle}>
                        <Text style={styles.check}>✓</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.wordmark}>ZARVA</Text>
                <Text style={styles.tagline}>Choose your language</Text>
            </View>

            {/* Search Input */}
            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search language..."
                    placeholderTextColor={colors.text.muted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCorrect={false}
                />
                {searchQuery !== '' && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                        <Text style={styles.clearText}>✕</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* List */}
            <FlatList
                data={filteredLangs}
                keyExtractor={item => item.code}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            />

            {/* Continue Button fixed to bottom */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.continueBtn, !selected && styles.continueBtnDisabled]}
                    onPress={handleContinue}
                    disabled={!selected}
                    activeOpacity={0.88}
                >
                    <Text style={styles.continueTxt}>Continue</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.bg.primary,
        paddingTop: spacing.xl * 2,
    },
    header: { alignItems: 'center', marginBottom: spacing.xl },
    wordmark: {
        color: colors.gold.primary, fontSize: 40, fontWeight: '800',
        letterSpacing: 8, marginBottom: spacing.xs,
    },
    tagline: { color: colors.text.secondary, fontSize: 16, letterSpacing: 0.5 },
    searchContainer: {
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1A26', // slightly elevated dark background
        borderRadius: radius.md,
        paddingHorizontal: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(207, 163, 75, 0.2)', // subtle gold outline
    },
    searchInput: {
        flex: 1,
        color: colors.text.primary,
        fontSize: 16,
        paddingVertical: spacing.md,
    },
    clearBtn: { padding: spacing.sm },
    clearText: { color: colors.text.muted, fontSize: 18 },
    listContent: {
        paddingHorizontal: spacing.lg,
        paddingBottom: 100, // accommodate fixed footer
        gap: spacing.sm,
    },
    card: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        backgroundColor: colors.bg.elevated, borderRadius: radius.lg,
        padding: spacing.lg, borderWidth: 1.5, borderColor: 'transparent',
    },
    cardSelected: {
        borderColor: colors.gold.primary,
        backgroundColor: 'rgba(207, 163, 75, 0.1)', // #CFA34B at 10% opacity, gold-tinted
    },
    flag: { fontSize: 32 },
    cardText: { flex: 1 },
    langPrimary: {
        color: colors.text.secondary, fontSize: 22, fontWeight: '700',
    },
    langPrimaryActive: { color: colors.text.primary },
    langSub: { color: colors.text.muted, fontSize: 13, marginTop: 4 },
    checkCircle: {
        width: 26, height: 26, borderRadius: 13,
        backgroundColor: colors.gold.primary,
        justifyContent: 'center', alignItems: 'center',
    },
    check: { color: colors.text.inverse, fontWeight: '700', fontSize: 14 },
    footer: {
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        backgroundColor: colors.bg.primary,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.xl,
        borderTopWidth: 1,
        borderTopColor: colors.bg.surface,
    },
    continueBtn: {
        height: 56, backgroundColor: colors.gold.primary,
        borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center',
    },
    continueBtnDisabled: {
        backgroundColor: colors.bg.surface,
    },
    continueTxt: {
        color: colors.text.inverse, fontSize: 16,
        fontWeight: '700', letterSpacing: 0.5,
    },
});
