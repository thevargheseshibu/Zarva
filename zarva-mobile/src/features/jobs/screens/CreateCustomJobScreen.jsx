import React, { useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Alert, TouchableOpacity, Image, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolateColor } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useT } from '@shared/i18n/useTranslation';
import apiClient, { uploadFileRaw } from '@infra/api/client';
import { useTokens } from '@shared/design-system';
import PressableAnimated from '@shared/design-system/components/PressableAnimated';

const { width } = Dimensions.get('window');

export default function CreateCustomJobScreen({ navigation }) {
    const tTheme = useTokens();
    const styles = useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [hourlyRate, setHourlyRate] = useState('');
    const [images, setImages] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Tracks which field is active to dim the others (Cinematic Focus)
    const [focusedField, setFocusedField] = useState(null);

    // Refs to move to next inputs smoothly
    const descRef = useRef(null);
    const rateRef = useRef(null);

    const handleFocus = (field) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setFocusedField(field);
    };

    const getOpacity = (field) => {
        if (!focusedField) return 1;
        return focusedField === field ? 1 : 0.25;
    };

    const handleSubmit = async () => {
        if (!title || title.length < 5) return Alert.alert('Vision Unclear', 'Provide a stronger title for your project.');
        if (!description || description.length < 20) return Alert.alert('Missing Details', 'Describe the project in more detail.');
        if (!hourlyRate || isNaN(parseFloat(hourlyRate)) || parseFloat(hourlyRate) < 50) return Alert.alert('Invalid Rate', 'Propose a valid hourly rate (Min ₹50).');

        setIsSubmitting(true);
        try {
            const uploadedPhotoUrls = [];
            for (let i = 0; i < images.length; i++) {
                try {
                    const s3Key = await uploadFileRaw(images[i], 'job_photo', `custom_job_${Date.now()}_${i}.jpg`);
                    uploadedPhotoUrls.push(s3Key);
                } catch (err) {
                    return Alert.alert('Upload Failed', `Image ${i + 1} failed to upload.`);
                }
            }

            await apiClient.post('/api/custom-jobs/templates', {
                title, description, hourly_rate: parseFloat(hourlyRate), photos: uploadedPhotoUrls
            });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Blueprint Initiated', 'Your bespoke request has been sent to our curation team.', [
                { text: 'Excellent', onPress: () => navigation.goBack() }
            ]);
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to submit.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const pickImage = async () => {
        if (images.length >= 3) return;
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return Alert.alert('Permission Required', 'We need access to your photos.');

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            selectionLimit: 3 - images.length,
            quality: 0.5,
        });

        if (!result.canceled && result.assets) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setImages(prev => [...prev, ...result.assets.map(a => a.uri)].slice(0, 3));
        }
    };

    return (
        <View style={styles.screen}>
            {/* Ambient Lighting Background */}
            <LinearGradient colors={['#050505', '#11111A', '#050505']} style={StyleSheet.absoluteFillObject} />
            
            {/* Minimal Header */}
            <View style={styles.header}>
                <PressableAnimated onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backTxt}>✕</Text>
                </PressableAnimated>
                <Text style={styles.headerTitle}>ZARVA BLUEPRINT</Text>
                <View style={{ width: 44 }} />
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView 
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    
                    {/* 1. MASSIVE TITLE CANVAS */}
                    <Animated.View style={[styles.section, { opacity: getOpacity('title') }]}>
                        <Text style={styles.microLabel}>01 // THE VISION</Text>
                        <TextInput
                            style={styles.hugeInput}
                            placeholder="Name your project..."
                            placeholderTextColor="#333344"
                            value={title}
                            onChangeText={setTitle}
                            onFocus={() => handleFocus('title')}
                            onBlur={() => setFocusedField(null)}
                            maxLength={80}
                            multiline
                            blurOnSubmit
                            returnKeyType="next"
                            onSubmitEditing={() => descRef.current?.focus()}
                        />
                    </Animated.View>

                    {/* 2. DESCRIPTION CANVAS */}
                    <Animated.View style={[styles.section, { opacity: getOpacity('desc') }]}>
                        <Text style={styles.microLabel}>02 // THE SCOPE</Text>
                        <TextInput
                            ref={descRef}
                            style={styles.mediumInput}
                            placeholder="Detail the materials, dimensions, and exactly what needs to be done..."
                            placeholderTextColor="#333344"
                            value={description}
                            onChangeText={setDescription}
                            onFocus={() => handleFocus('desc')}
                            onBlur={() => setFocusedField(null)}
                            multiline
                            maxLength={1000}
                        />
                    </Animated.View>

                    {/* 3. GIGANTIC RATE INPUT */}
                    <Animated.View style={[styles.section, { opacity: getOpacity('rate') }]}>
                        <Text style={styles.microLabel}>03 // THE VALUATION</Text>
                        <View style={styles.rateContainer}>
                            <Text style={[styles.rateSymbol, !hourlyRate && { color: '#333344' }]}>₹</Text>
                            <TextInput
                                ref={rateRef}
                                style={styles.giganticInput}
                                placeholder="0"
                                placeholderTextColor="#333344"
                                value={hourlyRate}
                                onChangeText={setHourlyRate}
                                onFocus={() => handleFocus('rate')}
                                onBlur={() => setFocusedField(null)}
                                keyboardType="numeric"
                                maxLength={5}
                            />
                            <Text style={styles.rateSuffix}>/ hr</Text>
                        </View>
                    </Animated.View>

                    {/* 4. FILMSTRIP MOODBOARD */}
                    <Animated.View style={[styles.section, { opacity: getOpacity('images'), borderBottomWidth: 0 }]}>
                        <Text style={styles.microLabel}>04 // VISUAL REFERENCES</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filmstrip}>
                            {images.map((uri, i) => (
                                <View key={i} style={styles.filmItem}>
                                    <Image source={{ uri }} style={styles.filmImage} />
                                    <TouchableOpacity style={styles.filmRemove} onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
                                        setImages(prev => prev.filter((_, idx) => idx !== i));
                                    }}>
                                        <Text style={styles.filmRemoveTxt}>—</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {images.length < 3 && (
                                <PressableAnimated style={styles.filmAdd} onPress={pickImage}>
                                    <Text style={styles.filmAddIcon}>+</Text>
                                </PressableAnimated>
                            )}
                        </ScrollView>
                    </Animated.View>

                    {/* Spacer for bottom button */}
                    <View style={{ height: 100 }} />
                </ScrollView>

                {/* FLOATING ACTION PILL */}
                <View style={styles.floatingFooter}>
                    <PressableAnimated onPress={handleSubmit} disabled={isSubmitting} style={styles.submitPillWrap}>
                        <LinearGradient
                            colors={isSubmitting ? ['#333', '#222'] : ['#E5C07B', '#D4AF37']}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                            style={styles.submitPill}
                        >
                            <Text style={styles.submitPillText}>
                                {isSubmitting ? 'AUTHORIZING...' : 'INITIATE BLUEPRINT'}
                            </Text>
                            {!isSubmitting && <Text style={styles.submitPillArrow}>➔</Text>}
                        </LinearGradient>
                    </PressableAnimated>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#050505' },
    
    // HEADER
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20, zIndex: 10 },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
    backTxt: { fontSize: 18, color: '#FFF', fontWeight: 'bold' },
    headerTitle: { color: '#E5C07B', fontSize: 11, fontWeight: '900', letterSpacing: 3 },

    scrollContent: { paddingHorizontal: 24, paddingTop: 20 },

    // EDITORIAL SECTIONS
    section: { marginBottom: 40, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', paddingBottom: 40 },
    microLabel: { color: '#666677', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 16 },

    // INPUTS (ZERO-UI)
    hugeInput: { color: '#FFF', fontSize: 42, fontWeight: '900', letterSpacing: -1, lineHeight: 48, minHeight: 60 },
    mediumInput: { color: '#DDDDEE', fontSize: 20, fontWeight: '400', lineHeight: 30, minHeight: 100 },
    
    // GIGANTIC RATE COUNTER
    rateContainer: { flexDirection: 'row', alignItems: 'baseline' },
    rateSymbol: { color: '#E5C07B', fontSize: 40, fontWeight: '300', marginRight: 8 },
    giganticInput: { color: '#FFF', fontSize: 80, fontWeight: '900', letterSpacing: -3, padding: 0, margin: 0 },
    rateSuffix: { color: '#666677', fontSize: 20, fontWeight: 'bold', marginLeft: 12 },

    // FILMSTRIP
    filmstrip: { flexDirection: 'row', gap: 16 },
    filmItem: { width: 140, height: 180, borderRadius: 16, backgroundColor: '#111', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    filmImage: { width: '100%', height: '100%' },
    filmRemove: { position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    filmRemoveTxt: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
    
    filmAdd: { width: 140, height: 180, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
    filmAddIcon: { color: '#444455', fontSize: 40, fontWeight: '300' },

    // FLOATING PILL BUTTON
    floatingFooter: { position: 'absolute', bottom: Platform.OS === 'ios' ? 40 : 24, left: 24, right: 24 },
    submitPillWrap: { shadowColor: '#E5C07B', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 15 },
    submitPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, height: 64, borderRadius: 32 },
    submitPillText: { color: '#000', fontSize: 13, fontWeight: '900', letterSpacing: 2 },
    submitPillArrow: { color: '#000', fontSize: 20, fontWeight: 'bold' },
});
