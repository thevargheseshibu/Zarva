import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, ScrollView, Alert, Modal, FlatList, TextInput } from 'react-native';
import { colors, spacing, radius } from '../../design-system/tokens';
import { useAuthStore } from '../../stores/authStore';
import { useWorkerStore } from '../../stores/workerStore';
import apiClient from '../../services/api/client';
import MapPickerModal from '../../components/MapPickerModal';
import { useLanguageStore } from '../../i18n';
import { SUPPORTED_LANGUAGES } from '../../i18n/languages';
import { useT } from '../../hooks/useT';

export default function WorkerProfileScreen({ navigation }) {
    const { user, logout, setUser } = useAuthStore();
    const { isOnline, setOnline, locationOverride, setLocationOverride } = useWorkerStore();

    const { language, loadLanguage } = useLanguageStore();
    const t = useT();

    const [isLangModalOpen, setIsLangModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [skills, setSkills] = useState(user?.profile?.skills || []);
    const [serviceRange, setServiceRange] = useState(user?.profile?.service_range || 20);

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
                const loc = await Location.getCurrentPositionAsync({});
                const [addressArr] = await Location.reverseGeocodeAsync({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude
                });
                let addressText = 'Unknown Location';
                if (addressArr) {
                    addressText = [addressArr.name, addressArr.city || addressArr.subregion].filter(Boolean).join(', ');
                }
                setLocation({ address: addressText, lat: loc.coords.latitude, lng: loc.coords.longitude });
            }
        })();
    }, []);

    useEffect(() => {
        apiClient.get('/api/jobs/config').then(res => {
            if (res.data?.categories) {
                setAvailableSkills(res.data.categories);
            }
        }).catch(console.error);
    }, []);

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

        // Wait for dynamic translations to load before updating user ref
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

    const handleAddSkill = async (skillKey) => {
        if (skills.includes(skillKey)) return;
        const updated = [...skills, skillKey];
        setSkills(updated);
        setIsSkillsModalOpen(false);

        try {
            await apiClient.put('/api/worker/onboard/profile', { skills: updated });
            // Ideally we'd also update the global user store profile object to reflect locally
            setUser({ ...user, profile: { ...user.profile, skills: updated } });
        } catch (e) {
            console.error('Failed to sync skills', e);
            Alert.alert('Error', 'Failed to update skills');
            setSkills(skills); // rollback
        }
    };

    const handleRemoveSkill = async (skillKey) => {
        const updated = skills.filter(s => s !== skillKey);
        setSkills(updated);

        try {
            await apiClient.put('/api/worker/onboard/profile', { skills: updated });
            setUser({ ...user, profile: { ...user.profile, skills: updated } });
        } catch (e) {
            console.error('Failed to remove skill', e);
            setSkills(skills); // rollback
        }
    };

    const handleUpdateRange = async () => {
        const num = parseInt(serviceRange, 10);
        if (isNaN(num) || num < 1 || num > 500) {
            Alert.alert('Invalid Range', 'Please enter a distance between 1 and 500 km.');
            return;
        }

        try {
            await apiClient.put('/api/worker/onboard/profile', { service_range: num });
            setUser({ ...user, profile: { ...user.profile, service_range: num } });
            Alert.alert('Success', 'Service radius updated.');
        } catch (e) {
            console.error('Failed to sync range', e);
            Alert.alert('Error', 'Failed to update service radius.');
        }
    };

    const handleToggleOnline = async (val) => {
        setOnline(val); // optimistic update
        try {
            await apiClient.put('/api/worker/availability', { is_online: val });
        } catch (e) {
            console.error('Failed to sync online status', e);
            setOnline(!val); // rollback
            Alert.alert('Error', 'Failed to update online status.');
        }
    };

    // Filter available skills that are NOT already added
    const availableSkillsList = Object.entries(availableSkills).filter(([k]) => !skills.includes(k));

    return (
        <ScrollView contentContainerStyle={styles.screen}>
            <Text style={styles.title}>{t('profile_title')}</Text>
            <Text style={styles.phone}>{user?.name || user?.phone || 'Worker'}</Text>

            <View style={styles.metricsBox}>
                <Text style={styles.metric}>Subscription: <Text style={{ color: colors.gold.primary }}>{user?.profile?.subscription_status || 'Free'}</Text></Text>
                <Text style={styles.metric}>Jobs: <Text style={{ color: colors.gold.primary }}>{user?.profile?.total_jobs || user?.profile?.worker_total_jobs || 0}</Text></Text>
                <Text style={styles.metric}>Rating: <Text style={{ color: colors.gold.primary }}>⭐ {Number(user?.profile?.average_rating || 0).toFixed(1)}</Text></Text>
            </View>

            <View style={styles.onlineRow}>
                <Text style={styles.onlineLabel}>
                    {isOnline ? '🟢 Online' : '🔴 Offline'}
                </Text>
                <Switch
                    value={isOnline}
                    onValueChange={handleToggleOnline}
                    thumbColor={isOnline ? colors.gold.primary : colors.text.muted}
                    trackColor={{ false: colors.bg.surface, true: colors.gold.glow }}
                />
            </View>

            <TouchableOpacity style={styles.onlineRow} onPress={() => setIsMapVisible(true)}>
                <Text style={styles.onlineLabel}>📍 Active Location</Text>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={{ color: colors.text.secondary, fontSize: 13 }} numberOfLines={1}>{location.address}</Text>
                </View>
                <Text style={[styles.chevron, { marginLeft: 10 }]}>›</Text>
            </TouchableOpacity>

            <View style={styles.skillsSection}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>My Skills</Text>
                    <TouchableOpacity style={styles.addBtnSmall} onPress={() => setIsSkillsModalOpen(true)}>
                        <Text style={styles.addBtnSmallTxt}>+ Add</Text>
                    </TouchableOpacity>
                </View>
                {skills.length === 0 ? (
                    <Text style={{ color: colors.text.muted, marginTop: spacing.sm }}>No skills added. Add skills to find jobs.</Text>
                ) : (
                    <View style={styles.chipsContainer}>
                        {skills.map(k => (
                            <View key={k} style={styles.chip}>
                                <Text style={styles.chipTxt}>{availableSkills[k]?.label || k}</Text>
                                <TouchableOpacity onPress={() => handleRemoveSkill(k)} style={{ paddingLeft: 6 }}>
                                    <Text style={{ color: colors.text.muted, fontSize: 16 }}>×</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}
            </View>

            <View style={styles.skillsSection}>
                <Text style={styles.sectionTitle}>Service Radius (km)</Text>
                <Text style={{ color: colors.text.muted, fontSize: 13, marginBottom: spacing.md }}>
                    How far are you willing to travel for jobs?
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <View style={styles.radiusInputWrap}>
                        <TextInput
                            style={styles.radiusInput}
                            value={String(serviceRange)}
                            onChangeText={(text) => setServiceRange(text.replace(/[^0-9]/g, ''))}
                            keyboardType="number-pad"
                            maxLength={3}
                        />
                        <Text style={styles.radiusSuffix}>km</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.saveRadiusBtn, Number(serviceRange) === Number(user?.profile?.service_range) && { opacity: 0.5 }]}
                        onPress={handleUpdateRange}
                        disabled={Number(serviceRange) === Number(user?.profile?.service_range)}
                    >
                        <Text style={styles.saveRadiusTxt}>Save</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <TouchableOpacity style={styles.langRow} onPress={() => setIsLangModalOpen(true)}>
                <View>
                    <Text style={styles.langLabel}>{t('language')}</Text>
                    <Text style={styles.langValue}>{currentLangObj.flag}  {currentLangObj.nativeLabel}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('AlertPreferences')}>
                <Text style={styles.settingsTxt}>🔔 Alert Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logout} onPress={logout}>
                <Text style={styles.logoutText}>{t('logout')}</Text>
            </TouchableOpacity>

            {/* Language Selection Modal */}
            <Modal visible={isLangModalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsLangModalOpen(false)}>
                <View style={styles.modalScreen}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{t('choose_language_title')}</Text>
                        <TouchableOpacity onPress={() => setIsLangModalOpen(false)}>
                            <Text style={styles.closeBtn}>{t('done')}</Text>
                        </TouchableOpacity>
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

            {/* Skills Selection Modal */}
            <Modal visible={isSkillsModalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsSkillsModalOpen(false)}>
                <View style={styles.modalScreen}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Available Skills</Text>
                        <TouchableOpacity onPress={() => setIsSkillsModalOpen(false)}>
                            <Text style={styles.closeBtn}>{t('done')}</Text>
                        </TouchableOpacity>
                    </View>
                    <FlatList
                        data={availableSkillsList}
                        keyExtractor={([k]) => k}
                        contentContainerStyle={styles.listContent}
                        renderItem={({ item }) => {
                            const [k, s] = item;
                            return (
                                <TouchableOpacity style={styles.card} onPress={() => handleAddSkill(k)}>
                                    <Text style={styles.flag}>{s.icon || '⚡'}</Text>
                                    <View style={styles.cardText}>
                                        <Text style={styles.langPrimary}>{s.label}</Text>
                                        <Text style={styles.langSub}>{s.description || 'Service Category'}</Text>
                                    </View>
                                    <Text style={{ color: colors.gold.primary, fontWeight: '700' }}>+ Add</Text>
                                </TouchableOpacity>
                            );
                        }}
                        ListEmptyComponent={<Text style={{ color: colors.text.muted, textAlign: 'center', marginTop: 40 }}>No more skills available to add.</Text>}
                    />
                </View>
            </Modal>

            <MapPickerModal
                visible={isMapVisible}
                onClose={() => setIsMapVisible(false)}
                initialLocation={location.lat ? { latitude: location.lat, longitude: location.lng } : null}
                onSelectLocation={async (loc) => {
                    const newLoc = { address: loc.address, lat: loc.latitude, lng: loc.longitude };
                    setLocation(newLoc);
                    setLocationOverride(newLoc);
                    setIsMapVisible(false);
                    try {
                        await apiClient.put('/api/worker/location', { lat: loc.latitude, lng: loc.longitude });
                        Alert.alert('Location Updated', 'Your base location has been updated.');
                    } catch (e) {
                        Alert.alert('Error', 'Failed to update location on server.');
                    }
                }}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    screen: { flexGrow: 1, backgroundColor: colors.bg.primary, padding: spacing.xl, alignItems: 'center', paddingTop: 80 },
    title: { color: colors.text.primary, fontSize: 24, fontWeight: '700' },
    phone: { color: colors.text.secondary, fontSize: 16 },

    metricsBox: { marginTop: spacing.md, backgroundColor: colors.bg.surface, padding: spacing.md, borderRadius: 12, width: '100%', flexDirection: 'row', justifyContent: 'space-evenly' },
    metric: { color: colors.text.primary, fontSize: 13, fontWeight: '600' },

    onlineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
    onlineLabel: { color: colors.text.primary, fontSize: 16 },

    skillsSection: { width: '100%', marginTop: spacing.xl },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    sectionTitle: { color: colors.text.primary, fontSize: 18, fontWeight: '700' },
    addBtnSmall: { backgroundColor: colors.gold.glow, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full },
    addBtnSmallTxt: { color: colors.gold.primary, fontWeight: '700', fontSize: 13 },

    chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.surface, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.gold.primary + '55' },
    chipTxt: { color: colors.gold.primary, fontWeight: '600', marginRight: 4, fontSize: 14 },

    radiusInputWrap: {
        flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.surface,
        borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.gold.primary + '55',
    },
    radiusInput: { flex: 1, color: colors.text.primary, fontSize: 18, fontWeight: '700', paddingVertical: 14 },
    radiusSuffix: { color: colors.text.muted, fontSize: 16, fontWeight: '600' },
    saveRadiusBtn: {
        backgroundColor: colors.gold.primary, paddingVertical: 14, paddingHorizontal: 24, borderRadius: radius.md,
    },
    saveRadiusTxt: { color: colors.bg.primary, fontSize: 16, fontWeight: '700' },

    logout: { marginTop: 40, borderWidth: 1, borderColor: colors.error, borderRadius: 12, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, width: '100%', alignItems: 'center' },
    logoutText: { color: colors.error, fontWeight: '600', fontSize: 16 },
    settingsBtn: { marginTop: 24, backgroundColor: colors.bg.surface, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: 12, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: colors.bg.surface },
    settingsTxt: { color: colors.text.primary, fontSize: 16, fontWeight: '700' },

    langRow: {
        width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: colors.bg.elevated, padding: spacing.lg, borderRadius: 12,
        borderWidth: 1, borderColor: colors.bg.surface, marginTop: spacing.xl
    },
    langLabel: { color: colors.text.muted, fontSize: 13, marginBottom: 4 },
    langValue: { color: colors.text.primary, fontSize: 18, fontWeight: '600' },
    chevron: { color: colors.text.muted, fontSize: 24 },

    modalScreen: { flex: 1, backgroundColor: '#0A0A0F', paddingTop: 60 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
    modalTitle: { color: colors.text.primary, fontSize: 22, fontWeight: '700' },
    closeBtn: { color: colors.gold.primary, fontSize: 16, fontWeight: '600' },
    listContent: { paddingHorizontal: spacing.lg, paddingBottom: 60, gap: spacing.sm },
    card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.bg.elevated, borderRadius: 12, padding: spacing.lg, borderWidth: 1.5, borderColor: 'transparent' },
    cardSelected: { borderColor: colors.gold.primary, backgroundColor: 'rgba(207, 163, 75, 0.1)' },
    flag: { fontSize: 32 },
    cardText: { flex: 1 },
    langPrimary: { color: colors.text.secondary, fontSize: 18, fontWeight: '700' },
    langPrimaryActive: { color: colors.text.primary },
    langSub: { color: colors.text.muted, fontSize: 13, marginTop: 4 },
    checkCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.gold.primary, justifyContent: 'center', alignItems: 'center' },
    check: { color: colors.text.inverse, fontWeight: '700', fontSize: 14 }
});
