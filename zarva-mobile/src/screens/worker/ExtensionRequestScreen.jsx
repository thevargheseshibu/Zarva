import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, Image } from 'react-native';
import { useTokens } from '../../design-system';
import { useT } from '../../hooks/useT';
import * as ImagePicker from 'expo-image-picker';
import apiClient, { uploadFileRaw } from '@infra/api/client';
import PremiumButton from '../../components/PremiumButton';
import PressableAnimated from '../../design-system/components/PressableAnimated';

export default function ExtensionRequestScreen({ route, navigation }) {
    const { jobId } = route.params;
    const tTheme = useTokens();
    const t = useT();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);

    const [minutes, setMinutes] = useState('');
    const [reason, setReason] = useState('');
    const [photoUri, setPhotoUri] = useState(null);
    const [loading, setLoading] = useState(false);

    // strict enforcement: camera launch only, NO library selection to prevent fraud.
    const handleCapturePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            return Alert.alert('Permission Denied', 'Camera is required to request an extension.');
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setPhotoUri(result.assets[0].uri);
        }
    };

    const submitRequest = async () => {
        if (!minutes || isNaN(minutes)) return Alert.alert('Invalid Input', 'Enter extra minutes needed.');
        if (!reason.trim()) return Alert.alert('Required', 'Provide a logical reason to show the customer.');
        if (!photoUri) return Alert.alert('Proof Required', 'Capture a live photo of the current condition.');

        setLoading(true);
        try {
            // Upload Photo First
            const uploadRes = await uploadFileRaw('/api/uploads/image', photoUri, 'extension_proof');
            const photoUrl = uploadRes.data.url;

            // Submit Extension
            await apiClient.post(`/api/worker/jobs/${jobId}/extension/request`, {
                requested_minutes: parseInt(minutes, 10),
                reason,
                photo_url: photoUrl
            });

            Alert.alert('Requested Submitted', 'Wait for the customer to approve the extension.');
            navigation.goBack();
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to submit request.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <PressableAnimated onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Text style={styles.headerBtnTxt}>←</Text>
                </PressableAnimated>
                <Text style={styles.headerTitle}>Request Extension</Text>
                <View style={{ width: 44 }} />
            </View>

            <View style={styles.content}>
                <Text style={styles.infoLabel}>Time is running out but the job isn't finished? Request the customer for an extension.</Text>

                <Text style={styles.label}>Additional Minutes</Text>
                <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="e.g. 30"
                    placeholderTextColor={tTheme.text.tertiary}
                    value={minutes}
                    onChangeText={setMinutes}
                />

                <Text style={styles.label}>Reason for Extension</Text>
                <TextInput
                    style={styles.textarea}
                    placeholder="Provide details about unexpected complications..."
                    placeholderTextColor={tTheme.text.tertiary}
                    multiline
                    value={reason}
                    onChangeText={setReason}
                />

                <Text style={styles.label}>Visual Proof (Live Camera Only)</Text>
                {photoUri ? (
                    <PressableAnimated style={styles.photoWrap} onPress={handleCapturePhoto}>
                        <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                    </PressableAnimated>
                ) : (
                    <PressableAnimated style={styles.photoCaptureBox} onPress={handleCapturePhoto}>
                        <Text style={styles.cameraIcon}>📸</Text>
                        <Text style={styles.cameraTxt}>Open Camera</Text>
                    </PressableAnimated>
                )}
            </View>

            <View style={styles.footer}>
                <PremiumButton
                    title="Submit Request"
                    onPress={submitRequest}
                    loading={loading}
                    disabled={!photoUri || !minutes || !reason.trim()}
                />
            </View>
        </View>
    );
}

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.app },
    header: { paddingTop: 60, paddingHorizontal: t.spacing['2xl'], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: t.spacing.lg },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.background.surface, justifyContent: 'center', alignItems: 'center' },
    headerBtnTxt: { color: t.text.primary, fontSize: 20 },
    headerTitle: { color: t.text.primary, fontSize: t.typography.size.title, fontWeight: '900' },

    content: { padding: t.spacing['2xl'], gap: 8 },
    infoLabel: { color: t.text.secondary, fontSize: 13, lineHeight: 20, marginBottom: 16 },

    label: { color: t.brand.primary, fontSize: 11, fontWeight: '900', marginTop: 16, letterSpacing: 1 },
    input: { backgroundColor: t.background.surface, color: t.text.primary, padding: t.spacing.lg, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.border.default, fontSize: 16 },
    textarea: { backgroundColor: t.background.surface, color: t.text.primary, padding: t.spacing.lg, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.border.default, fontSize: 16, minHeight: 120, textAlignVertical: 'top' },

    photoCaptureBox: { backgroundColor: t.background.surfaceRaised, borderWidth: 2, borderColor: t.brand.primary + '44', borderStyle: 'dashed', borderRadius: t.radius.lg, height: 160, justifyContent: 'center', alignItems: 'center', gap: 12 },
    cameraIcon: { fontSize: 32 },
    cameraTxt: { color: t.brand.primary, fontSize: 12, fontWeight: '900' },

    photoWrap: { borderRadius: t.radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: t.border.default },
    photoPreview: { width: '100%', height: 160 },

    footer: { padding: t.spacing['2xl'], paddingBottom: 60, marginTop: 'auto' }
});
