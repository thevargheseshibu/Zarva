import React, { useState, useMemo } from 'react';
import { useTokens } from '../../design-system';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, TextInput, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useAuthStore } from '../../stores/authStore';
import { useLanguageStore } from '../../i18n';
import { SUPPORTED_LANGUAGES } from '../../i18n/languages';
import { useT } from '../../hooks/useT';
import apiClient from '../../services/api/client';
import FadeInView from '../../components/FadeInView';
import PremiumButton from '../../components/PremiumButton';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import Card from '../../components/Card';
import { useNavigation } from '@react-navigation/native';


export default function CustomerProfileScreen() {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const navigation = useNavigation();
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
            <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >

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
                            <Text style={styles.metricLabel}>{t('total_caps')}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.metric}>
                            <Text style={styles.metricValue}>{user?.profile?.cancelled_jobs || 0}</Text>
                            <Text style={styles.metricLabel}>{t('failed_caps')}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.metric}>
                            <Text style={styles.metricValue}>{user?.profile?.average_rating ? Number(user.profile.average_rating).toFixed(1) : '5.0'}</Text>
                            <Text style={styles.metricLabel}>{t('rating_caps')}</Text>
                        </View>
                    </Card>
                </FadeInView>

                {/* Saved Addresses */}
                {user?.profile?.saved_addresses && Array.isArray(user.profile.saved_addresses) && user.profile.saved_addresses.length > 0 && (
                    <FadeInView delay={300} style={styles.section}>
                        <Text style={styles.sectionHeader}>{t('saved_addresses_caps')}</Text>
                        {user.profile.saved_addresses.map((addr, i) => (
                            <Card key={i} style={styles.addressCard}>
                                <View style={styles.addressTop}>
                                    <Text style={styles.addressTag}>{addr.tag?.toUpperCase() || t('home_caps')}</Text>
                                    <Text style={styles.addressPin}>📍</Text>
                                </View>
                                <Text style={styles.addressText} numberOfLines={2}>{addr.address}</Text>
                            </Card>
                        ))}
                    </FadeInView>
                )}

                {/* Support */}
                <FadeInView delay={350} style={styles.section}>
                    <Text style={styles.sectionHeader}>{t('support_caps', { defaultValue: 'SUPPORT' })}</Text>
                    <PressableAnimated style={styles.settingCard} onPress={() => navigation.navigate('Support')}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>{t('help_center', { defaultValue: 'Help Center' })}</Text>
                            <Text style={styles.settingValue}>{t('support_disputes', { defaultValue: 'Support & Disputes' })}</Text>
                        </View>
                        <Text style={styles.chevron}>›</Text>
                    </PressableAnimated>
                </FadeInView>

                {/* Settings */}
                <FadeInView delay={450} style={styles.section}>
                    <Text style={styles.sectionHeader}>{t('preferences_caps')}</Text>
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

            </ScrollView>

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
                            placeholderTextColor={tTheme.text.tertiary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoCorrect={false}
                            selectionColor={tTheme.brand.primary}
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

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.app },
    scrollContent: { paddingHorizontal: t.spacing['2xl'], paddingTop: 80, gap: t.spacing[32] },

    header: { alignItems: 'center', gap: 8 },
    avatarPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: t.brand.primary + '11',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: t.border.default + '44',
        marginBottom: 8
    },
    avatarTxt: { color: t.brand.primary, fontSize: 32, fontWeight: '900' },
    title: { color: t.text.primary, fontSize: t.typography.size.hero, fontWeight: t.typography.weight.bold, letterSpacing: t.typography.tracking.hero },
    phone: { color: t.text.secondary, fontSize: t.typography.size.body, letterSpacing: 1 },

    metricsContainer: {
        flexDirection: 'row',
        padding: t.spacing['2xl'],
        backgroundColor: t.background.surface,
        borderWidth: 1,
        borderColor: t.border.default + '11'
    },
    metric: { alignItems: 'center', flex: 1 },
    divider: { width: 1, height: '50%', backgroundColor: t.border.default + '22', alignSelf: 'center' },
    metricValue: { color: t.brand.primary, fontSize: 24, fontWeight: '900' },
    metricLabel: { color: t.text.tertiary, fontSize: 10, marginTop: 4, fontWeight: t.typography.weight.bold, letterSpacing: 1.5 },

    section: { gap: t.spacing.lg },
    sectionHeader: { color: t.brand.primary, fontSize: 9, fontWeight: t.typography.weight.bold, letterSpacing: 2, marginLeft: 4 },

    addressCard: {
        padding: t.spacing[20],
        backgroundColor: t.background.surface,
        borderWidth: 1,
        borderColor: t.background.surface,
        gap: 8
    },
    addressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    addressTag: { color: t.text.primary, fontSize: 9, fontWeight: t.typography.weight.bold, letterSpacing: 1 },
    addressPin: { fontSize: 12 },
    addressText: { color: t.text.secondary, fontSize: t.typography.size.caption, lineHeight: 18 },

    settingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: t.background.surface,
        padding: t.spacing[20],
        borderRadius: t.radius.xl,
        borderWidth: 1,
        borderColor: t.border.default + '11',
        ...t.shadows.premium
    },
    settingInfo: { gap: 4 },
    settingLabel: { color: t.text.tertiary, fontSize: 9, fontWeight: t.typography.weight.bold, letterSpacing: 1 },
    settingValue: { color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.semibold },
    chevron: { color: t.brand.primary, fontSize: 24, fontWeight: '200' },

    footer: { marginTop: t.spacing.lg, gap: t.spacing['2xl'], alignItems: 'center' },
    versionTxt: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.medium, letterSpacing: 1 },

    // Modal
    modalScreen: { flex: 1, backgroundColor: t.background.app, paddingTop: 60 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: t.spacing['2xl'], marginBottom: t.spacing['2xl'] },
    modalTitle: { color: t.text.primary, fontSize: t.typography.size.title, fontWeight: t.typography.weight.bold },
    closeBtn: { color: t.brand.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.bold },

    searchContainer: {
        marginHorizontal: t.spacing['2xl'],
        marginBottom: t.spacing['2xl'],
        backgroundColor: t.background.surface,
        borderRadius: t.radius.lg,
        paddingHorizontal: t.spacing.lg,
        borderWidth: 1,
        borderColor: t.border.default + '11'
    },
    searchInput: { color: t.text.primary, fontSize: t.typography.size.body, paddingVertical: t.spacing.lg },

    listContent: { paddingHorizontal: t.spacing['2xl'], paddingBottom: 120, gap: t.spacing.md },
    langCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: t.background.surface,
        borderRadius: t.radius.xl,
        padding: t.spacing[20],
        borderWidth: 1,
        borderColor: t.background.surface
    },
    langCardSelected: { borderColor: t.brand.primary, backgroundColor: t.brand.primary + '05' },
    langFlag: { fontSize: 32, marginRight: t.spacing.lg },
    langTextContainer: { flex: 1 },
    langNative: { color: t.text.secondary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.bold },
    langNativeActive: { color: t.text.primary },
    langTranslated: { color: t.text.tertiary, fontSize: t.typography.size.micro, marginTop: 2 },
    checkedCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: t.brand.primary, justifyContent: 'center', alignItems: 'center' },
    checkMark: { color: '#FFF', fontWeight: '900', fontSize: 12 }
});
