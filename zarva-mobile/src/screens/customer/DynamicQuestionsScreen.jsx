import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useT } from '../../hooks/useT';
import apiClient from '../../services/api/client';
import FadeInView from '../../components/FadeInView';
import PremiumButton from '../../components/PremiumButton';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import Card from '../../components/Card';
import { colors, radius, spacing, shadows } from '../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../design-system/typography';

const DEFAULT_QUESTIONS = ['Describe what you need help with', 'Any specific requirements?'];

function buildFallbackConfig(category, basePrice = 300) {
    return {
        base_price: basePrice,
        questions: [
            { id: 'q1', type: 'text', label: DEFAULT_QUESTIONS[0], required: true },
            { id: 'q2', type: 'text', label: DEFAULT_QUESTIONS[1], required: false, skippable: true },
            { id: 'q3', type: 'image', label: 'Upload a photo (optional)', required: false, skippable: true },
        ]
    };
}

export default function DynamicQuestionsScreen({ route, navigation }) {
    const t = useT();
    const { category, label, location } = route.params || { category: 'unknown', label: 'Service', location: null };

    const [config, setConfig] = useState(() => buildFallbackConfig(category));
    const [answers, setAnswers] = useState({});
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const loadDynamicConfig = async () => {
            setLoading(true);
            try {
                const estRes = await apiClient.post('/api/jobs/estimate', { category, hours: 1 });
                const breakDownData = estRes.data?.breakdown || estRes.data?.breakdown_exact || estRes.data?.breakdown_min || {};
                const basePrice = estRes.data?.total_amount || breakDownData?.total_amount || 300;

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

                setConfig({ base_price: basePrice, breakdown: breakDownData, questions: dynamicQuestions });
            } catch (err) {
                console.error('Failed to load dynamic config', err);
                setConfig(buildFallbackConfig(category));
            } finally {
                setLoading(false);
            }
        };
        loadDynamicConfig();
    }, [category]);

    const handleAnswer = (questionId, value) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
        Haptics.selectionAsync();
    };

    const handleImageUpload = async (questionId) => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please allow access to your photo library.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.2,
            allowsEditing: false,
        });

        if (result.canceled) return;

        setUploading(true);
        const localUri = result.assets[0].uri;

        try {
            const formData = new FormData();
            formData.append('purpose', 'job_photo');
            formData.append('file', {
                uri: localUri,
                name: `job_photo_${Date.now()}.jpg`,
                type: 'image/jpeg'
            });

            const uploadRes = await apiClient.post('/api/uploads/image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (uploadRes.data.status !== 'ok') throw new Error(`Upload failed`);

            const public_url = uploadRes.data.url.split('?')[0];
            handleAnswer(questionId, public_url);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        } catch (err) {
            Alert.alert('Upload Failed', 'Could not save your photo. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const isNextDisabled = config.questions.some(q => q.required && !answers[q.id]);

    const renderQuestion = (q, index) => {
        const answer = answers[q.id];

        return (
            <FadeInView key={q.id} delay={index * 100}>
                <Card style={styles.questionCard}>
                    <View style={styles.qHeader}>
                        <Text style={styles.qLabel}>{q.label}</Text>
                        {q.required && <View style={styles.requiredDot} />}
                    </View>

                    {q.type === 'text' && (
                        <TextInput
                            style={styles.input}
                            placeholder="Type your details here..."
                            placeholderTextColor={colors.text.muted}
                            value={answer || ''}
                            onChangeText={(txt) => handleAnswer(q.id, txt)}
                            multiline
                            selectionColor={colors.accent.primary}
                        />
                    )}

                    {q.type === 'image' && (
                        <PressableAnimated
                            style={[styles.uploadBox, answer && styles.uploadBoxDone]}
                            onPress={() => handleImageUpload(q.id)}
                        >
                            {answer ? (
                                <Image source={{ uri: answer }} style={styles.previewImage} />
                            ) : (
                                <View style={styles.uploadPlaceholder}>
                                    <Text style={styles.uploadIcon}>{uploading ? '⏳' : '📸'}</Text>
                                    <Text style={styles.uploadText}>{uploading ? 'Uploading...' : 'Add a photo for better clarity'}</Text>
                                </View>
                            )}
                        </PressableAnimated>
                    )}

                    {!q.required && !answer && (
                        <TouchableOpacity
                            style={styles.skipBtn}
                            onPress={() => handleAnswer(q.id, 'SKIPPED')}
                        >
                            <Text style={styles.skipTxt}>Skip this step</Text>
                        </TouchableOpacity>
                    )}
                </Card>
            </FadeInView>
        );
    };

    return (
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <PressableAnimated onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Text style={styles.headerBtnTxt}>←</Text>
                </PressableAnimated>
                <Text style={styles.headerTitle}>{label}</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                <FadeInView delay={50}>
                    <Text style={styles.introTitle}>Tell us more</Text>
                    <Text style={styles.introSub}>Providing details helps us find the best professional for you.</Text>
                </FadeInView>

                {config.questions.map((q, i) => renderQuestion(q, i))}

                <FadeInView delay={400}>
                    <View style={styles.pricingPreview}>
                        <View style={styles.pricingInfo}>
                            <Text style={styles.priceLabel}>ESTIMATED BASE</Text>
                            <Text style={styles.priceValue}>₹{config.base_price}</Text>
                        </View>
                        <View style={styles.pricingHint}>
                            <Text style={styles.hintTxt}>Final price may vary based on actual work.</Text>
                        </View>
                    </View>
                </FadeInView>

                <View style={styles.footer}>
                    <PremiumButton
                        title="Continue"
                        isDisabled={isNextDisabled || uploading}
                        onPress={() => {
                            const structuredAnswers = config.questions.map(q => ({
                                question: q.label,
                                answer: answers[q.id] || (q.required ? '' : 'SKIPPED')
                            })).filter(a => a.answer !== '');

                            navigation.navigate('LocationSchedule', {
                                category,
                                label,
                                location,
                                answers,
                                structuredAnswers,
                                basePrice: config.base_price,
                                breakdown: config.breakdown
                            });
                        }}
                    />
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
        paddingTop: 60,
        paddingHorizontal: spacing[24],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: spacing[16]
    },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
    headerBtnTxt: { color: colors.text.primary, fontSize: 20 },
    headerTitle: { color: colors.text.primary, fontSize: fontSize.body, fontWeight: fontWeight.bold, letterSpacing: tracking.body },

    scrollContent: { padding: spacing[24], paddingBottom: 120 },

    introTitle: { color: colors.text.primary, fontSize: fontSize.hero, fontWeight: fontWeight.bold, letterSpacing: tracking.hero },
    introSub: { color: colors.text.secondary, fontSize: fontSize.body, marginTop: 4, marginBottom: spacing[32], letterSpacing: tracking.body },

    questionCard: { padding: spacing[24], marginBottom: spacing[24], gap: spacing[16] },
    qHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    qLabel: { color: colors.text.primary, fontSize: fontSize.cardTitle, fontWeight: fontWeight.bold, letterSpacing: tracking.cardTitle, flex: 1 },
    requiredDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent.primary },

    input: {
        backgroundColor: colors.elevated,
        borderRadius: radius.lg,
        padding: spacing[16],
        color: colors.text.primary,
        fontSize: fontSize.body,
        minHeight: 120,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: colors.surface
    },

    uploadBox: {
        height: 160,
        backgroundColor: colors.elevated,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.surface,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
    },
    uploadBoxDone: { borderStyle: 'solid', borderColor: colors.accent.primary + '44' },
    uploadPlaceholder: { alignItems: 'center', gap: 8 },
    uploadIcon: { fontSize: 32 },
    uploadText: { color: colors.text.muted, fontSize: fontSize.caption, textAlign: 'center' },
    previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },

    skipBtn: { alignSelf: 'flex-end', marginTop: 4 },
    skipTxt: { color: colors.text.muted, fontSize: fontSize.micro, fontWeight: fontWeight.bold, textDecorationLine: 'underline' },

    pricingPreview: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        padding: spacing[24],
        borderRadius: radius.xl,
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing[8],
        ...shadows.premium
    },
    pricingInfo: { gap: 4 },
    priceLabel: { color: colors.accent.primary, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1.5 },
    priceValue: { color: colors.text.primary, fontSize: 24, fontWeight: fontWeight.bold },
    pricingHint: { flex: 0.8 },
    hintTxt: { color: colors.text.muted, fontSize: 10, textAlign: 'right', fontStyle: 'italic' },

    footer: { marginTop: spacing[40] }
});
