import React, { useState } from 'react';
import { useTokens } from '../@shared/design-system';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';


import PremiumButton from '@shared/ui/PremiumButton';
import apiClient, { uploadFileRaw } from '@infra/api/client';
import FadeInView from '@shared/ui/FadeInView';
import Card from '@shared/ui/ZCard';
import PressableAnimated from '../@shared/design-system/components/PressableAnimated';
import { useT } from '../@shared/i18n/useTranslation';
import { useUIStore } from '@shared/hooks/uiStore';
import MainBackground from '@shared/ui/MainBackground';

async function uploadImage(uri, docKey) {
    // Use uploadFileRaw (expo-file-system based) for consistent cross-platform upload.
    // This avoids known Android issues with FormData + Axios blob serialization.
    const s3Key = await uploadFileRaw('/api/uploads/image', uri, 'worker_doc');
    return s3Key;
}

export default function OnboardingDocuments({ data, onNext }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();

    const DOCS = [
        { key: 'aadhaar_front', label: t('aadhaar_front'), icon: '🪪' },
        { key: 'aadhaar_back', label: t('aadhaar_back'), icon: '🪪' },
        { key: 'selfie', label: t('selfie_eportrait'), icon: '🤳' },
    ];

    const [uploads, setUploads] = useState(data.documents || {});
    const [aadhaarNumber, setAadhaarNumber] = useState(data.aadhaar_number || '');
    const [globalLoading, setGlobalLoading] = useState(false);
    const [loadingKey, setLoadingKey] = useState(null);
    const [errors, setErrors] = useState({});

    const isValidAadhaar = /^\d{12}$/.test(aadhaarNumber);

    const pickImage = async (docKey) => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(t('permission_needed'), t('allow_photo_access'));
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await new Promise(resolve => setTimeout(resolve, 100));

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.2, // Reduced quality for faster upload and memory conservation
            allowsEditing: false,
        });

        if (result.canceled) return;

        const uri = result.assets[0].uri;

        const { showLoader, hideLoader } = useUIStore.getState();
        showLoader(t('uploading_documents') || "Uploading Securely...");
        setLoadingKey(docKey);
        setErrors(e => ({ ...e, [docKey]: false }));

        try {
            const url = await uploadImage(uri, docKey);
            setUploads(u => ({ ...u, [docKey]: url }));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
            console.error("Upload error:", e);
            setUploads(u => ({ ...u, [docKey]: uri }));
            setErrors(e => ({ ...e, [docKey]: true }));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            hideLoader();
            setLoadingKey(null);
        }
    };

    const retryUpload = async (docKey) => {
        const uri = uploads[docKey];
        if (!uri) return;
        const { showLoader, hideLoader } = useUIStore.getState();
        showLoader(t('uploading_documents') || "Uploading Securely...");
        setLoadingKey(docKey);
        setErrors(e => ({ ...e, [docKey]: false }));
        try {
            const url = await uploadImage(uri, docKey);
            setUploads(u => ({ ...u, [docKey]: url }));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
            setErrors(e => ({ ...e, [docKey]: true }));
        } finally {
            hideLoader();
            setLoadingKey(null);
        }
    };

    const allUploaded = DOCS.every(d => uploads[d.key] && !errors[d.key]);
    const isComplete = allUploaded && isValidAadhaar;

    return (
        <MainBackground>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <FadeInView delay={50}>
                    <Text style={styles.headerSub}>{t('step_03')}</Text>
                    <Text style={styles.title}>{t('credentialing')}</Text>
                    <Text style={styles.sub}>{t('credentialing_desc')}</Text>
                </FadeInView>

                <FadeInView delay={150} style={styles.section}>
                    <Text style={styles.label}>{t('national_identifier')}</Text>
                    <Card style={styles.inputCard}>
                        <TextInput
                            style={styles.input}
                            value={aadhaarNumber}
                            onChangeText={t => setAadhaarNumber(t.replace(/[^0-9]/g, ''))}
                            placeholder="0000 0000 0000"
                            placeholderTextColor={tTheme.text.tertiary}
                            keyboardType="number-pad"
                            maxLength={12}
                        />
                    </Card>
                </FadeInView>

                <View style={styles.docGrid}>
                    {DOCS.map((doc, index) => {
                        const uri = uploads[doc.key];
                        const isLoading = loadingKey === doc.key;
                        const isFailed = errors[doc.key];
                        const isSuccess = uri && !isFailed && !isLoading;

                        return (
                            <FadeInView delay={250 + index * 100} key={doc.key} style={styles.docItem}>
                                <PressableAnimated
                                    style={[styles.docCard, isSuccess && styles.docCardActive, isFailed && styles.docCardError]}
                                    onPress={() => isFailed ? retryUpload(doc.key) : pickImage(doc.key)}
                                >
                                    <View style={styles.docPreviewWrap}>
                                        {uri ? (
                                            <Image source={{ uri }} style={styles.docPreview} />
                                        ) : (
                                            <View style={styles.docPlaceholder}>
                                                <Text style={styles.docIcon}>{doc.icon}</Text>
                                            </View>
                                        )}
                                        {isSuccess && <View style={styles.successDot} />}
                                        {isFailed && <View style={styles.errorDot} />}
                                    </View>
                                    <View style={styles.docInfo}>
                                        <Text style={styles.docLabel}>{doc.label}</Text>
                                        <Text style={[styles.docStatus, isFailed && styles.statusError]}>
                                            {isLoading ? t('uploading') : isFailed ? t('failed_retry') : isSuccess ? t('verified') : t('pending_upload')}
                                        </Text>
                                    </View>
                                </PressableAnimated>
                            </FadeInView>
                        );
                    })}
                </View>

                <FadeInView delay={650} style={styles.footer}>
                    <PremiumButton
                        title={t('validate_credentials')}
                        disabled={!isComplete}
                        onPress={() => {
                            if (!isComplete) {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                                Alert.alert(t('incomplete_info'), t('please_upload_all_docs'));
                                return;
                            }
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            onNext({ documents: uploads, aadhaar_number: aadhaarNumber });
                        }}
                    />
                </FadeInView>
            </ScrollView>
        </MainBackground>
    );
}

const createStyles = (t) => StyleSheet.create({
    scrollContent: { padding: t.spacing['2xl'], gap: t.spacing[32], paddingBottom: 60 },
    headerSub: { color: t.text.primary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 2 },
    title: { color: t.text.primary, fontSize: 32, fontWeight: '900', letterSpacing: t.typography.tracking.hero, marginTop: 4 },
    sub: { color: t.text.tertiary, fontSize: t.typography.size.body, lineHeight: 24, marginTop: 8 },

    section: { gap: 12 },
    label: { color: t.text.primary, fontSize: 12, fontWeight: t.typography.weight.bold, letterSpacing: 2 },

    inputCard: { backgroundColor: t.background.surface, padding: 4, borderWidth: 1, borderColor: t.background.surface },
    input: {
        paddingHorizontal: 16, paddingVertical: 14,
        color: t.text.primary, fontSize: 24, fontWeight: '900', letterSpacing: 4, textAlign: 'center'
    },

    docGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    docItem: { width: '47%' },
    docCard: {
        backgroundColor: t.background.surface,
        borderRadius: t.radius.xl,
        padding: 12,
        gap: 12,
        borderWidth: 1,
        borderColor: t.background.surface
    },
    docCardActive: { borderColor: t.brand.primary + '44' },
    docCardError: { borderColor: t.status.error.base + '44' },

    docPreviewWrap: { width: '100%', aspectRatio: 1.2, borderRadius: t.radius.lg, backgroundColor: t.background.surfaceRaised, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
    docPreview: { width: '100%', height: '100%', resizeMode: 'cover', opacity: 0.8 },
    docPlaceholder: { alignItems: 'center', gap: 8 },
    docIcon: { fontSize: 32 },

    loaderOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    successDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: t.brand.primary },
    errorDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: t.status.error.base },

    docInfo: { gap: 2 },
    docLabel: { color: t.text.primary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1 },
    docStatus: { color: t.text.tertiary, fontSize: 7, fontWeight: t.typography.weight.bold, letterSpacing: 0.5 },
    statusError: { color: t.status.error.base },

    footer: { marginTop: t.spacing.lg }
});
