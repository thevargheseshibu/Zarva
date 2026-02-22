import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { colors, spacing, radius } from '../../design-system/tokens';
import GoldButton from '../../components/GoldButton';
import apiClient from '../../services/api/client';

// Category-aware fallback questions — used when server is unreachable
const CATEGORY_QUESTIONS = {
    plumber: ['What type of plumbing issue?', 'Where is the problem located?'],
    electrician: ['What electrical work is needed?', 'Is it urgent / power cut?'],
    carpenter: ['What furniture or fixture needs work?', 'Approximate size / dimensions?'],
    ac_repair: ['Which type of AC? (Split / Window / Cassette)', 'What is the exact problem?'],
    painter: ['How many rooms / area in sq ft?', 'Interior, exterior, or both?'],
    cleaning: ['Type of cleaning? (Home / Office / Post-renovation)', 'Approximate area in sq ft?'],
    cleaner: ['Type of cleaning? (Home / Office / Post-renovation)', 'Approximate area in sq ft?'],
    driver: ['Outstation or local trip?', 'Please share pickup & drop location'],
    helper: ['What kind of help do you need?', 'How many hours approximately?'],
};

const DEFAULT_QUESTIONS = ['Describe what you need help with', 'Any specific requirements?'];

function buildFallbackConfig(category, basePrice = 300) {
    const qs = CATEGORY_QUESTIONS[category] || DEFAULT_QUESTIONS;
    return {
        base_price: basePrice,
        questions: [
            { id: 'q1', type: 'text', label: qs[0], required: true },
            { id: 'q2', type: 'text', label: qs[1] || 'Any other details?', required: false, skippable: true },
            { id: 'q3', type: 'image', label: 'Upload a photo (optional)', required: false, skippable: true },
        ]
    };
}

export default function DynamicQuestionsScreen({ route, navigation }) {
    const { category, label } = route.params || { category: 'electrician', label: 'Electrician' };

    const [config, setConfig] = useState(() => buildFallbackConfig(category));
    const [answers, setAnswers] = useState({});
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const loadDynamicConfig = async () => {
            setLoading(true);
            try {
                // Estimate the price based on category
                const estRes = await apiClient.post('/api/jobs/estimate', { category, hours: 1 });
                const basePrice = estRes.data?.total || 300;

                // Load real questions
                const cfgRes = await apiClient.get('/api/jobs/config');
                const catQuestions = cfgRes.data?.questions?.[category] || [
                    "What exactly do you need help with?",
                    "Any specific details?"
                ];

                const dynamicQuestions = [
                    { id: 'q1', type: 'text', label: catQuestions[0] || 'Describe the issue briefly', required: true },
                    { id: 'q2', type: 'text', label: catQuestions[1] || 'Any specific requirements?', required: false, skippable: true },
                    { id: 'q3', type: 'image', label: 'Upload a photo (optional)', required: false, skippable: true }
                ];

                setConfig({ base_price: basePrice, questions: dynamicQuestions });
            } catch (err) {
                console.error('Failed to load dynamic config', err);
                // Use category-aware fallback — never fall back to plumber questions
                setConfig(buildFallbackConfig(category));
            } finally {
                setLoading(false);
            }
        };
        loadDynamicConfig();
    }, [category]);

    const handleAnswer = (questionId, value) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
    };

    const handleImageUpload = async (questionId) => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please allow access to your photo library.');
            return;
        }

        // Delay to prevent Android SoftException unmount crash
        await new Promise(resolve => setTimeout(resolve, 100));

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.2,
            allowsEditing: false, // Disabled to prevent ExpoCropImageActivity from causing Android OOM kills
        });

        if (result.canceled) return;

        setUploading(true);
        const localUri = result.assets[0].uri;

        try {
            // 1. Prepare FormData for direct backend upload
            const formData = new FormData();
            formData.append('purpose', 'job_photo');
            formData.append('file', {
                uri: localUri,
                name: `job_photo_${Date.now()}.jpg`,
                type: 'image/jpeg'
            });

            console.log(`[S3] Starting upload and compression via backend...`);

            // 2. Upload to Node.js server (which compresses via Sharp and pushes to S3)
            const uploadRes = await apiClient.post('/api/uploads/image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (uploadRes.data.status !== 'ok') {
                throw new Error(`Upload failed on server`);
            }

            const { s3_key, url } = uploadRes.data;
            const public_url = url.split('?')[0];

            // Store the final S3 URL as the answer
            handleAnswer(questionId, public_url);
            console.log(`[S3] Photo linked: ${public_url}`);

        } catch (err) {
            console.error('[S3 Export Error]', err.message);
            Alert.alert(
                'Upload Failed',
                'Could not save your photo to our secure storage. Please check your connection and try again.'
            );
            // DO NOT fallback to localUri - it breaks tracking for workers
            handleAnswer(questionId, null);
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
                    onPress={() => {
                        const structuredAnswers = config.questions.map(q => ({
                            question: q.label,
                            answer: answers[q.id] || (q.required ? '' : 'SKIPPED')
                        })).filter(a => a.answer !== '');

                        navigation.navigate('PriceEstimate', {
                            category,
                            label,
                            answers,
                            structuredAnswers,
                            basePrice: config.base_price
                        });
                    }}
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
