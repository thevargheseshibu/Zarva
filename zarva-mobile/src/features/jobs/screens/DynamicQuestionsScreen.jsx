import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { withTiming, useAnimatedStyle } from 'react-native-reanimated';

import { useT } from '@shared/i18n/useTranslation';
import apiClient, { uploadFileRaw } from '@infra/api/client';
import PressableAnimated from '@shared/design-system/components/PressableAnimated';
import { useTokens } from '@shared/design-system';

const { width } = Dimensions.get('window');

function buildFallbackConfig(category, basePrice = 300) {
    return {
        base_price: basePrice,
        breakdown: null,
        questions: [
            { id: 'q1', type: 'text', label: 'Describe what you need help with', required: true },
            { id: 'q2', type: 'text', label: 'Any specific requirements?', required: false, skippable: true }
        ]
    };
}

export default function DynamicQuestionsScreen({ route, navigation }) {
    const tTheme = useTokens();
    const styles = useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const { category, label, location } = route.params || { category: 'unknown', label: 'Service', location: null };

    const [config, setConfig] = useState(() => buildFallbackConfig(category));
    const [answers, setAnswers] = useState({});
    const [photos, setPhotos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    
    // Focus Tracking for the "Spotlight" effect
    const [focusedField, setFocusedField] = useState(null);

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

                setConfig({ 
                    base_price: basePrice, 
                    breakdown: breakDownData, 
                    questions: [
                        { id: 'q1', type: 'text', label: catQuestions[0] || 'Describe the issue briefly', required: true },
                        { id: 'q2', type: 'text', label: catQuestions[1] || 'Any specific requirements?', required: false, skippable: true }
                    ]
                });
            } catch (err) {
                setConfig(buildFallbackConfig(category));
            } finally {
                setLoading(false);
            }
        };
        loadDynamicConfig();
    }, [category]);

    const handleFocus = (fieldId) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setFocusedField(fieldId);
    };

    const handleAnswer = (questionId, value) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
    };

    const handleAddPhoto = async () => {
        if (photos.length >= 3) return Alert.alert('Limit Reached', 'Maximum 3 photos allowed.');
        
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return Alert.alert('Permission needed', 'Please allow photo access.');

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'], quality: 0.2, allowsEditing: false,
        });

        if (result.canceled) return;

        setUploading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        try {
            const uploadRes = await uploadFileRaw('/api/uploads/image', result.assets[0].uri, 'job_photo');
            if (uploadRes.data.status !== 'ok') throw new Error(`Upload failed`);
            
            setPhotos(prev => [...prev, uploadRes.data.url.split('?')[0]]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            Alert.alert('Upload Failed', 'Could not save your photo.');
        } finally {
            setUploading(false);
        }
    };

    // Calculate Progress for the top bar
    const totalRequired = config.questions.filter(q => q.required).length;
    const completedRequired = config.questions.filter(q => q.required && answers[q.id]?.length > 0).length;
    const progress = totalRequired === 0 ? 1 : completedRequired / totalRequired;

    const renderQuestion = (q, index) => {
        const isFocused = focusedField === q.id;
        const answer = answers[q.id];
        const sectionLabels = ['PRIMARY REQUIREMENT', 'ADDITIONAL DETAILS', 'SPECIFICS'];
        
        // Animated styles for Scale + Opacity depth
        const animatedStyle = useAnimatedStyle(() => {
            const isActive = !focusedField || focusedField === q.id;
            return {
                opacity: withTiming(isActive ? 1 : 0.4, { duration: 300 }),
                transform: [{ scale: withTiming(isActive ? 1 : 0.96, { duration: 300 }) }]
            };
        });

        return (
            <Animated.View key={q.id} style={[styles.section, animatedStyle]}>
                {/* Brand-Colored Glowing Line */}
                <Animated.View style={[styles.activeLine, { opacity: isFocused ? 1 : 0 }]} />
                
                <View style={styles.sectionInner}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={[styles.microLabel, isFocused && styles.microLabelActive]}>
                            {`0${index + 1} // ${sectionLabels[index] || `DETAIL 0${index + 1}`}`}
                        </Text>
                        {!q.required && <Text style={styles.optionalBadge}>OPTIONAL</Text>}
                    </View>
                    
                    <TextInput
                        style={[index === 0 ? styles.hugeInput : styles.mediumInput, isFocused && styles.inputActive]}
                        placeholder={q.label}
                        placeholderTextColor={tTheme.text.tertiary}
                        value={answer || ''}
                        onChangeText={(txt) => handleAnswer(q.id, txt)}
                        onFocus={() => handleFocus(q.id)}
                        onBlur={() => setFocusedField(null)}
                        multiline
                        selectionColor={tTheme.brand.primary}
                    />
                </View>
            </Animated.View>
        );
    };

    const renderPhotoSection = () => {
        const isFocused = focusedField === 'photos';
        const animatedStyle = useAnimatedStyle(() => {
            const isActive = !focusedField || focusedField === 'photos';
            return {
                opacity: withTiming(isActive ? 1 : 0.4),
                transform: [{ scale: withTiming(isActive ? 1 : 0.96) }]
            };
        });

        return (
            <Animated.View style={[styles.section, styles.photoSection, animatedStyle]}>
                <Animated.View style={[styles.activeLine, { opacity: isFocused ? 1 : 0 }]} />
                
                <View style={styles.sectionInner}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={[styles.microLabel, isFocused && styles.microLabelActive]}>
                            {`0${config.questions.length + 1} // VISUAL REFERENCES`}
                        </Text>
                        <Text style={styles.optionalBadge}>{photos.length}/3</Text>
                    </View>
                    
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filmstrip}>
                        {photos.map((uri, idx) => (
                            <View key={idx} style={styles.filmItem}>
                                <Image source={{ uri }} style={styles.filmImage} />
                                <TouchableOpacity style={styles.filmRemove} onPress={() => setPhotos(p => p.filter((_, i) => i !== idx))}>
                                    <Text style={styles.filmRemoveTxt}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        ))}

                        {photos.length < 3 && (
                            <PressableAnimated 
                                style={[styles.filmAdd, uploading && styles.uploadingSlot]} 
                                onPress={() => { handleFocus('photos'); handleAddPhoto(); }} 
                                disabled={uploading}
                            >
                                <Text style={styles.filmAddIcon}>{uploading ? '⏳' : '+'}</Text>
                                <Text style={styles.filmAddText}>{t('add')}</Text>
                            </PressableAnimated>
                        )}
                    </ScrollView>
                </View>
            </Animated.View>
        );
    };

    const isNextDisabled = config.questions.some(q => q.required && !answers[q.id]);

    return (
        <View style={styles.screen}>
            {/* Dynamic App Background */}
            <View style={StyleSheet.absoluteFillObject} backgroundColor={tTheme.background.app} />
            
            {/* Minimalist Progress Line */}
            <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                {/* Header */}
                <View style={styles.header}>
                    <PressableAnimated onPress={() => navigation.goBack()} style={styles.headerBtn}>
                        <Text style={styles.headerBtnTxt}>✕</Text>
                    </PressableAnimated>
                    <Text style={styles.headerTitle}>{label.toUpperCase()}</Text>
                    <View style={{ width: 44 }} />
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {config.questions.map((q, i) => renderQuestion(q, i))}
                    {renderPhotoSection()}

                    {/* Pricing Estimate */}
                    <Animated.View style={[styles.pricingPreview, useAnimatedStyle(() => ({
                        opacity: withTiming(!focusedField ? 1 : 0.4),
                        transform: [{ scale: withTiming(!focusedField ? 1 : 0.96) }]
                    }))]}>
                        <Text style={styles.microLabel}>ESTIMATED VALUATION</Text>
                        <View style={styles.priceRow}>
                            <Text style={styles.priceSymbol}>₹</Text>
                            <Text style={styles.priceValue}>{config.base_price}</Text>
                        </View>
                        <Text style={styles.priceDesc}>{t('final_price_vary') || 'Final quote may adjust based on exact scope.'}</Text>
                    </Animated.View>

                    <View style={{ height: 140 }} />
                </ScrollView>

                {/* Floating Action Pill */}
                <View style={styles.floatingFooter}>
                    <PressableAnimated 
                        disabled={isNextDisabled || uploading}
                        style={[styles.submitPillWrap, (isNextDisabled || uploading) && { opacity: 0.3 }]}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            const structuredAnswers = config.questions.map(q => ({
                                question: q.label, answer: answers[q.id] || (q.required ? '' : 'SKIPPED')
                            })).filter(a => a.answer !== '');
                            photos.forEach((p, idx) => structuredAnswers.push({ question: `Photo ${idx + 1}`, answer: p }));

                            const finalAnswers = { ...answers };
                            photos.forEach((p, idx) => { finalAnswers[`q${idx + 3}`] = p; });

                            navigation.navigate('LocationSchedule', {
                                category, label, location, answers: finalAnswers,
                                structuredAnswers, basePrice: config.base_price, breakdown: config.breakdown
                            });
                        }}
                    >
                        <LinearGradient
                            colors={[tTheme.brand.primary, tTheme.brand.secondary || tTheme.brand.primary]}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            style={styles.submitPill}
                        >
                            <Text style={styles.submitPillText}>CONTINUE</Text>
                            <Text style={styles.submitPillArrow}>➔</Text>
                        </LinearGradient>
                    </PressableAnimated>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.app },
    
    progressTrack: { height: 2, backgroundColor: t.background.surfaceRaised, width: '100%', position: 'absolute', top: 0, zIndex: 50 },
    progressFill: { height: '100%', backgroundColor: t.brand.primary },

    // HEADER
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20, zIndex: 10 },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.background.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: t.border.default },
    headerBtnTxt: { color: t.text.primary, fontSize: 16, fontWeight: 'bold' },
    headerTitle: { color: t.brand.primary, fontSize: 11, fontWeight: '900', letterSpacing: 3 },

    scrollContent: { paddingHorizontal: 24, paddingTop: 10 },

    // EDITORIAL SECTIONS
    section: { marginBottom: 40, flexDirection: 'row' },
    activeLine: { width: 2, backgroundColor: t.brand.primary, marginRight: 16, borderRadius: 2, shadowColor: t.brand.primary, shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
    sectionInner: { flex: 1, borderBottomWidth: 1, borderBottomColor: t.border.default, paddingBottom: 30 },
    photoSection: { borderBottomWidth: 0 },
    
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    microLabel: { color: t.text.tertiary, fontSize: 10, fontWeight: '900', letterSpacing: 2 },
    microLabelActive: { color: t.brand.primary },
    optionalBadge: { color: t.text.tertiary, fontSize: 9, fontWeight: 'bold', letterSpacing: 1 },

    // HIGH CONTRAST INPUTS
    hugeInput: { color: t.text.secondary, fontSize: 36, fontWeight: '800', letterSpacing: -1, lineHeight: 44, minHeight: 80 },
    mediumInput: { color: t.text.secondary, fontSize: 22, fontWeight: '500', lineHeight: 32, minHeight: 60 },
    inputActive: { color: t.text.primary, textShadowColor: t.text.primary + '33', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 }, // Brand-aware glowing text

    // FILMSTRIP
    filmstrip: { flexDirection: 'row', gap: 16 },
    filmItem: { width: 110, height: 140, borderRadius: 12, backgroundColor: t.background.surface, overflow: 'hidden', borderWidth: 1, borderColor: t.border.default },
    filmImage: { width: '100%', height: '100%' },
    filmRemove: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: t.border.default },
    filmRemoveTxt: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
    
    filmAdd: { width: 110, height: 140, borderRadius: 12, backgroundColor: t.background.surfaceRaised, borderWidth: 1.5, borderColor: t.border.default, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
    filmAddIcon: { color: t.text.tertiary, fontSize: 28, fontWeight: '300', marginBottom: 4 },
    filmAddText: { color: t.text.tertiary, fontSize: 11, fontWeight: 'bold' },
    uploadingSlot: { opacity: 0.5 },

    // LUMINOUS PRICING
    pricingPreview: { marginTop: 10, paddingLeft: 18 },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
    priceSymbol: { color: t.brand.primary, fontSize: 32, fontWeight: '300', marginRight: 6 },
    priceValue: { color: t.text.primary, fontSize: 64, fontWeight: '900', letterSpacing: -2, textShadowColor: t.text.primary + '22', textShadowRadius: 20 },
    priceDesc: { color: t.text.tertiary, fontSize: 12, marginTop: 4, fontStyle: 'italic' },

    // FLOATING ACTION PILL
    floatingFooter: { position: 'absolute', bottom: Platform.OS === 'ios' ? 40 : 24, left: 24, right: 24 },
    submitPillWrap: { shadowColor: t.brand.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 15 },
    submitPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, height: 64, borderRadius: 32 },
    submitPillText: { color: t.background.app, fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
    submitPillArrow: { color: t.background.app, fontSize: 20, fontWeight: 'bold' },
});
