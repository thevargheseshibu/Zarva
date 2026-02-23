import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, shadows } from '../../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../../design-system/typography';
import PremiumButton from '../../../components/PremiumButton';
import apiClient from '../../../services/api/client';
import FadeInView from '../../../components/FadeInView';
import Card from '../../../components/Card';
import PressableAnimated from '../../../design-system/components/PressableAnimated';

const DOCS = [
    { key: 'aadhaar_front', label: 'AADHAAR FRONT', icon: '🪪' },
    { key: 'aadhaar_back', label: 'AADHAAR BACK', icon: '🪪' },
    { key: 'selfie', label: 'E-PORTRAIT (SELFIE)', icon: '🤳' },
    { key: 'agreement_signature', label: 'SIGNATURE SCAN', icon: '📝' },
];

async function uploadImage(uri, docKey) {
    try {
        const formData = new FormData();
        formData.append('purpose', 'worker_doc');
        formData.append('file', {
            uri,
            name: `${docKey}_${Date.now()}.jpg`,
            type: 'image/jpeg'
        });

        const uploadRes = await apiClient.post('/api/uploads/image', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (uploadRes.data.status !== 'ok') throw new Error('Upload failed');
        return uploadRes.data.s3_key;
    } catch (err) {
        throw err;
    }
}

export default function OnboardingDocuments({ data, onNext }) {
    const [uploads, setUploads] = useState(data.documents || {});
    const [aadhaarNumber, setAadhaarNumber] = useState(data.aadhaar_number || '');
    const [loading, setLoading] = useState({});
    const [errors, setErrors] = useState({});

    const isValidAadhaar = /^\d{12}$/.test(aadhaarNumber);

    const pickImage = async (docKey) => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please allow access to your photo library.');
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
        setLoading(l => ({ ...l, [docKey]: true }));
        setErrors(e => ({ ...e, [docKey]: false }));

        try {
            const url = await uploadImage(uri, docKey);
            setUploads(u => ({ ...u, [docKey]: url }));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
            setUploads(u => ({ ...u, [docKey]: uri }));
            setErrors(e => ({ ...e, [docKey]: true }));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setLoading(l => ({ ...l, [docKey]: false }));
        }
    };

    const retryUpload = async (docKey) => {
        const uri = uploads[docKey];
        if (!uri) return;
        setLoading(l => ({ ...l, [docKey]: true }));
        setErrors(e => ({ ...e, [docKey]: false }));
        try {
            const url = await uploadImage(uri, docKey);
            setUploads(u => ({ ...u, [docKey]: url }));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
            setErrors(e => ({ ...e, [docKey]: true }));
        } finally {
            setLoading(l => ({ ...l, [docKey]: false }));
        }
    };

    const allUploaded = DOCS.every(d => uploads[d.key] && !errors[d.key]);
    const isComplete = allUploaded && isValidAadhaar;

    return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <FadeInView delay={50}>
                <Text style={styles.headerSub}>STEP 03/05</Text>
                <Text style={styles.title}>Credentialing</Text>
                <Text style={styles.sub}>Submit your official credentials for secure background verification.</Text>
            </FadeInView>

            <FadeInView delay={150} style={styles.section}>
                <Text style={styles.label}>National Identifier (Aadhaar)</Text>
                <Card style={styles.inputCard}>
                    <TextInput
                        style={styles.input}
                        value={aadhaarNumber}
                        onChangeText={t => setAadhaarNumber(t.replace(/[^0-9]/g, ''))}
                        placeholder="0000 0000 0000"
                        placeholderTextColor={colors.text.muted}
                        keyboardType="number-pad"
                        maxLength={12}
                    />
                </Card>
            </FadeInView>

            <View style={styles.docGrid}>
                {DOCS.map((doc, index) => {
                    const uri = uploads[doc.key];
                    const isLoading = loading[doc.key];
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
                                    {isLoading && (
                                        <View style={styles.loaderOverlay}>
                                            <ActivityIndicator size="small" color={colors.accent.primary} />
                                        </View>
                                    )}
                                    {isSuccess && <View style={styles.successDot} />}
                                    {isFailed && <View style={styles.errorDot} />}
                                </View>
                                <View style={styles.docInfo}>
                                    <Text style={styles.docLabel}>{doc.label}</Text>
                                    <Text style={[styles.docStatus, isFailed && styles.statusError]}>
                                        {isLoading ? 'UPLOADING...' : isFailed ? 'FAILED • RETRY' : isSuccess ? 'VERIFIED' : 'PENDING UPLOAD'}
                                    </Text>
                                </View>
                            </PressableAnimated>
                        </FadeInView>
                    );
                })}
            </View>

            <FadeInView delay={650} style={styles.footer}>
                <PremiumButton
                    title="Validate Credentials"
                    disabled={!isComplete}
                    onPress={() => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        onNext({ documents: uploads, aadhaar_number: aadhaarNumber });
                    }}
                />
            </FadeInView>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollContent: { padding: spacing[24], gap: spacing[32], paddingBottom: 60 },
    headerSub: { color: colors.accent.primary, fontSize: 8, fontWeight: fontWeight.bold, letterSpacing: 2 },
    title: { color: colors.text.primary, fontSize: 32, fontWeight: '900', letterSpacing: tracking.hero, marginTop: 4 },
    sub: { color: colors.text.muted, fontSize: fontSize.body, lineHeight: 24, marginTop: 8 },

    section: { gap: 12 },
    label: { color: colors.accent.primary, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 2 },

    inputCard: { backgroundColor: colors.surface, padding: 4, borderWidth: 1, borderColor: colors.surface },
    input: {
        paddingHorizontal: 16, paddingVertical: 14,
        color: colors.text.primary, fontSize: 24, fontWeight: '900', letterSpacing: 4, textAlign: 'center'
    },

    docGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    docItem: { width: '47%' },
    docCard: {
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        padding: 12,
        gap: 12,
        borderWidth: 1,
        borderColor: colors.surface
    },
    docCardActive: { borderColor: colors.accent.primary + '44' },
    docCardError: { borderColor: colors.error + '44' },

    docPreviewWrap: { width: '100%', aspectRatio: 1.2, borderRadius: radius.lg, backgroundColor: colors.elevated, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
    docPreview: { width: '100%', height: '100%', resizeMode: 'cover', opacity: 0.8 },
    docPlaceholder: { alignItems: 'center', gap: 8 },
    docIcon: { fontSize: 32 },

    loaderOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    successDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent.primary },
    errorDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error },

    docInfo: { gap: 2 },
    docLabel: { color: colors.text.primary, fontSize: 8, fontWeight: fontWeight.bold, letterSpacing: 1 },
    docStatus: { color: colors.text.muted, fontSize: 7, fontWeight: fontWeight.bold, letterSpacing: 0.5 },
    statusError: { color: colors.error },

    footer: { marginTop: spacing[16] }
});
