import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { colors, spacing, radius } from '../../design-system/tokens';
import GoldButton from '../../components/GoldButton';
import apiClient from '../../services/api/client';

// Mock Config for development testing
const MOCK_CONFIG = {
    base_price: 300,
    questions: [
        {
            id: 'q1',
            type: 'single_select',
            label: 'What type of plumbing issue?',
            options: ['Leakage', 'Blockage', 'Installation', 'Other'],
            required: true
        },
        {
            id: 'q2',
            type: 'text',
            label: 'Describe the issue briefly',
            required: false,
            skippable: true
        },
        {
            id: 'q3',
            type: 'image',
            label: 'Upload a photo (optional)',
            required: false,
            skippable: true
        }
    ]
};

export default function DynamicQuestionsScreen({ route, navigation }) {
    const { category, label } = route.params || { category: 'plumber', label: 'Plumber' };

    const [config, setConfig] = useState(MOCK_CONFIG);
    const [answers, setAnswers] = useState({});
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    // TODO: Fetch real config from /api/jobs/config in a full integration
    // useEffect(() => { ... }, []);

    const handleAnswer = (questionId, value) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
    };

    const handleImageUpload = async (questionId) => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please allow access to your photo library.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.6,
            allowsEditing: true, // Known bug: Android sometimes crashes if false and returning from certain gallery intent
        });

        if (result.canceled) return;

        setUploading(true);
        const localUri = result.assets[0].uri;

        try {
            // Mocking the S3 upload flow for now. In real flow, get presigned URL and PUT.
            const presignRes = await apiClient.post('/api/upload/presign', {
                file_type: `job_photo_${Date.now()}.jpg`,
                mime_type: 'image/jpeg',
            });
            const { upload_url, public_url } = presignRes.data;

            await FileSystem.uploadAsync(upload_url, localUri, {
                httpMethod: 'PUT',
                headers: { 'Content-Type': 'image/jpeg' },
            });

            handleAnswer(questionId, public_url);
        } catch (err) {
            // Dev fallback
            handleAnswer(questionId, localUri);
        } finally {
            setUploading(false);
        }
    };

    const isNextDisabled = config.questions.some(q => q.required && !answers[q.id]);

    const renderQuestion = (q) => {
        const answer = answers[q.id];

        switch (q.type) {
            case 'single_select':
                return (
                    <View style={styles.chipRow}>
                        {q.options.map(opt => (
                            <TouchableOpacity
                                key={opt}
                                style={[styles.chip, answer === opt && styles.chipActive]}
                                onPress={() => handleAnswer(q.id, opt)}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.chipText, answer === opt && styles.chipTextActive]}>
                                    {opt}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                );
            case 'text':
                return (
                    <TextInput
                        style={styles.input}
                        placeholder="Type here..."
                        placeholderTextColor={colors.text.muted}
                        value={answer || ''}
                        onChangeText={(txt) => handleAnswer(q.id, txt)}
                        multiline
                    />
                );
            case 'image':
                return (
                    <TouchableOpacity
                        style={[styles.uploadBox, answer && styles.uploadBoxDone]}
                        onPress={() => handleImageUpload(q.id)}
                    >
                        {answer ? (
                            <Image source={{ uri: answer }} style={styles.previewImage} />
                        ) : (
                            <View style={styles.uploadPlaceholder}>
                                <Text style={styles.cameraIcon}>📷</Text>
                                <Text style={styles.uploadText}>{uploading ? 'Uploading...' : 'Tap to upload photo'}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                );
            default:
                return null;
        }
    };

    return (
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backTxt}>←</Text>
                </TouchableOpacity>
                <Text style={styles.title}>{label}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {config.questions.map((q, i) => (
                    <View key={q.id} style={styles.questionBlock}>
                        <View style={styles.qHeader}>
                            <Text style={styles.qLabel}>{i + 1}. {q.label}</Text>
                            {q.skippable && !answers[q.id] && (
                                <TouchableOpacity onPress={() => handleAnswer(q.id, 'SKIPPED')}>
                                    <Text style={styles.skipTxt}>Skip →</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        {renderQuestion(q)}
                    </View>
                ))}

                <View style={styles.estimateBox}>
                    <Text style={styles.estLabel}>Estimated Base Price</Text>
                    <Text style={styles.estValue}>₹{config.base_price}</Text>
                </View>

                <GoldButton
                    title="Review Details"
                    disabled={isNextDisabled || uploading}
                    onPress={() => navigation.navigate('PriceEstimate', { category, label, answers, basePrice: config.base_price })}
                    style={{ marginTop: spacing.xl }}
                />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: spacing.xl + 20, paddingHorizontal: spacing.sm, paddingBottom: spacing.lg,
        borderBottomWidth: 1, borderBottomColor: colors.bg.surface
    },
    backBtn: { padding: spacing.sm },
    backTxt: { color: colors.text.primary, fontSize: 24 },
    title: { color: colors.text.primary, fontSize: 20, fontWeight: '700' },

    content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xl * 3 },

    questionBlock: { gap: spacing.md },
    qHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    qLabel: { color: colors.text.primary, fontSize: 16, fontWeight: '600', flex: 1 },
    skipTxt: { color: colors.text.muted, fontSize: 13, fontWeight: '600' },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        backgroundColor: colors.bg.surface, borderRadius: radius.full,
        borderWidth: 1, borderColor: colors.bg.surface
    },
    chipActive: { backgroundColor: colors.gold.glow, borderColor: colors.gold.primary },
    chipText: { color: colors.text.secondary, fontSize: 14, fontWeight: '500' },
    chipTextActive: { color: colors.gold.primary },

    input: {
        backgroundColor: colors.bg.surface, borderRadius: radius.md,
        color: colors.text.primary, padding: spacing.md, fontSize: 15,
        minHeight: 100, textAlignVertical: 'top'
    },

    uploadBox: {
        height: 120, backgroundColor: colors.bg.surface, borderRadius: radius.md,
        borderWidth: 1, borderColor: colors.bg.surface, borderStyle: 'dashed',
        justifyContent: 'center', alignItems: 'center', overflow: 'hidden'
    },
    uploadBoxDone: { borderStyle: 'solid', borderColor: colors.success + '88' },
    uploadPlaceholder: { alignItems: 'center', gap: spacing.xs },
    cameraIcon: { fontSize: 28 },
    uploadText: { color: colors.text.secondary, fontSize: 13 },
    previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },

    estimateBox: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: colors.bg.elevated, padding: spacing.lg, borderRadius: radius.lg,
        marginTop: spacing.md
    },
    estLabel: { color: colors.text.secondary, fontSize: 15 },
    estValue: { color: colors.gold.primary, fontSize: 20, fontWeight: '700' }
});
