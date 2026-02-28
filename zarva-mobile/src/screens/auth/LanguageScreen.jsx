import React, { useState, useMemo } from 'react';
import { useTokens } from '../../design-system';
import {
    View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';


import { useAuthStore } from '../../stores/authStore';
import { SUPPORTED_LANGUAGES } from '../../i18n/languages';
import { useLanguageStore } from '../../i18n';
import MainBackground from '../../components/MainBackground';
import PremiumButton from '../../components/PremiumButton';
import { LinearGradient } from 'expo-linear-gradient';
import { useT } from '../../hooks/useT';
import FadeInView from '../../components/FadeInView';

const FEATURED_LANGS = ['ml', 'en', 'hi'];

export default function LanguageScreen({ navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const defaultLang = useLanguageStore(s => s.language) || 'ml';
    const loadLanguage = useLanguageStore(s => s.loadLanguage);
    const user = useAuthStore(s => s.user);
    const setUser = useAuthStore(s => s.setUser);

    const [selected, setSelected] = useState(defaultLang);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const filteredLangs = useMemo(() => {
        if (!searchQuery.trim()) return SUPPORTED_LANGUAGES;
        const q = searchQuery.toLowerCase();
        return SUPPORTED_LANGUAGES.filter(
            lang => lang.label.toLowerCase().includes(q)
                || lang.nativeLabel.toLowerCase().includes(q)
                || lang.region.toLowerCase().includes(q)
        );
    }, [searchQuery]);

    const featuredLangs = useMemo(() => {
        return SUPPORTED_LANGUAGES.filter(l => FEATURED_LANGS.includes(l.code));
    }, []);

    const handleContinue = async () => {
        if (user) {
            setUser({ ...user, language: selected });
        } else {
            setUser({ language: selected });
        }
        await loadLanguage(selected);
        navigation.navigate('Phone');
    };

    const renderLanguageCard = (item, isFeatured = false) => {
        const isSelected = selected === item.code;
        return (
            <TouchableOpacity
                key={item.code}
                style={[
                    styles.card,
                    isFeatured ? styles.featuredCard : styles.regularCard,
                    isSelected && styles.cardSelected
                ]}
                onPress={() => setSelected(item.code)}
                activeOpacity={0.8}
            >
                {isSelected && (
                    <LinearGradient
                        colors={[tTheme.brand.primary + '22', 'transparent']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                )}
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
        <MainBackground>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <View style={styles.header}>
                    <FadeInView delay={100}>
                        <Text style={styles.wordmark}>ZARVA</Text>
                    </FadeInView>
                    <FadeInView delay={200}>
                        <Text style={styles.tagline}>{t('choose_language_title')}</Text>
                    </FadeInView>
                </View>

                <FadeInView delay={300} style={styles.searchSection}>
                    <View style={[styles.searchContainer, isSearching && styles.searchContainerActive]}>
                        <TextInput
                            style={styles.searchInput}
                            placeholder={t('search_language') || "Search all languages..."}
                            placeholderTextColor={tTheme.text.tertiary}
                            value={searchQuery}
                            onChangeText={txt => {
                                setSearchQuery(txt);
                                setIsSearching(txt.length > 0);
                            }}
                            onFocus={() => setIsSearching(true)}
                            autoCorrect={false}
                        />
                        {searchQuery !== '' && (
                            <TouchableOpacity onPress={() => {
                                setSearchQuery('');
                                setIsSearching(false);
                            }} style={styles.clearBtn}>
                                <Text style={styles.clearText}>✕</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </FadeInView>

                {isSearching ? (
                    <FlatList
                        data={filteredLangs}
                        keyExtractor={item => item.code}
                        renderItem={({ item }) => renderLanguageCard(item)}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    />
                ) : (
                    <ScrollView
                        style={styles.mainScroll}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        <FadeInView delay={400} style={styles.featuredSection}>
                            <Text style={styles.sectionLabel}>
                                {t('featured_languages') === 'featured_languages' ? 'FEATURED' : t('featured_languages')}
                            </Text>
                            <View style={styles.featuredGrid}>
                                {featuredLangs.map(lang => renderLanguageCard(lang, true))}
                            </View>
                            <TouchableOpacity
                                style={styles.viewAllBtn}
                                onPress={() => setIsSearching(true)}
                            >
                                <Text style={styles.viewAllText}>
                                    {t('view_all_languages') === 'view_all_languages' ? 'Explore more languages...' : t('view_all_languages')}
                                </Text>
                            </TouchableOpacity>
                        </FadeInView>
                    </ScrollView>
                )}

                <FadeInView delay={500} style={styles.footer}>
                    <PremiumButton
                        title={t('continue')}
                        disabled={!selected}
                        onPress={handleContinue}
                    />
                </FadeInView>
            </KeyboardAvoidingView>
        </MainBackground>
    );
}

const createStyles = (t) => StyleSheet.create({
    container: { flex: 1 },
    header: { alignItems: 'center', marginTop: t.spacing.xl * 2, marginBottom: t.spacing.xl },
    wordmark: {
        color: t.text.primary, fontSize: 32, fontWeight: '900',
        letterSpacing: 10, marginBottom: t.spacing.xs,
        textShadowColor: t.brand.primary,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 15
    },
    tagline: {
        color: t.text.secondary,
        fontSize: 12,
        fontWeight: t.typography.weight.bold,
        letterSpacing: 2,
        textTransform: 'uppercase'
    },

    searchSection: { paddingHorizontal: t.spacing.lg, marginBottom: t.spacing.lg },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: t.radius.xl,
        paddingHorizontal: t.spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    searchContainerActive: {
        borderColor: t.brand.primary + '66',
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    searchInput: {
        flex: 1,
        color: t.text.primary,
        fontSize: 16,
        paddingVertical: 14,
    },
    mainScroll: { flex: 1 },
    scrollContent: { paddingBottom: 120 },
    clearBtn: { padding: t.spacing.sm },
    clearText: { color: t.text.tertiary, fontSize: 16 },

    featuredSection: { flex: 1, paddingHorizontal: t.spacing.lg },
    sectionLabel: {
        color: t.text.tertiary,
        fontSize: 10,
        fontWeight: t.typography.weight.bold,
        letterSpacing: 1.5,
        marginBottom: t.spacing.md
    },
    featuredGrid: { gap: t.spacing.md },

    listContent: {
        paddingHorizontal: t.spacing.lg,
        paddingBottom: 120,
        gap: t.spacing.sm,
    },

    card: {
        flexDirection: 'row', alignItems: 'center', gap: t.spacing.md,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: t.radius.lg,
        padding: t.spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        overflow: 'hidden'
    },
    featuredCard: {
        paddingVertical: t.spacing.xl,
    },
    cardSelected: {
        borderColor: t.brand.primary + '88',
        backgroundColor: 'rgba(255,255,255,0.06)',
        ...t.shadows.accentGlow
    },
    flag: { fontSize: 28 },
    cardText: { flex: 1 },
    langPrimary: {
        color: t.text.secondary, fontSize: 18, fontWeight: '700',
    },
    langPrimaryActive: { color: t.text.primary },
    langSub: { color: t.text.tertiary, fontSize: 12, marginTop: 2 },

    checkCircle: {
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: t.brand.primary,
        justifyContent: 'center', alignItems: 'center',
    },
    check: { color: t.text.primary, fontWeight: '800', fontSize: 12 },

    viewAllBtn: {
        marginTop: t.spacing.xl,
        alignItems: 'center',
        padding: t.spacing.md
    },
    viewAllText: {
        color: t.text.tertiary,
        fontSize: 13,
        fontWeight: t.typography.weight.medium,
        fontStyle: 'italic'
    },

    footer: {
        paddingHorizontal: t.spacing.lg,
        paddingBottom: Platform.OS === 'ios' ? t.spacing.xl * 2 : t.spacing.xl,
        paddingTop: t.spacing.md,
    },
});
