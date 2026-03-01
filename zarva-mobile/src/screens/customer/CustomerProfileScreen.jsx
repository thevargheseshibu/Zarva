import React, { useState, useMemo, useEffect } from 'react';
import { useTokens } from '../../design-system';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, TextInput, ScrollView, Image, ActivityIndicator, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

import { useAuthStore } from '../../stores/authStore';
import { useLanguageStore } from '../../i18n';
import { SUPPORTED_LANGUAGES } from '../../i18n/languages';
import { useT } from '../../hooks/useT';
import apiClient from '../../services/api/client';
import FadeInView from '../../components/FadeInView';
import PremiumButton from '../../components/PremiumButton';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import Card from '../../components/Card';
import MainBackground from '../../components/MainBackground';
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
    const [activeJob, setActiveJob] = useState(null);

    // Edit Profile State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        name: user?.name || '',
        email: user?.email || '',
        phone: user?.phone || '',
    });
    const [saving, setSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    // Fetch active job to show inspection / start code
    useEffect(() => {
        const fetchActiveJob = async () => {
            try {
                const res = await apiClient.get('/api/jobs?status=active&limit=1');
                const jobs = res.data?.jobs || [];
                // Find any job that's in an OTP-relevant status
                const otpJob = jobs.find(j =>
                    ['worker_arrived', 'estimate_submitted'].includes(j.status)
                );
                setActiveJob(otpJob || null);
            } catch (_) { }
        };
        fetchActiveJob();
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

    const handleSaveProfile = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (!editForm.name.trim()) return Alert.alert('Validation', 'Name cannot be empty.');

        setSaving(true);
        try {
            await apiClient.post('/api/me/profile', {
                name: editForm.name.trim(),
                email: editForm.email.trim(),
                phone: editForm.phone.trim()
            });
            setUser({ ...user, name: editForm.name.trim(), email: editForm.email.trim(), phone: editForm.phone.trim() });
            setIsEditModalOpen(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            Alert.alert('Update Failed', err.response?.data?.message || 'Could not update profile check your connection.');
        } finally {
            setSaving(false);
        }
    };

    const handleImageUpload = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please allow access to your photo library to update Avatar.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.2,
            allowsEditing: true,
            aspect: [1, 1]
        });

        if (result.canceled) return;

        setUploadingAvatar(true);
        const localUri = result.assets[0].uri;

        try {
            const formData = new FormData();
            formData.append('purpose', 'profile_photo');
            formData.append('file', {
                uri: localUri,
                name: `profile_${Date.now()}.jpg`,
                type: 'image/jpeg'
            });

            const uploadRes = await apiClient.post('/api/uploads/image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (uploadRes.data.status !== 'ok') throw new Error('Upload failed');

            const public_url = uploadRes.data.url.split('?')[0];

            // Persist the URL to DB
            await apiClient.post('/api/me/profile', {
                photo: public_url
            });

            setUser({ ...user, photo: public_url });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        } catch (err) {
            Alert.alert('Upload Failed', 'Could not update your avatar. Please try again.');
        } finally {
            setUploadingAvatar(false);
        }
    };

    return (
        <MainBackground>
            <View style={styles.screen}>
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >

                    {/* Premium Header Card */}
                    <FadeInView delay={50}>
                        <Card style={styles.heroCard}>
                            <View style={styles.heroTop}>
                                <TouchableOpacity onPress={handleImageUpload} style={styles.avatarWrapper}>
                                    {user?.photo ? (
                                        <Image source={{ uri: user.photo }} style={styles.avatarImage} />
                                    ) : (
                                        <Text style={styles.avatarTxt}>{user?.name?.charAt(0) || user?.phone?.slice(-1) || 'Z'}</Text>
                                    )}
                                    <View style={styles.cameraBadge}>
                                        <Text style={styles.cameraIcon}>📸</Text>
                                    </View>
                                    {uploadingAvatar && (
                                        <View style={styles.uploadingOverlay}>
                                            <ActivityIndicator color="#FFF" />
                                        </View>
                                    )}
                                </TouchableOpacity>

                                <View style={styles.heroInfo}>
                                    <Text style={styles.title} numberOfLines={1}>{user?.name || t('profile_title') || 'Client'}</Text>
                                    <Text style={styles.phone}>{user?.phone || 'No Phone'}</Text>
                                    {user?.email && <Text style={styles.email} numberOfLines={1}>{user.email}</Text>}
                                </View>
                            </View>

                            <PressableAnimated style={styles.editProfileBtn} onPress={() => setIsEditModalOpen(true)}>
                                <Text style={styles.editProfileTxt}>Edit Profile Details</Text>
                            </PressableAnimated>
                        </Card>
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

                    {/* ── Active Job Inspection / Start Code ── */}
                    {activeJob && (
                        <FadeInView delay={260}>
                            <Card style={[styles.heroCard, {
                                borderColor: activeJob.status === 'worker_arrived'
                                    ? tTheme.brand.primary + '66'
                                    : tTheme.status.success.base + '66',
                                padding: tTheme.spacing['2xl'],
                            }]}>
                                <Text style={[styles.sectionHeader, { marginBottom: 12, marginLeft: 0, color: tTheme.text.tertiary }]}>
                                    {activeJob.status === 'worker_arrived' ? 'INSPECTION CODE' : 'START CODE'}
                                </Text>
                                <Text style={{ color: tTheme.text.secondary, fontSize: 12, marginBottom: 16, lineHeight: 18 }}>
                                    {activeJob.status === 'worker_arrived'
                                        ? 'Share this code with the professional to begin the assessment.'
                                        : 'The pro has submitted an estimate. Share this code to begin work.'}
                                </Text>
                                <View style={styles.otpCodeBox}>
                                    {(activeJob.status === 'worker_arrived'
                                        ? (activeJob.inspection_otp || '----')
                                        : (activeJob.start_otp || '----')
                                    ).toString().split('').map((digit, i) => (
                                        <View key={i} style={styles.otpDigitBox}>
                                            <Text style={styles.otpDigitTxt}>{digit}</Text>
                                        </View>
                                    ))}
                                </View>
                                <TouchableOpacity
                                    style={styles.viewJobBtn}
                                    onPress={() => navigation.navigate('JobStatusDetail', { jobId: activeJob.id })}
                                >
                                    <Text style={styles.viewJobTxt}>View Full Job Details →</Text>
                                </TouchableOpacity>
                            </Card>
                        </FadeInView>
                    )}

                    <FadeInView delay={300} style={styles.section}>
                        <Text style={styles.sectionHeader}>ACCOUNT</Text>

                        {/* Interactive Wallet dummy */}
                        <PressableAnimated style={styles.settingCard} onPress={() => Alert.alert('Wallet', 'Zarva Wallet coming soon.')}>
                            <View style={styles.settingIconBox}>
                                <Text style={styles.settingIcon}>💳</Text>
                            </View>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingValue}>Payment Methods</Text>
                                <Text style={styles.settingLabel}>Manage cards & wallets</Text>
                            </View>
                            <Text style={styles.chevron}>›</Text>
                        </PressableAnimated>

                        {/* Saved Addresses Summary Link */}
                        <PressableAnimated style={styles.settingCard} onPress={() => Alert.alert('Addresses', 'Address management moving here.')}>
                            <View style={[styles.settingIconBox, { backgroundColor: tTheme.status.info.base + '22' }]}>
                                <Text style={styles.settingIcon}>📍</Text>
                            </View>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingValue}>Saved Addresses</Text>
                                <Text style={styles.settingLabel}>{user?.profile?.saved_addresses?.length || 0} locations saved</Text>
                            </View>
                            <Text style={styles.chevron}>›</Text>
                        </PressableAnimated>
                    </FadeInView>

                    {/* Preferences */}
                    <FadeInView delay={450} style={styles.section}>
                        <Text style={styles.sectionHeader}>{t('preferences_caps') || 'PREFERENCES'}</Text>
                        <PressableAnimated style={styles.settingCard} onPress={() => setIsLangModalOpen(true)}>
                            <View style={[styles.settingIconBox, { backgroundColor: '#FF980022' }]}>
                                <Text style={styles.settingIcon}>🌐</Text>
                            </View>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingValue}>{t('language')}</Text>
                                <Text style={styles.settingLabel}>{currentLangObj.flag}  {currentLangObj.nativeLabel}</Text>
                            </View>
                            <Text style={styles.chevron}>›</Text>
                        </PressableAnimated>

                        <PressableAnimated style={styles.settingCard} onPress={() => navigation.navigate('Support')}>
                            <View style={[styles.settingIconBox, { backgroundColor: tTheme.status.error.base + '22' }]}>
                                <Text style={styles.settingIcon}>🎧</Text>
                            </View>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingValue}>{t('support_caps', { defaultValue: 'Support Center' })}</Text>
                                <Text style={styles.settingLabel}>{t('help_center', { defaultValue: 'Help & Disputes' })}</Text>
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
                        <Text style={styles.versionTxt}>Zarva v2.5.0 • Ultra Premium Profile</Text>
                    </FadeInView>

                </ScrollView>

                {/* Edit Profile Modal */}
                <Modal visible={isEditModalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsEditModalOpen(false)}>
                    <View style={styles.modalScreen}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Profile</Text>
                            <TouchableOpacity onPress={() => setIsEditModalOpen(false)}>
                                <Text style={styles.closeBtn}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.formContainer}>
                            <Text style={styles.inputLabel}>Full Name</Text>
                            <TextInput
                                style={styles.textInput}
                                value={editForm.name}
                                onChangeText={(val) => setEditForm(prev => ({ ...prev, name: val }))}
                                placeholder="Your Name"
                                placeholderTextColor={tTheme.text.tertiary}
                            />

                            <Text style={styles.inputLabel}>Email Address</Text>
                            <TextInput
                                style={styles.textInput}
                                value={editForm.email}
                                onChangeText={(val) => setEditForm(prev => ({ ...prev, email: val }))}
                                placeholder="name@example.com"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                placeholderTextColor={tTheme.text.tertiary}
                            />

                            <Text style={styles.inputLabel}>Phone Number</Text>
                            <TextInput
                                style={styles.textInput}
                                value={editForm.phone}
                                onChangeText={(val) => setEditForm(prev => ({ ...prev, phone: val }))}
                                placeholder="+91 XXXXXXXXXX"
                                keyboardType="phone-pad"
                                placeholderTextColor={tTheme.text.tertiary}
                            />

                            <View style={{ marginTop: 24 }}>
                                <PremiumButton title="Save Changes" onPress={handleSaveProfile} loading={saving} disabled={saving} />
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Language Modal */}
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
        </MainBackground>
    );
}

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1 },
    scrollContent: { paddingHorizontal: t.spacing['2xl'], paddingTop: 80, gap: t.spacing['2xl'], paddingBottom: 100 },

    heroCard: {
        backgroundColor: t.background.surface,
        borderRadius: t.radius['2xl'],
        padding: t.spacing['2xl'],
        borderWidth: 1,
        borderColor: t.brand.primary + '33',
        ...t.shadows.premium
    },
    heroTop: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 24 },
    avatarWrapper: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: t.brand.primary + '11',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: t.brand.primary + '55',
        position: 'relative'
    },
    avatarTxt: { color: t.brand.primary, fontSize: 36, fontWeight: '900' },
    avatarImage: { width: 84, height: 84, borderRadius: 42 },
    cameraBadge: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        backgroundColor: t.background.surfaceRaised,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: t.background.surface,
        ...t.shadows.small
    },
    cameraIcon: { fontSize: 14 },
    uploadingOverlay: { position: 'absolute', width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },

    heroInfo: { flex: 1, justifyContent: 'center' },
    title: { color: t.text.primary, fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 },
    phone: { color: t.text.secondary, fontSize: 14, fontWeight: '600', letterSpacing: 1 },
    email: { color: t.text.tertiary, fontSize: 12, marginTop: 4 },

    editProfileBtn: { backgroundColor: t.background.surfaceRaised, paddingVertical: 12, borderRadius: t.radius.lg, alignItems: 'center', borderWidth: 1, borderColor: t.border.default + '22' },
    editProfileTxt: { color: t.brand.primary, fontSize: 13, fontWeight: '800' },

    metricsContainer: { flexDirection: 'row', padding: t.spacing.xl, borderRadius: t.radius.xl, backgroundColor: t.background.surface, borderWidth: 1, borderColor: t.border.default + '11', ...t.shadows.premium },
    metric: { alignItems: 'center', flex: 1 },
    divider: { width: 1, height: '60%', backgroundColor: t.border.default + '22', alignSelf: 'center' },
    metricValue: { color: t.brand.primary, fontSize: 24, fontWeight: '900' },
    metricLabel: { color: t.text.tertiary, fontSize: 10, marginTop: 4, fontWeight: '800', letterSpacing: 1.5 },

    // OTP Code Display
    otpCodeBox: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 20 },
    otpDigitBox: {
        width: 52,
        height: 60,
        borderRadius: t.radius.md,
        backgroundColor: t.background.surfaceRaised,
        borderWidth: 1.5,
        borderColor: t.brand.primary + '44',
        justifyContent: 'center',
        alignItems: 'center',
    },
    otpDigitTxt: { color: t.brand.primary, fontSize: 28, fontWeight: '900', letterSpacing: 2 },
    viewJobBtn: { alignItems: 'center', paddingVertical: 10 },
    viewJobTxt: { color: t.brand.primary, fontSize: 13, fontWeight: '800' },

    section: { gap: t.spacing.md },
    sectionHeader: { color: t.text.tertiary, fontSize: 11, fontWeight: '900', letterSpacing: 2, marginLeft: 8, marginBottom: 4 },

    settingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: t.background.surface,
        padding: t.spacing.lg,
        borderRadius: t.radius.xl,
        borderWidth: 1,
        borderColor: t.border.default + '22',
        ...t.shadows.medium
    },
    settingIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: t.brand.primary + '11', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    settingIcon: { fontSize: 20 },
    settingInfo: { flex: 1, gap: 2 },
    settingValue: { color: t.text.primary, fontSize: 16, fontWeight: '800' },
    settingLabel: { color: t.text.secondary, fontSize: 12, fontWeight: '600' },
    chevron: { color: t.text.tertiary, fontSize: 24, fontWeight: '300', paddingLeft: 12 },

    footer: { marginTop: t.spacing.lg, gap: t.spacing['2xl'], alignItems: 'center' },
    versionTxt: { color: t.text.tertiary, fontSize: 10, fontWeight: '700', letterSpacing: 1 },

    // Modals
    modalScreen: { flex: 1, backgroundColor: t.background.app, paddingTop: 60 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: t.spacing['2xl'], marginBottom: t.spacing['2xl'] },
    modalTitle: { color: t.text.primary, fontSize: 24, fontWeight: '900' },
    closeBtn: { color: t.brand.primary, fontSize: 16, fontWeight: '800' },

    formContainer: { paddingHorizontal: t.spacing['2xl'] },
    inputLabel: { color: t.text.secondary, fontSize: 12, fontWeight: '800', marginTop: 16, marginBottom: 8, letterSpacing: 0.5 },
    textInput: { backgroundColor: t.background.surface, color: t.text.primary, padding: 16, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.border.default, fontSize: 16 },

    searchContainer: { marginHorizontal: t.spacing['2xl'], marginBottom: t.spacing['2xl'], backgroundColor: t.background.surface, borderRadius: t.radius.lg, paddingHorizontal: t.spacing.lg, borderWidth: 1, borderColor: t.border.default + '22' },
    searchInput: { color: t.text.primary, fontSize: 16, paddingVertical: 16 },

    listContent: { paddingHorizontal: t.spacing['2xl'], paddingBottom: 120, gap: t.spacing.md },
    langCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.background.surface, borderRadius: t.radius.xl, padding: t.spacing[20], borderWidth: 1, borderColor: t.background.surface },
    langCardSelected: { borderColor: t.brand.primary, backgroundColor: t.brand.primary + '05' },
    langFlag: { fontSize: 32, marginRight: t.spacing.lg },
    langTextContainer: { flex: 1 },
    langNative: { color: t.text.secondary, fontSize: 16, fontWeight: '800' },
    langNativeActive: { color: t.text.primary },
    langTranslated: { color: t.text.tertiary, fontSize: 12, marginTop: 4 },
    checkedCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: t.brand.primary, justifyContent: 'center', alignItems: 'center' },
    checkMark: { color: '#FFF', fontWeight: '900', fontSize: 12 }
});
