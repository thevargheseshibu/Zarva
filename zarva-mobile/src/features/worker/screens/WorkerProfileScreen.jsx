import React, { useState, useEffect } from 'react';
import { useTokens, useTheme } from '../../design-system';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, FlatList, Switch, Alert, Image, RefreshControl } from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@auth/store';
import { useWorkerStore } from '@worker/store';
import { useLanguageStore } from '../../i18n';
import { SUPPORTED_LANGUAGES } from '../../i18n/languages';
import { useT } from '../../hooks/useT';
import apiClient from '@infra/api/client';
import FadeInView from '../../components/FadeInView';
import PremiumButton from '../../components/PremiumButton';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import Card from '../../components/Card';
import MapPickerModal from '../../components/MapPickerModal';
import MainBackground from '../../components/MainBackground';

export default function WorkerProfileScreen({ navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const { user, logout, setUser } = useAuthStore();
    const { language, loadLanguage } = useLanguageStore();
    const isOnline = useWorkerStore(state => state.isOnline);
    const setOnline = useWorkerStore(state => state.setOnline);
    const locationOverride = useWorkerStore(state => state.locationOverride);
    const setLocationOverride = useWorkerStore(state => state.setLocationOverride);
    const t = useT();

    const [refreshing, setRefreshing] = useState(false);
    const [isLangModalOpen, setIsLangModalOpen] = useState(false);
    const [isSkillsModalOpen, setIsSkillsModalOpen] = useState(false);
    const [isMapVisible, setIsMapVisible] = useState(false);
    const [location, setLocation] = useState(locationOverride || { address: 'Locating...', lat: null, lng: null });

    const [workerStats, setWorkerStats] = useState({
        today: 0,
        week: 0,
        rating: 5.0
    });

    const [skills, setSkills] = useState(user?.profile?.skills || []);
    const [availableSkills, setAvailableSkills] = useState({});

    useEffect(() => {
        fetchProfileData();
        fetchAvailableSkills();
    }, []);

    useEffect(() => {
        (async () => {
            if (locationOverride) {
                setLocation(locationOverride);
                return;
            }
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    const [addressArr] = await Location.reverseGeocodeAsync({
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude
                    });
                    let addressText = 'Unknown Location';
                    if (addressArr) {
                        addressText = [addressArr.name, addressArr.city || addressArr.subregion, addressArr.region].filter(Boolean).join(', ');
                    }
                    setLocation({ address: addressText, lat: loc.coords.latitude, lng: loc.coords.longitude });
                }
            } catch (err) {
                console.warn('Failed to get location in Worker Profile:', err);
            }
        })();
    }, [locationOverride]);

    const fetchProfileData = async () => {
        try {
            const res = await apiClient.get('/api/me');
            if (res.data?.user?.profile) {
                const p = res.data.user.profile;
                setWorkerStats({
                    today: p.jobs_today || 0,
                    week: p.jobs_week || 0,
                    rating: Number(p.average_rating || 5.0)
                });
                setSkills(p.skills || []);
            }
        } catch (err) {
            console.error('Failed to fetch profile stats', err);
        } finally {
            setRefreshing(false);
        }
    };

    const fetchAvailableSkills = async () => {
        try {
            const res = await apiClient.get('/api/worker/skills');
            setAvailableSkills(res.data?.skills || {});
        } catch (err) {
            console.error('Failed to fetch skills', err);
        }
    };

    const handleSelectLanguage = async (code) => {
        Haptics.selectionAsync();
        setIsLangModalOpen(false);
        await loadLanguage(code);
        if (user) {
            try {
                await apiClient.post('/api/me/profile', { language_preference: code });
            } catch (err) { }
        }
    };

    const handleAddSkill = async (skillKey) => {
        const newSkills = [...skills, skillKey];
        setSkills(newSkills);
        setIsSkillsModalOpen(false);
        try {
            await apiClient.post('/api/worker/onboarding/skills', { skills: newSkills });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            Alert.alert('Error', 'Failed to update skills');
        }
    };

    const handleRemoveSkill = async (skillKey) => {
        const newSkills = skills.filter(s => s !== skillKey);
        setSkills(newSkills);
        try {
            await apiClient.post('/api/worker/onboarding/skills', { skills: newSkills });
        } catch (err) { }
    };

    const handleToggleOnline = async (val) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setOnline(val);
        try {
            await apiClient.put('/api/worker/availability', { is_online: val });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
            setOnline(!val);
            Alert.alert('Error', 'Failed to update visibility status.');
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchProfileData();
    };

    return (
        <MainBackground>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{t('profile_caps')}</Text>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tTheme.brand.primary} />}
            >
                <FadeInView delay={100} style={styles.heroSection}>
                    <View style={styles.avatarWrap}>
                        <View style={styles.avatarMain}>
                            <Image
                                source={{ uri: user?.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'W')}&background=101014&color=BD00FF` }}
                                style={{ width: 100, height: 100, borderRadius: 50 }}
                            />
                        </View>
                        <View style={[styles.onlineDot, { backgroundColor: isOnline ? tTheme.status.success.base : tTheme.text.tertiary }]} />
                    </View>
                    <Text style={styles.userName}>{user?.name || t('professional')}</Text>
                    <Text style={styles.userPhone}>{user?.phone}</Text>

                    <View style={styles.metricsGrid}>
                        <View style={styles.metricItem}>
                            <Text style={styles.metricVal}>{workerStats.today}</Text>
                            <Text style={styles.metricLbl}>{t('today')}</Text>
                        </View>
                        <View style={styles.metricDivider} />
                        <View style={styles.metricItem}>
                            <Text style={styles.metricVal}>{workerStats.week}</Text>
                            <Text style={styles.metricLbl}>{t('week')}</Text>
                        </View>
                        <View style={styles.metricDivider} />
                        <View style={styles.metricItem}>
                            <Text style={styles.metricVal}>⭐ {workerStats.rating.toFixed(1)}</Text>
                            <Text style={styles.metricLbl}>{t('rating')}</Text>
                        </View>
                    </View>
                </FadeInView>

                {/* Account Settings */}
                <FadeInView delay={300} style={styles.section}>
                    <Text style={styles.sectionHeader}>{t('account_settings_caps')}</Text>
                    <Card style={styles.settingsCard}>
                        <View style={styles.settingRow}>
                            <View style={styles.rowIcon}><Text style={styles.iconTxt}>🔄</Text></View>
                            <View style={styles.rowInfo}>
                                <Text style={styles.rowTitle}>{t('visibility_status')}</Text>
                                <Text style={styles.rowSub}>{isOnline ? t('online') : t('offline')}</Text>
                            </View>
                            <Switch
                                value={isOnline}
                                onValueChange={handleToggleOnline}
                                trackColor={{ false: tTheme.background.surfaceRaised, true: tTheme.status.success.base }}
                                thumbColor="#FFF"
                            />
                        </View>

                        <View style={styles.innerDivider} />

                        <PressableAnimated style={styles.settingRow} onPress={() => setIsLangModalOpen(true)}>
                            <View style={styles.rowIcon}><Text style={styles.iconTxt}>🌐</Text></View>
                            <View style={styles.rowInfo}>
                                <Text style={styles.rowTitle}>{t('language')}</Text>
                                <Text style={styles.rowSub}>{SUPPORTED_LANGUAGES.find(l => l.code === language)?.nativeLabel || 'English'}</Text>
                            </View>
                            <Text style={styles.rowChevron}>›</Text>
                        </PressableAnimated>

                        <View style={styles.innerDivider} />

                        <PressableAnimated style={styles.settingRow} onPress={() => setIsMapVisible(true)}>
                            <View style={styles.rowIcon}><Text style={styles.iconTxt}>📍</Text></View>
                            <View style={styles.rowInfo}>
                                <Text style={styles.rowTitle}>{t('service_area')}</Text>
                                <Text style={styles.rowSub} numberOfLines={1}>{location.address}</Text>
                            </View>
                            <Text style={styles.rowChevron}>›</Text>
                        </PressableAnimated>

                        <View style={styles.innerDivider} />

                        <PressableAnimated style={styles.settingRow} onPress={() => navigation.navigate('WorkerWallet')}>
                            <View style={styles.rowIcon}>
                                <Text style={styles.iconTxt}>💰</Text>
                            </View>
                            <View style={styles.rowInfo}>
                                <Text style={styles.rowTitle}>{t('wallet')}</Text>
                                <Text style={styles.rowSub}>{t('wallet_subtitle', { defaultValue: 'Balance & Withdrawals' })}</Text>
                            </View>
                            <Text style={styles.rowChevron}>›</Text>
                        </PressableAnimated>

                        <View style={styles.innerDivider} />

                        <PressableAnimated style={styles.settingRow} onPress={() => navigation.navigate('AlertPreferences')}>
                            <View style={styles.rowIcon}>
                                <Text style={styles.iconTxt}>🔔</Text>
                            </View>
                            <View style={styles.rowInfo}>
                                <Text style={styles.rowTitle}>{t('mission_notifications', { defaultValue: 'Alert Preferences' })}</Text>
                                <Text style={styles.rowSub}>Manage job alerts</Text>
                            </View>
                            <Text style={styles.rowChevron}>›</Text>
                        </PressableAnimated>

                        <View style={styles.innerDivider} />

                        <PressableAnimated style={styles.settingRow} onPress={() => navigation.navigate('Support')}>
                            <View style={styles.rowIcon}>
                                <Text style={styles.iconTxt}>💬</Text>
                            </View>
                            <View style={styles.rowInfo}>
                                <Text style={styles.rowTitle}>{t('help_center', { defaultValue: 'Help & Support' })}</Text>
                                <Text style={styles.rowSub}>Contact admin</Text>
                            </View>
                            <Text style={styles.rowChevron}>›</Text>
                        </PressableAnimated>
                    </Card>
                </FadeInView>

                {/* Skills */}
                <FadeInView delay={400} style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeader}>{t('my_skills_caps')}</Text>
                        <TouchableOpacity onPress={() => setIsSkillsModalOpen(true)}>
                            <Text style={styles.headerAction}>+ {t('add')}</Text>
                        </TouchableOpacity>
                    </View>
                    <Card style={styles.skillsCard}>
                        <View style={styles.skillsBox}>
                            {skills.length === 0 ? (
                                <Text style={styles.emptySkills}>{t('no_skills_added')}</Text>
                            ) : (
                                skills.map(sk => (
                                    <View key={sk} style={styles.skillPill}>
                                        <Text style={styles.skillLabel}>
                                            {t(`cat_${sk}`, { defaultValue: availableSkills[sk]?.label || sk })}
                                        </Text>
                                        <TouchableOpacity style={styles.skillClose} onPress={() => handleRemoveSkill(sk)}>
                                            <Text style={styles.closeIcon}>×</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))
                            )}
                        </View>
                    </Card>
                </FadeInView>

                {/* Footer */}
                <FadeInView delay={500} style={styles.authFooter}>
                    <PremiumButton
                        title={t('logout')}
                        variant="danger"
                        onPress={() => {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                            logout();
                        }}
                    />
                    <Text style={styles.appMetadata}>ZARVA PRO • V2.4.0 • KERALA</Text>
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
                                    <Text style={styles.skillPickTxt}>
                                        {t(`cat_${key}`, { defaultValue: val.label })}
                                    </Text>
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
                initialLocation={location?.lat ? { latitude: location.lat, longitude: location.lng } : null}
                onSelectLocation={async (loc) => {
                    const newLoc = { address: loc.address, lat: loc.latitude, lng: loc.longitude };
                    setLocation(newLoc);
                    setLocationOverride(newLoc);
                    setIsMapVisible(false);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    try {
                        await apiClient.put('/api/worker/location', { lat: loc.latitude, lng: loc.longitude });
                    } catch (err) {
                        console.error('Location sync failed:', err);
                        Alert.alert(t('sync_error', { defaultValue: 'Sync Error' }), t('sync_error_location', { defaultValue: 'Failed to update location on server.' }));
                    }
                }}
            />
        </MainBackground>
    );
}

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1 },
    header: {
        paddingTop: 60,
        paddingHorizontal: t.spacing['2xl'],
        paddingBottom: t.spacing.lg
    },
    headerTitle: { color: t.brand.primary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 4 },

    scrollContent: { padding: t.spacing['2xl'], paddingBottom: 120, gap: t.spacing[32] },

    heroSection: { alignItems: 'center' },
    avatarWrap: { position: 'relative', marginBottom: 20 },
    avatarMain: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: t.background.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: t.border.default + '22',
        ...t.shadows.premium
    },
    avatarTxt: { color: t.brand.primary, fontSize: 40, fontWeight: '900' },
    onlineDot: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 3,
        borderColor: t.background.app
    },
    userName: { color: t.text.primary, fontSize: 24, fontWeight: '900', letterSpacing: t.typography.tracking.title },
    userPhone: { color: t.text.tertiary, fontSize: 12, fontWeight: t.typography.weight.medium, marginTop: 4 },

    metricsGrid: { flexDirection: 'row', alignItems: 'center', marginTop: 32, gap: 32 },
    metricItem: { alignItems: 'center', gap: 4 },
    metricVal: { color: t.text.primary, fontSize: 18, fontWeight: t.typography.weight.bold },
    metricLbl: { color: t.brand.primary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1 },
    metricDivider: { width: 1, height: 32, backgroundColor: t.background.surface },

    section: { gap: 16 },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sectionHeader: { color: t.brand.primary, fontSize: 9, fontWeight: t.typography.weight.bold, letterSpacing: 2 },
    headerAction: { color: t.text.primary, fontSize: 9, fontWeight: t.typography.weight.bold },

    settingsCard: { padding: 4, backgroundColor: t.background.surface, borderWidth: 1, borderColor: t.background.surface },
    settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
    rowIcon: { width: 40, height: 40, borderRadius: t.radius.md, backgroundColor: t.background.surfaceRaised, justifyContent: 'center', alignItems: 'center' },
    iconTxt: { fontSize: 16 },
    rowInfo: { flex: 1, gap: 2 },
    rowTitle: { color: t.text.primary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.bold },
    rowSub: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.medium },
    rowChevron: { color: t.text.tertiary, fontSize: 20 },
    innerDivider: { height: 1, backgroundColor: t.background.surfaceRaised, marginHorizontal: 16, opacity: 0.5 },

    skillsCard: { padding: 20, backgroundColor: t.background.surface, borderStyle: 'dashed', borderWidth: 1, borderColor: t.background.surface },
    skillsBox: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    skillPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: t.brand.primary + '11',
        paddingLeft: 12,
        paddingRight: 6,
        paddingVertical: 8,
        borderRadius: t.radius.full,
        borderWidth: 1,
        borderColor: t.brand.primary + '22'
    },
    skillLabel: { color: t.brand.primary, fontSize: 9, fontWeight: t.typography.weight.bold },
    skillClose: { marginLeft: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: t.brand.primary + '22', justifyContent: 'center', alignItems: 'center' },
    closeIcon: { color: t.brand.primary, fontSize: 14, fontWeight: 'bold' },
    emptySkills: { color: t.text.tertiary, fontSize: 10, fontStyle: 'italic', textAlign: 'center', width: '100%' },

    authFooter: { alignItems: 'center', gap: 16, paddingVertical: 20 },
    appMetadata: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 2 },

    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 24 },
    modernModal: { backgroundColor: t.background.surface, borderRadius: t.radius['2xl'], padding: 24, maxHeight: '70%', borderWidth: 1, borderColor: t.border.default + '11' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { color: t.text.primary, fontSize: 18, fontWeight: '900' },
    modalClose: { color: t.brand.primary, fontSize: 9, fontWeight: t.typography.weight.bold },

    langItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: t.background.surfaceRaised, gap: 16 },
    langItemActive: { backgroundColor: t.brand.primary + '08', borderRadius: t.radius.lg, paddingHorizontal: 12, marginLeft: -12, width: '107%' },
    langFlag: { fontSize: 24 },
    langText: { flex: 1, color: t.text.secondary, fontSize: 16, fontWeight: t.typography.weight.medium },
    langTextActive: { color: t.text.primary, fontWeight: t.typography.weight.bold },
    activeIndicator: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.brand.primary },

    skillPick: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: t.background.surfaceRaised },
    skillPickTxt: { color: t.text.primary, fontSize: 15, fontWeight: t.typography.weight.medium },
    skillAddIcon: { color: t.brand.primary, fontSize: 20, fontWeight: '900' }
});
