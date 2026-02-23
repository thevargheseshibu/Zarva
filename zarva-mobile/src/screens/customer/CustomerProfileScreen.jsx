import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, TextInput } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, shadows } from '../../design-system/tokens';
import { useAuthStore } from '../../stores/authStore';
import { useLanguageStore } from '../../i18n';
import { SUPPORTED_LANGUAGES } from '../../i18n/languages';
import { useT } from '../../hooks/useT';
import apiClient from '../../services/api/client';
import FadeInView from '../../components/FadeInView';
import PremiumButton from '../../components/PremiumButton';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import Card from '../../components/Card';
import { fontSize, fontWeight, tracking } from '../../design-system/typography';

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
        Haptics.selectionAsync();
        setIsLangModalOpen(false);
        setSearchQuery('');
        await loadLanguage(code);
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
            <View style={styles.scrollContent}>

                <FadeInView delay={50} style={styles.header}>
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarTxt}>{user?.phone?.slice(-1) || 'Z'}</Text>
                    </View>
                    <Text style={styles.title}>{t('profile_title')}</Text>
                    <Text style={styles.phone}>{user?.phone || t('customer')}</Text>
                </FadeInView>

                {/* Metrics */}
                <FadeInView delay={200}>
                    <Card style={styles.metricsContainer}>
                        <View style={styles.metric}>
                            <Text style={styles.metricValue}>{user?.profile?.total_jobs || 0}</Text>
                            <Text style={styles.metricLabel}>{t('total_jobs') || 'TOTAL'}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.metric}>
                            <Text style={styles.metricValue}>{user?.profile?.cancelled_jobs || 0}</Text>
                            <Text style={styles.metricLabel}>{t('cancelled') || 'FAILED'}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.metric}>
                            <Text style={styles.metricValue}>{user?.profile?.average_rating ? Number(user.profile.average_rating).toFixed(1) : '5.0'}</Text>
                            <Text style={styles.metricLabel}>{t('rating') || 'RATING'}</Text>
                        </View>
                    </Card>
                </FadeInView>

                {/* Saved Addresses */}
                {user?.profile?.saved_addresses && Array.isArray(user.profile.saved_addresses) && user.profile.saved_addresses.length > 0 && (
                    <FadeInView delay={300} style={styles.section}>
                        <Text style={styles.sectionHeader}>SAVED ADDRESSES</Text>
                        {user.profile.saved_addresses.map((addr, i) => (
                            <Card key={i} style={styles.addressCard}>
                                <View style={styles.addressTop}>
                                    <Text style={styles.addressTag}>{addr.tag?.toUpperCase() || 'HOME'}</Text>
                                    <Text style={styles.addressPin}>📍</Text>
                                </View>
                                <Text style={styles.addressText} numberOfLines={2}>{addr.address}</Text>
                            </Card>
                        ))}
                    </FadeInView>
                )}

                {/* Settings */}
                <FadeInView delay={450} style={styles.section}>
                    <Text style={styles.sectionHeader}>PREFERENCES</Text>
                    <PressableAnimated style={styles.settingCard} onPress={() => setIsLangModalOpen(true)}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>{t('language')}</Text>
                            <Text style={styles.settingValue}>{currentLangObj.flag}  {currentLangObj.nativeLabel}</Text>
                        </View>
                        <Text style={styles.chevron}>›</Text>
                    </PressableAnimated>
                </FadeInView>

                {/* Actions */}
                <FadeInView delay={600} style={styles.footer}>
                    <PremiumButton
                        title={t('logout')}
                        variant="danger"
                        onPress={() => {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                            logout();
                        }}
                    />
                    <Text style={styles.versionTxt}>Zarva v2.4.0 • Ultra Premium</Text>
                </FadeInView>

            </View>

            <Modal
                visible={isLangModalOpen}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setIsLangModalOpen(false)}
            >
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
                            selectionColor={colors.accent.primary}
                        />
                    </View>

                    <FlatList
                        data={filteredLangs}
                        keyExtractor={item => item.code}
                        contentContainerStyle={styles.listContent}
                        renderItem={({ item }) => {
                            const isSelected = language === item.code;
                            return (
                                <PressableAnimated
                                    style={[styles.langCard, isSelected && styles.langCardSelected]}
                                    onPress={() => handleSelectLanguage(item.code)}
                                >
                                    <Text style={styles.langFlag}>{item.flag}</Text>
                                    <View style={styles.langTextContainer}>
                                        <Text style={[styles.langNative, isSelected && styles.langNativeActive]}>{item.nativeLabel}</Text>
                                        <Text style={styles.langTranslated}>{item.label} • {item.region}</Text>
                                    </View>
                                    {isSelected && (
                                        <View style={styles.checkedCircle}>
                                            <Text style={styles.checkMark}>✓</Text>
                                        </View>
                                    )}
                                </PressableAnimated>
                            );
                        }}
                    />
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingHorizontal: spacing[24], paddingTop: 80, gap: spacing[32] },

    header: { alignItems: 'center', gap: 8 },
    avatarPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.accent.primary + '11',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.accent.border + '44',
        marginBottom: 8
    },
    avatarTxt: { color: colors.accent.primary, fontSize: 32, fontWeight: '900' },
    title: { color: colors.text.primary, fontSize: fontSize.hero, fontWeight: fontWeight.bold, letterSpacing: tracking.hero },
    phone: { color: colors.text.secondary, fontSize: fontSize.body, letterSpacing: 1 },

    metricsContainer: {
        flexDirection: 'row',
        padding: spacing[24],
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.accent.border + '11'
    },
    metric: { alignItems: 'center', flex: 1 },
    divider: { width: 1, height: '50%', backgroundColor: colors.accent.border + '22', alignSelf: 'center' },
    metricValue: { color: colors.accent.primary, fontSize: 24, fontWeight: '900' },
    metricLabel: { color: colors.text.muted, fontSize: 8, marginTop: 4, fontWeight: fontWeight.bold, letterSpacing: 1.5 },

    section: { gap: spacing[16] },
    sectionHeader: { color: colors.accent.primary, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 2, marginLeft: 4 },

    addressCard: {
        padding: spacing[20],
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surface,
        gap: 8
    },
    addressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    addressTag: { color: colors.text.primary, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 1 },
    addressPin: { fontSize: 12 },
    addressText: { color: colors.text.secondary, fontSize: fontSize.caption, lineHeight: 18 },

    settingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.surface,
        padding: spacing[20],
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.accent.border + '11',
        ...shadows.premium
    },
    settingInfo: { gap: 4 },
    settingLabel: { color: colors.text.muted, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 1 },
    settingValue: { color: colors.text.primary, fontSize: fontSize.body, fontWeight: fontWeight.semibold },
    chevron: { color: colors.accent.primary, fontSize: 24, fontWeight: '200' },

    footer: { marginTop: spacing[16], gap: spacing[24], alignItems: 'center' },
    versionTxt: { color: colors.text.muted, fontSize: 8, fontWeight: fontWeight.medium, letterSpacing: 1 },

    // Modal
    modalScreen: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing[24], marginBottom: spacing[24] },
    modalTitle: { color: colors.text.primary, fontSize: fontSize.title, fontWeight: fontWeight.bold },
    closeBtn: { color: colors.accent.primary, fontSize: fontSize.body, fontWeight: fontWeight.bold },

    searchContainer: {
        marginHorizontal: spacing[24],
        marginBottom: spacing[24],
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        paddingHorizontal: spacing[16],
        borderWidth: 1,
        borderColor: colors.accent.border + '11'
    },
    searchInput: { color: colors.text.primary, fontSize: fontSize.body, paddingVertical: spacing[16] },

    listContent: { paddingHorizontal: spacing[24], paddingBottom: 60, gap: spacing[12] },
    langCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        padding: spacing[20],
        borderWidth: 1,
        borderColor: colors.surface
    },
    langCardSelected: { borderColor: colors.accent.primary, backgroundColor: colors.accent.primary + '05' },
    langFlag: { fontSize: 32, marginRight: spacing[16] },
    langTextContainer: { flex: 1 },
    langNative: { color: colors.text.secondary, fontSize: fontSize.body, fontWeight: fontWeight.bold },
    langNativeActive: { color: colors.text.primary },
    langTranslated: { color: colors.text.muted, fontSize: fontSize.micro, marginTop: 2 },
    checkedCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent.primary, justifyContent: 'center', alignItems: 'center' },
    checkMark: { color: '#FFF', fontWeight: '900', fontSize: 12 }
});
