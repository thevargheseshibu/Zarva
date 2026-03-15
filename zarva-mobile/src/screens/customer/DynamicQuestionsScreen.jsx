import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useT } from '../../hooks/useT';
import apiClient, { uploadFileRaw } from '../../services/api/client';
import FadeInView from '../../components/FadeInView';
import PremiumButton from '../../components/PremiumButton';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import Card from '../../components/Card';
import { useTokens } from '../../design-system';

const DEFAULT_QUESTIONS = ['Describe what you need help with', 'Any specific requirements?'];

function buildFallbackConfig(category, basePrice = 300) {
    return {
        base_price: basePrice,
        breakdown: null,   // null so downstream screens know no server breakdown is available
        questions: [
            { id: 'q1', type: 'text', label: DEFAULT_QUESTIONS[0], required: true },
            { id: 'q2', type: 'text', label: DEFAULT_QUESTIONS[1], required: false, skippable: true }
        ]
    };
}

export default function DynamicQuestionsScreen({ route, navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const { category, label, location } = route.params || { category: 'unknown', label: 'Service', location: null };

    const [config, setConfig] = useState(() => buildFallbackConfig(category));
    const [answers, setAnswers] = useState({});
    const [photos, setPhotos] = useState([]);
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
                    // Photos are handled separately now
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

    const handleAddPhoto = async () => {
        if (photos.length >= 3) {
            Alert.alert(t('action_blocked'), t('max_photos_reached'));
            return;
        }

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
            const uploadRes = await uploadFileRaw('/api/uploads/image', localUri, 'job_photo');

            if (uploadRes.data.status !== 'ok') throw new Error(`Upload failed`);

            const public_url = uploadRes.data.url.split('?')[0];
            setPhotos(prev => [...prev, public_url]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        } catch (err) {
            Alert.alert('Upload Failed', 'Could not save your photo. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const removePhoto = (index) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
                            placeholder={t('type_details_here')}
                            placeholderTextColor={colors.text.muted}
                            value={answer || ''}
                            onChangeText={(txt) => handleAnswer(q.id, txt)}
                            multiline
                            selectionColor={colors.accent.primary}
                        />
                    )}

                    {!q.required && !answer && (
                        <TouchableOpacity
                            style={styles.skipBtn}
                            onPress={() => handleAnswer(q.id, 'SKIPPED')}
                        >
                            <Text style={styles.skipTxt}>{t('skip_this_step')}</Text>
                        </TouchableOpacity>
                    )}
                </Card>
            </FadeInView>
        );
    };

    const renderPhotoSection = () => (
        <FadeInView delay={300}>
            <Card style={styles.photoContainer}>
                <View style={styles.qHeader}>
                    <Text style={styles.qLabel}>{t('add_photos')}</Text>
                    <Text style={styles.photoCount}>{photos.length}/3</Text>
                </View>
                <Text style={styles.photoDesc}>{t('add_photos_desc')}</Text>

                <View style={styles.photoGrid}>
                    {photos.map((uri, idx) => (
                        <View key={idx} style={styles.photoWrapper}>
                            <Image source={{ uri }} style={styles.gridImage} />
                            <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(idx)}>
                                <Text style={styles.removeIcon}>✕</Text>
                            </TouchableOpacity>
                        </View>
                    ))}

                    {photos.length < 3 && (
                        <PressableAnimated
                            style={[styles.addSlot, uploading && styles.uploadingSlot]}
                            onPress={handleAddPhoto}
                            disabled={uploading}
                        >
                            <Text style={styles.addSlotIcon}>{uploading ? '⏳' : '+'}</Text>
                        </PressableAnimated>
                    )}
                </View>
            </Card>
        </FadeInView>
    );

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
                    <Text style={styles.introTitle}>{t('tell_us_more')}</Text>
                    <Text style={styles.introSub}>{t('providing_details_helps')}</Text>
                </FadeInView>

                {config.questions.map((q, i) => renderQuestion(q, i))}
                {renderPhotoSection()}

                <FadeInView delay={400}>
                    <View style={styles.pricingPreview}>
                        <View style={styles.pricingInfo}>
                            <Text style={styles.priceLabel}>{t('estimated_base')}</Text>
                            <Text style={styles.priceValue}>₹{config.base_price}</Text>
                        </View>
                        <View style={styles.pricingHint}>
                            <Text style={styles.hintTxt}>{t('final_price_vary')}</Text>
                        </View>
                    </View>
                </FadeInView>

                <View style={styles.footer}>
                    <PremiumButton
                        title={t('continue')}
                        isDisabled={isNextDisabled || uploading}
                        onPress={() => {
                            const structuredAnswers = config.questions.map(q => ({
                                question: q.label,
                                answer: answers[q.id] || (q.required ? '' : 'SKIPPED')
                            })).filter(a => a.answer !== '');

                            // Add photos to structured answers
                            photos.forEach((p, idx) => {
                                structuredAnswers.push({
                                    question: `Photo ${idx + 1}`,
                                    answer: p
                                });
                            });

                            // Ensure simple answers object still has q3, q4, q5 for compatibility if needed
                            const finalAnswers = { ...answers };
                            photos.forEach((p, idx) => {
                                finalAnswers[`q${idx + 3}`] = p;
                            });

                            navigation.navigate('LocationSchedule', {
                                category,
                                label,
                                location,
                                answers: finalAnswers,
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

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.app },
    header: {
        paddingTop: 60,
        paddingHorizontal: t.spacing['2xl'],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: t.spacing.lg,
    },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.background.surface, justifyContent: 'center', alignItems: 'center' },
    headerBtnTxt: { color: t.text.primary, fontSize: 20 },
    headerTitle: { color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.bold, letterSpacing: t.typography.tracking?.body },

    scrollContent: { padding: t.spacing['2xl'], paddingBottom: 120 },

    introTitle: { color: t.text.primary, fontSize: t.typography.size.hero, fontWeight: t.typography.weight.bold, letterSpacing: t.typography.tracking?.hero },
    introSub: { color: t.text.secondary, fontSize: t.typography.size.body, marginTop: 4, marginBottom: t.spacing[32] || 32, letterSpacing: t.typography.tracking?.body },

    questionCard: { padding: t.spacing['2xl'], marginBottom: t.spacing['2xl'], gap: t.spacing.lg },
    qHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    qLabel: { color: t.text.primary, fontSize: t.typography.size.md, fontWeight: t.typography.weight.bold, flex: 1 },
    requiredDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.brand.primary },

    input: {
        backgroundColor: t.background.surfaceRaised,
        borderRadius: t.radius.lg,
        padding: t.spacing.lg,
        color: t.text.primary,
        fontSize: t.typography.size.body,
        minHeight: 120,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: t.background.surface,
    },

    footer: { marginTop: t.spacing[40] || 40 },

    // Photo Grid Styles
    photoContainer: { padding: t.spacing['2xl'], marginBottom: t.spacing['2xl'] },
    photoCount: { color: t.text.tertiary, fontSize: 12, fontWeight: '800' },
    photoDesc: { color: t.text.secondary, fontSize: 12, marginBottom: t.spacing.lg, marginTop: 4 },
    photoGrid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
    photoWrapper: { width: '30%', aspectRatio: 1, borderRadius: t.radius.md, overflow: 'hidden', position: 'relative' },
    gridImage: { width: '100%', height: '100%' },
    removeBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    removeIcon: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
    addSlot: {
        width: '30%',
        aspectRatio: 1,
        borderRadius: t.radius.md,
        backgroundColor: t.background.surfaceRaised,
        borderWidth: 1,
        borderColor: t.background.surface,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadingSlot: { opacity: 0.5 },
    addSlotIcon: { color: t.brand.primary, fontSize: 28, fontWeight: '300', lineHeight: 28, textAlign: 'center' },
});

