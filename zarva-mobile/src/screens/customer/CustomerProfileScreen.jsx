import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, TextInput } from 'react-native';
import { colors, spacing, radius } from '../../design-system/tokens';
import { useAuthStore } from '../../stores/authStore';
import { useLanguageStore } from '../../i18n';
import { SUPPORTED_LANGUAGES } from '../../i18n/languages';
import { useT } from '../../hooks/useT';
import apiClient from '../../services/api/client';

export default function CustomerProfileScreen() {
    const { user, logout, setUser } = useAuthStore();
    const { language, loadLanguage } = useLanguageStore();
    const t = useT();

    const [isLangModalOpen, setIsLangModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const currentLangObj = SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0];

    const filteredLangs = useMemo(() => {
        if (!searchQuery.trim()) return SUPPORTED_LANGUAGES;
        const q = searchQuery.toLowerCase();
        return SUPPORTED_LANGUAGES.filter(
            lang => lang.label.toLowerCase().includes(q)
                || lang.nativeLabel.toLowerCase().includes(q)
                || lang.region.toLowerCase().includes(q)
        );
    }, [searchQuery]);

    const handleSelectLanguage = async (code) => {
        setIsLangModalOpen(false);
        setSearchQuery('');

        // Optimize: load locally immediately for instant UI snap
        await loadLanguage(code);

        // Persist to user DB profile
        if (user) {
            setUser({ ...user, language_preference: code });
            try {
                await apiClient.post('/api/me/profile', { language_preference: code });
            } catch (err) {
                console.error('Failed to sync language to DB', err);
            }
        }
    };

    return (
        <View style={styles.screen}>
            <Text style={styles.title}>{t('profile_title')}</Text>
            <Text style={styles.phone}>{user?.phone || t('customer')}</Text>

            <TouchableOpacity style={styles.langRow} onPress={() => setIsLangModalOpen(true)}>
                <View>
                    <Text style={styles.langLabel}>{t('language')}</Text>
                    <Text style={styles.langValue}>{currentLangObj.flag}  {currentLangObj.nativeLabel}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logout} onPress={logout}>
                <Text style={styles.logoutText}>{t('logout')}</Text>
            </TouchableOpacity>

            <Modal visible={isLangModalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsLangModalOpen(false)}>
                <View style={styles.modalScreen}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{t('choose_language_title')}</Text>
                        <TouchableOpacity onPress={() => setIsLangModalOpen(false)}>
                            <Text style={styles.closeBtn}>{t('done')}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.searchContainer}>
                        <TextInput
                            style={styles.searchInput}
                            placeholder={t('search_language')}
                            placeholderTextColor={colors.text.muted}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoCorrect={false}
                        />
                    </View>

                    <FlatList
                        data={filteredLangs}
                        keyExtractor={item => item.code}
                        contentContainerStyle={styles.listContent}
                        renderItem={({ item }) => {
                            const isSelected = language === item.code;
                            return (
                                <TouchableOpacity
                                    style={[styles.card, isSelected && styles.cardSelected]}
                                    onPress={() => handleSelectLanguage(item.code)}
                                >
                                    <Text style={styles.flag}>{item.flag}</Text>
                                    <View style={styles.cardText}>
                                        <Text style={[styles.langPrimary, isSelected && styles.langPrimaryActive]}>{item.nativeLabel}</Text>
                                        <Text style={styles.langSub}>{item.label} • {item.region}</Text>
                                    </View>
                                    {isSelected && <View style={styles.checkCircle}><Text style={styles.check}>✓</Text></View>}
                                </TouchableOpacity>
                            );
                        }}
                    />
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary, padding: spacing.xl, justifyContent: 'center', alignItems: 'center' },
    title: { color: colors.text.primary, fontSize: 28, fontWeight: '700', marginBottom: spacing.xs },
    phone: { color: colors.text.secondary, fontSize: 16, marginBottom: spacing.xl * 2 },

    langRow: {
        width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: colors.bg.elevated, padding: spacing.lg, borderRadius: radius.lg,
        borderWidth: 1, borderColor: colors.border.muted, marginBottom: spacing.xl
    },
    langLabel: { color: colors.text.muted, fontSize: 13, marginBottom: 4 },
    langValue: { color: colors.text.primary, fontSize: 18, fontWeight: '600' },
    chevron: { color: colors.text.muted, fontSize: 24 },

    logout: { borderWidth: 1, borderColor: colors.error, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, width: '100%', alignItems: 'center' },
    logoutText: { color: colors.error, fontWeight: '700', fontSize: 16 },

    // Modal Styles
    modalScreen: { flex: 1, backgroundColor: '#0A0A0F', paddingTop: 60 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
    modalTitle: { color: colors.text.primary, fontSize: 20, fontWeight: '700' },
    closeBtn: { color: colors.gold.primary, fontSize: 16, fontWeight: '600' },
    searchContainer: { marginHorizontal: spacing.lg, marginBottom: spacing.md, backgroundColor: '#1A1A26', borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: 'rgba(207, 163, 75, 0.2)' },
    searchInput: { color: colors.text.primary, fontSize: 16, paddingVertical: spacing.md },
    listContent: { paddingHorizontal: spacing.lg, paddingBottom: 60, gap: spacing.sm },
    card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.bg.elevated, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1.5, borderColor: 'transparent' },
    cardSelected: { borderColor: colors.gold.primary, backgroundColor: 'rgba(207, 163, 75, 0.1)' },
    flag: { fontSize: 32 },
    cardText: { flex: 1 },
    langPrimary: { color: colors.text.secondary, fontSize: 22, fontWeight: '700' },
    langPrimaryActive: { color: colors.text.primary },
    langSub: { color: colors.text.muted, fontSize: 13, marginTop: 4 },
    checkCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.gold.primary, justifyContent: 'center', alignItems: 'center' },
    check: { color: colors.text.inverse, fontWeight: '700', fontSize: 14 }
});
