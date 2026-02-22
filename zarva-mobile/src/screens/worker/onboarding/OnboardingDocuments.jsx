/**
 * src/screens/worker/onboarding/OnboardingDocuments.jsx
 * Step 4: 3 upload cards (Aadhaar front/back + selfie) via expo-image-picker + presign API.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { colors, spacing, radius } from '../../../design-system/tokens';
import GoldButton from '../../../components/GoldButton';
import apiClient from '../../../services/api/client';

const DOCS = [
    { key: 'aadhaar_front', label: 'Aadhaar Front', icon: '🪪' },
    { key: 'aadhaar_back', label: 'Aadhaar Back', icon: '🪪' },
    { key: 'selfie', label: 'Your Photo', icon: '🤳' },
    { key: 'agreement_signature', label: 'Physical Signature', icon: '📝' },
];

async function uploadImage(uri, docKey) {
    try {
        // 1. Get presigned URL from the backend
        // purpose must be one of the server's VALID_PURPOSES: 'worker_doc', 'job_photo', 'profile_photo'
        const presignRes = await apiClient.post('/api/uploads/presign', {
            purpose: 'worker_doc',
            filename: `${docKey}_${Date.now()}.jpg`,
            mime_type: 'image/jpeg',
        });
        const { upload_url, s3_key } = presignRes.data;

        // 2. Upload directly to S3 using FileSystem.uploadAsync
        await FileSystem.uploadAsync(upload_url, uri, {
            httpMethod: 'PUT',
            headers: { 'Content-Type': 'image/jpeg' },
        });

        // 3. Confirm upload so the server marks the token as used
        await apiClient.post('/api/uploads/confirm', { s3_key });

        return s3_key; // return s3_key for later submission
    } catch (err) {
        console.error("Upload failed natively:", err);
        throw err;
    }
}

export default function OnboardingDocuments({ data, onNext }) {
    const [uploads, setUploads] = useState(data.documents || {});
    const [loading, setLoading] = useState({});
    const [errors, setErrors] = useState({});

    const pickImage = async (docKey) => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please allow access to your photo library.');
            return;
        }

        // Delay to allow the TouchableOpacity 'blur' or touch release to complete natively
        // before the modal intent takes over, preventing the SoftException crash.
        await new Promise(resolve => setTimeout(resolve, 100));

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.2,
            allowsEditing: false, // Disabling this because Android's ExpoCropImageActivity consumes too much memory and causes background process kills.
        });
        if (result.canceled) return;

        const uri = result.assets[0].uri;
        setLoading(l => ({ ...l, [docKey]: true }));
        setErrors(e => ({ ...e, [docKey]: false }));

        try {
            const url = await uploadImage(uri, docKey);
            setUploads(u => ({ ...u, [docKey]: url }));
        } catch (e) {
            setUploads(u => ({ ...u, [docKey]: uri })); // Store local URI to preview
            setErrors(e => ({ ...e, [docKey]: true }));
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
        } catch (e) {
            setErrors(e => ({ ...e, [docKey]: true }));
        } finally {
            setLoading(l => ({ ...l, [docKey]: false }));
        }
    };

    const allUploaded = DOCS.every(d => uploads[d.key] && !errors[d.key]);

    return (
        <ScrollView contentContainerStyle={styles.screen}>
            <Text style={styles.title}>Upload Documents</Text>
            <Text style={styles.sub}>Clear photos required for verification. This is a one-time process.</Text>

            {DOCS.map(doc => {
                const uri = uploads[doc.key];
                const isLoading = loading[doc.key];
                const isFailed = errors[doc.key];

                return (
                    <TouchableOpacity
                        key={doc.key}
                        style={[styles.card, uri && !isFailed && styles.cardDone, isFailed && styles.cardFailed]}
                        onPress={() => isFailed ? retryUpload(doc.key) : pickImage(doc.key)}
                        activeOpacity={0.8}
                    >
                        {uri ? (
                            <Image source={{ uri: isFailed ? uri : (uri.startsWith('http') ? uri : `https://s3.placeholder/${uri}`) }} style={styles.preview} />
                        ) : (
                            <View style={styles.placeholder}>
                                <Text style={styles.docIcon}>{doc.icon}</Text>
                                <Text style={styles.cameraIcon}>📷</Text>
                            </View>
                        )}
                        <View style={styles.cardInfo}>
                            <Text style={styles.docLabel}>{doc.label}</Text>
                            <Text style={[styles.docSub, isFailed && { color: colors.error }]}>
                                {isLoading ? 'Uploading...' : isFailed ? 'Upload Failed. Tap to Retry' : uri ? '✓ Uploaded' : 'Tap to upload'}
                            </Text>
                        </View>
                    </TouchableOpacity>
                );
            })}

            <GoldButton
                title="Continue"
                disabled={!allUploaded}
                onPress={() => onNext({ documents: uploads })}
                style={{ marginTop: spacing.xl }}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    screen: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
    title: { color: colors.text.primary, fontSize: 24, fontWeight: '700' },
    sub: { color: colors.text.secondary, fontSize: 14 },
    card: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        backgroundColor: colors.bg.elevated, borderRadius: radius.lg,
        padding: spacing.md, borderWidth: 1, borderColor: colors.bg.surface,
    },
    cardDone: { borderColor: colors.success + '88' },
    cardFailed: { borderColor: colors.error + '88' },
    placeholder: {
        width: 64, height: 64, borderRadius: radius.md,
        backgroundColor: colors.bg.surface, justifyContent: 'center',
        alignItems: 'center', position: 'relative',
    },
    docIcon: { fontSize: 28 },
    cameraIcon: { fontSize: 16, position: 'absolute', bottom: 2, right: 2 },
    preview: { width: 64, height: 64, borderRadius: radius.md },
    cardInfo: { flex: 1 },
    docLabel: { color: colors.text.primary, fontSize: 16, fontWeight: '600' },
    docSub: { color: colors.text.secondary, fontSize: 13, marginTop: 2 },
});
