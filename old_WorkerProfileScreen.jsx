import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, FlatList, Switch, Alert, Image } from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../stores/authStore';
import { useWorkerStore } from '../../stores/workerStore';
import { useLanguageStore } from '../../i18n';
import { SUPPORTED_LANGUAGES } from '../../i18n/languages';
import { useT } from '../../hooks/useT';
import apiClient from '../../services/api/client';
import FadeInView from '../../components/FadeInView';
import PremiumButton from '../../components/PremiumButton';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import Card from '../../components/Card';
import MapPickerModal from '../../components/MapPickerModal';
import MainBackground from '../../components/MainBackground';
import { colors, radius, spacing, shadows } from '../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../design-system/typography';

export default function WorkerProfileScreen({ navigation }) {
    const { user, logout, setUser } = useAuthStore();
    const { isOnline, setOnline, locationOverride, setLocationOverride } = useWorkerStore();
    const { language, loadLanguage } = useLanguageStore();
    const t = useT();

    const [isLangModalOpen, setIsLangModalOpen] = useState(false);
    const [skills, setSkills] = useState(() => {
        const stored = user?.profile?.skills;
        if (Array.isArray(stored)) return stored;
        if (typeof stored === 'string') {
            try { return JSON.parse(stored); } catch (e) { return []; }
        }
        return [];
    });
    const [availableSkills, setAvailableSkills] = useState({});
    const [isSkillsModalOpen, setIsSkillsModalOpen] = useState(false);
    const [isMapVisible, setIsMapVisible] = useState(false);
    const [location, setLocation] = useState(locationOverride || { address: 'Locating...', lat: null, lng: null });

    useEffect(() => {
        (async () => {
            if (locationOverride) {
                setLocation(locationOverride);
                return;
            }
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                try {
                    const loc = await Location.getCurrentPositionAsync({});
                    const [addressArr] = await Location.reverseGeocodeAsync({
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude
                    });
                    let addressText = 'Unknown Location';
                    if (addressArr) {
                        addressText = [addressArr.name, addressArr.city || addressArr.subregion, addressArr.region].filter(Boolean).join(', ');
                    }
                    setLocation({ address: addressText, lat: loc.coords.latitude, lng: loc.coords.longitude });
                } catch (err) {
                    console.warn('Failed to get location in Worker Profile:', err);
                }
            }
        })();
    }, []);

    useEffect(() => {
        apiClient.get('/api/jobs/config').then(res => {
            if (res.data?.categories) setAvailableSkills(res.data.categories);
        }).catch(console.error);
    }, []);

    const currentLangObj = SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0];

    const handleSelectLanguage = async (code) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsLangModalOpen(false);
        await loadLanguage(code);
        if (user) {
            setUser({ ...user, language_preference: code });
            try { await apiClient.post('/api/me/profile', { language_preference: code }); } catch (err) { }
        }
    };

    const handleAddSkill = async (skillKey) => {
        if (skills.includes(skillKey)) return;
        const updated = [...skills, skillKey];
        setSkills(updated);
        setIsSkillsModalOpen(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await apiClient.put('/api/worker/onboard/profile', { skills: updated });
            setUser({ ...user, profile: { ...user.profile, skills: updated } });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
            setSkills(skills);
        }
    };

    const handleRemoveSkill = async (skillKey) => {
        const updated = skills.filter(s => s !== skillKey);
        setSkills(updated);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            await apiClient.put('/api/worker/onboard/profile', { skills: updated });
            setUser({ ...user, profile: { ...user.profile, skills: updated } });
        } catch (e) { setSkills(skills); }
    };

    const handleToggleOnline = async (val) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setOnline(val);
        try {
            await apiClient.put('/api/worker/availability', { is_online: val });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        catch (e) { setOnline(!val); }
    };

    return (
        <MainBackground>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{t('pro_identity')}</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* Profile Hero */}
                <FadeInView delay={50} style={styles.heroSection}>
                    <View style={styles.avatarWrap}>
                        <View style={styles.avatarMain}>
                            <Text style={styles.avatarTxt}>{user?.name?.charAt(0) || 'W'}</Text>
                        </View>
                        <View style={[styles.onlineDot, { backgroundColor: isOnline ? '#BD00FF' : colors.text.muted }]} />
                    </View>
                    <Text style={styles.userName}>{user?.name || 'Professional'}</Text>
                    <Text style={styles.userPhone}>{user?.phone}</Text>

                    <View style={styles.metricsGrid}>
                        <View style={styles.metricItem}>
                            <Text style={styles.metricVal}>Ô¡É {Number(user?.profile?.average_rating || 0).toFixed(1)}</Text>
                            <Text style={styles.metricLbl}>{t('rating')}</Text>
                        </View>
                        <View style={styles.metricDivider} />
                        <View style={styles.metricItem}>
                            <Text style={styles.metricVal}>{user?.profile?.total_jobs || 0}</Text>
                            <Text style={styles.metricLbl}>{t('mission_count')}</Text>
                        </View>
                    </View>
                </FadeInView>

                {/* Operations Section */}
                <FadeInView delay={200} style={styles.section}>
                    <Text style={styles.sectionHeader}>{t('live_operations')}</Text>
                    <Card style={styles.settingsCard}>
                        <View style={styles.settingRow}>
                            <View style={styles.rowIcon}>
                                <Text style={styles.iconTxt}>­ƒôÂ</Text>
                            </View>
                            <View style={styles.rowInfo}>
                                <Text style={styles.rowTitle}>{t('visibility_status')}</Text>
                                <Text style={styles.rowSub}>{isOnline ? t('visibility_online') : t('visibility_offline')}</Text>
                            </View>
                            <Switch
                                value={isOnline}
                                onValueChange={handleToggleOnline}
                                trackColor={{ false: colors.elevated, true: colors.accent.primary }}
                                thumbColor="#FFF"
                            />
                        </View>

                        <View style={styles.innerDivider} />

                        <PressableAnimated style={styles.settingRow} onPress={() => setIsMapVisible(true)}>
                            <View style={styles.rowIcon}>
                                <Text style={styles.iconTxt}>­ƒôì</Text>
                            </View>
                            <View style={styles.rowInfo}>
                                <Text style={styles.rowTitle}>{t('operational_center')}</Text>
                                <Text style={styles.rowSub} numberOfLines={1}>{location.address}</Text>
                            </View>
                            <Text style={styles.rowChevron}>ÔÇ║</Text>
                        </PressableAnimated>
                    </Card>
                </FadeInView>

                {/* Skills Section */}
                <FadeInView delay={300} style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeader}>{t('professional_skills')}</Text>
                        <TouchableOpacity onPress={() => setIsSkillsModalOpen(true)}>
                            <Text style={styles.headerAction}>{t('add_skill')}</Text>
                        </TouchableOpacity>
                    </View>
                    <Card style={styles.skillsCard}>
                        <View style={styles.skillsBox}>
                            {skills.length === 0 ? (
                                <Text style={styles.emptySkills}>{t('no_skills_registered')}</Text>
                            ) : (
                                skills.map((k, index) => {
                                    const skillKey = typeof k === 'object' ? (k.id || JSON.stringify(k)) : k;
                                    let skillLabel = availableSkills[skillKey]?.label || skillKey;
                                    // Extreme safety: never render an object inside <Text>
                                    if (typeof skillLabel === 'object') {
                                        skillLabel = skillLabel.label || skillLabel.id || JSON.stringify(skillLabel);
                                    }

                                    return (
                                        <View key={index} style={styles.skillPill}>
                                            <Text style={styles.skillLabel}>{skillLabel}</Text>
                                            <TouchableOpacity onPress={() => handleRemoveSkill(skillKey)} style={styles.skillClose}>
                                                <Text style={styles.closeIcon}>├ù</Text>
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })
                            )}
                        </View>
                    </Card>
                </FadeInView>

                {/* Preferences Section */}
                <FadeInView delay={400} style={styles.section}>
                    <Text style={styles.sectionHeader}>{t('system_preferences')}</Text>
                    <Card style={styles.settingsCard}>
                        <PressableAnimated style={styles.settingRow} onPress={() => setIsLangModalOpen(true)}>
                            <View style={styles.rowIcon}>
                                <Text style={styles.iconTxt}>­ƒîÉ</Text>
                            </View>
                            <View style={styles.rowInfo}>
                                <Text style={styles.rowTitle}>{t('display_language')}</Text>
                                <Text style={styles.rowSub}>{currentLangObj.flag} {currentLangObj.nativeLabel}</Text>
                            </View>
                            <Text style={styles.rowChevron}>ÔÇ║</Text>
                        </PressableAnimated>

                        <View style={styles.innerDivider} />

                        <PressableAnimated style={styles.settingRow} onPress={() => navigation.navigate('AlertPreferences')}>
                            <View style={styles.rowIcon}>
                                <Text style={styles.iconTxt}>­ƒöö</Text>
                            </View>
                            <View style={styles.rowInfo}>
                                <Text style={styles.rowTitle}>{t('mission_notifications')}</Text>
                                <Text style={styles.rowSub}>{t('mission_notifications_desc')}</Text>
                            </View>
                            <Text style={styles.rowChevron}>ÔÇ║</Text>
                        </PressableAnimated>

                        <View style={styles.innerDivider} />

                        <PressableAnimated style={styles.settingRow} onPress={() => navigation.navigate('Support')}>
                            <View style={styles.rowIcon}>
                                <Text style={styles.iconTxt}>­ƒÆ¼</Text>
                            </View>
                            <View style={styles.rowInfo}>
                                <Text style={styles.rowTitle}>{t('help_center', { defaultValue: 'Help Center' })}</Text>
                                <Text style={styles.rowSub}>{t('support_disputes', { defaultValue: 'Support & Disputes' })}</Text>
                            </View>
                            <Text style={styles.rowChevron}>ÔÇ║</Text>
                        </PressableAnimated>
                    </Card>
                </FadeInView>

                {/* Footer Actions */}
                <FadeInView delay={500} style={styles.authFooter}>
                    <PremiumButton variant="ghost" title={t('logout')} onPress={logout} />
                    <Text style={styles.appMetadata}>ZARVA PRO PROTOCOL ÔÇó v2.8.4</Text>
                </FadeInView>

            </ScrollView>

            {/* Language Modal */}
            <Modal visible={isLangModalOpen} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modernModal}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('localization')}</Text>
                            <TouchableOpacity onPress={() => setIsLangModalOpen(false)}>
                                <Text style={styles.modalClose}>{t('dismiss')}</Text>
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={SUPPORTED_LANGUAGES}
                            keyExtractor={i => i.code}
                            renderItem={({ item }) => {
                                const active = language === item.code;
                                return (
                                    <TouchableOpacity style={[styles.langItem, active && styles.langItemActive]} onPress={() => handleSelectLanguage(item.code)}>
                                        <Text style={styles.langFlag}>{item.flag}</Text>
                                        <Text style={[styles.langText, active && styles.langTextActive]}>{item.nativeLabel}</Text>
                                        {active && <View style={styles.activeIndicator} />}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                </View>
            </Modal>

            {/* Skills Selection Modal */}
            <Modal visible={isSkillsModalOpen} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modernModal}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('acquire_skill')}</Text>
                            <TouchableOpacity onPress={() => setIsSkillsModalOpen(false)}>
                                <Text style={styles.modalClose}>{t('dismiss')}</Text>
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={Object.entries(availableSkills).filter(([k]) => !skills.includes(k))}
                            keyExtractor={([k]) => k}
                            renderItem={({ item: [key, val] }) => (
                                <TouchableOpacity style={styles.skillPick} onPress={() => handleAddSkill(key)}>
                                    <Text style={styles.skillPickTxt}>{val.label}</Text>
                                    <Text style={styles.skillAddIcon}>+</Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>

            <MapPickerModal
                visible={isMapVisible}
                onClose={() => setIsMapVisible(false)}
                onSelectLocation={(loc) => {
                    const newLoc = { address: loc.address, lat: loc.latitude, lng: loc.longitude };
                    setLocation(newLoc);
                    setLocationOverride(newLoc);
                    setIsMapVisible(false);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }}
            />
        </MainBackground>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    header: {
        paddingTop: 60,
        paddingHorizontal: spacing[24],
        paddingBottom: spacing[16]
    },
    headerTitle: { color: colors.accent.primary, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 4 },

    scrollContent: { padding: spacing[24], paddingBottom: 120, gap: spacing[40] },

    heroSection: { alignItems: 'center' },
    avatarWrap: { position: 'relative', marginBottom: 20 },
    avatarMain: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.accent.border + '22',
        ...shadows.premium
    },
    avatarTxt: { color: colors.accent.primary, fontSize: 40, fontWeight: '900' },
    onlineDot: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 3,
        borderColor: colors.background
    },
    userName: { color: colors.text.primary, fontSize: 24, fontWeight: '900', letterSpacing: tracking.title },
    userPhone: { color: colors.text.muted, fontSize: 12, fontWeight: fontWeight.medium, marginTop: 4 },

    metricsGrid: { flexDirection: 'row', alignItems: 'center', marginTop: 32, gap: 32 },
    metricItem: { alignItems: 'center', gap: 4 },
    metricVal: { color: colors.text.primary, fontSize: 18, fontWeight: fontWeight.bold },
    metricLbl: { color: colors.accent.primary, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1 },
    metricDivider: { width: 1, height: 32, backgroundColor: colors.surface },

    section: { gap: 16 },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sectionHeader: { color: colors.accent.primary, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 2 },
    headerAction: { color: colors.text.primary, fontSize: 9, fontWeight: fontWeight.bold },

    settingsCard: { padding: 4, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surface },
    settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
    rowIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.elevated, justifyContent: 'center', alignItems: 'center' },
    iconTxt: { fontSize: 16 },
    rowInfo: { flex: 1, gap: 2 },
    rowTitle: { color: colors.text.primary, fontSize: fontSize.caption, fontWeight: fontWeight.bold },
    rowSub: { color: colors.text.muted, fontSize: 10, fontWeight: fontWeight.medium },
    rowChevron: { color: colors.text.muted, fontSize: 20 },
    innerDivider: { height: 1, backgroundColor: colors.elevated, marginHorizontal: 16, opacity: 0.5 },

    skillsCard: { padding: 20, backgroundColor: colors.surface, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.surface },
    skillsBox: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    skillPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.accent.primary + '11',
        paddingLeft: 12,
        paddingRight: 6,
        paddingVertical: 8,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.accent.primary + '22'
    },
    skillLabel: { color: colors.accent.primary, fontSize: 9, fontWeight: fontWeight.bold },
    skillClose: { marginLeft: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent.primary + '22', justifyContent: 'center', alignItems: 'center' },
    closeIcon: { color: colors.accent.primary, fontSize: 14, fontWeight: 'bold' },
    emptySkills: { color: colors.text.muted, fontSize: 10, fontStyle: 'italic', textAlign: 'center', width: '100%' },

    authFooter: { alignItems: 'center', gap: 16, paddingVertical: 20 },
    appMetadata: { color: colors.text.muted, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 2 },

    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 24 },
    modernModal: { backgroundColor: colors.surface, borderRadius: radius.xxl, padding: 24, maxHeight: '70%', borderWidth: 1, borderColor: colors.accent.border + '11' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { color: colors.text.primary, fontSize: 18, fontWeight: '900' },
    modalClose: { color: colors.accent.primary, fontSize: 9, fontWeight: fontWeight.bold },

    langItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.elevated, gap: 16 },
    langItemActive: { backgroundColor: colors.accent.primary + '08', borderRadius: radius.lg, paddingHorizontal: 12, marginLeft: -12, width: '107%' },
    langFlag: { fontSize: 24 },
    langText: { flex: 1, color: colors.text.secondary, fontSize: 16, fontWeight: fontWeight.medium },
    langTextActive: { color: colors.text.primary, fontWeight: fontWeight.bold },
    activeIndicator: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent.primary },

    skillPick: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.elevated },
    skillPickTxt: { color: colors.text.primary, fontSize: 15, fontWeight: fontWeight.medium },
    skillAddIcon: { color: colors.accent.primary, fontSize: 20, fontWeight: '900' }
});
