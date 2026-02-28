import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Alert, TouchableOpacity, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useT } from '../../hooks/useT';
import apiClient from '../../services/api/client';
import { useTokens } from '../../design-system';

import PremiumButton from '../../components/PremiumButton';
import PressableAnimated from '../../design-system/components/PressableAnimated';

export default function CreateCustomJobScreen({ navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [hourlyRate, setHourlyRate] = useState('');
    const [images, setImages] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!title || title.length < 5) {
            Alert.alert('Invalid Title', 'Please provide a clear title (at least 5 characters).');
            return;
        }
        if (!description || description.length < 30) {
            Alert.alert('Invalid Description', 'Please clear describe what you need done (at least 30 characters).');
            return;
        }
        if (!hourlyRate || isNaN(parseFloat(hourlyRate)) || parseFloat(hourlyRate) < 50) {
            Alert.alert('Invalid Hourly Rate', 'Please propose a reasonable hourly rate (minimum ₹50).');
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', description);
            formData.append('hourly_rate', parseFloat(hourlyRate));

            images.forEach((img, i) => {
                const uriParts = img.split('.');
                const fileType = uriParts[uriParts.length - 1];
                formData.append('photos', {
                    uri: img,
                    name: `photo_${i}.${fileType}`,
                    type: `image/${fileType}`
                });
            });

            await apiClient.post('/api/custom-jobs/templates', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            Alert.alert('Submitted for Review', 'Your custom request has been sent for admin review. Once approved, you can post it live for workers!', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (err) {
            console.error('Submit custom job error', err);
            Alert.alert('Error', err.response?.data?.error || 'Failed to submit request');
        } finally {
            setIsSubmitting(false);
        }
    };

    const pickImage = async () => {
        if (images.length >= 3) {
            Alert.alert('Limit Reached', 'You can upload up to 3 images.');
            return;
        }

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to make this work!');
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            selectionLimit: 3 - images.length,
            quality: 0.5,
        });

        if (!result.canceled && result.assets) {
            const newUris = result.assets.map(a => a.uri);
            setImages(prev => [...prev, ...newUris].slice(0, 3));
        }
    };

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <PressableAnimated onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backTxt}>←</Text>
                </PressableAnimated>
                <Text style={styles.headerTitle}>Custom Request</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView activeOpacity={1} style={styles.content} contentContainerStyle={styles.scrollContent}>

                <View style={styles.banner}>
                    <Text style={styles.bannerIcon}>✨</Text>
                    <View style={styles.bannerTextContainer}>
                        <Text style={styles.bannerTitle}>Propose your own job</Text>
                        <Text style={styles.bannerDesc}>
                            Describe what you need, propose an hourly rate, and we'll broadcast it to all nearby professionals once approved.
                        </Text>
                    </View>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Job Title <Text style={styles.required}>*</Text></Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g., Assemble IKEA Wardrobe"
                        placeholderTextColor={tTheme.text.tertiary}
                        value={title}
                        onChangeText={setTitle}
                        maxLength={100}
                    />
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Detailed Description <Text style={styles.required}>*</Text></Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Please describe exactly what needs to be done, any tools required, etc."
                        placeholderTextColor={tTheme.text.tertiary}
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        textAlignVertical="top"
                        maxLength={1000}
                    />
                    <Text style={styles.charCount}>{description.length}/1000</Text>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Proposed Hourly Rate (₹) <Text style={styles.required}>*</Text></Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g., 200"
                        placeholderTextColor={tTheme.text.tertiary}
                        value={hourlyRate}
                        onChangeText={setHourlyRate}
                    />
                    <Text style={styles.hint}>Billing works just like standard jobs using a live timer.</Text>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Photos (Optional, max 3)</Text>
                    <View style={styles.imgRow}>
                        {images.map((uri, i) => (
                            <View key={i} style={styles.imgWrap}>
                                <Image source={{ uri }} style={styles.previewImg} />
                                <TouchableOpacity
                                    style={styles.rmBtn}
                                    onPress={() => setImages(prev => prev.filter((_, idx) => idx !== i))}>
                                    <Text style={styles.rmTxt}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                        {images.length < 3 && (
                            <TouchableOpacity style={styles.addImgBtn} onPress={pickImage}>
                                <Text style={styles.addImgPlus}>+</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

            </ScrollView>

            <View style={styles.footer}>
                <PremiumButton
                    title={isSubmitting ? "Submitting..." : "Submit for Review"}
                    onPress={handleSubmit}
                    isLoading={isSubmitting}
                />
            </View>
        </View>
    );
}

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.app },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: t.spacing['2xl'],
        paddingTop: 60,
        paddingBottom: t.spacing.lg,
        backgroundColor: t.background.surface,
        ...t.shadows.soft
    },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.background.surfaceRaised, justifyContent: 'center', alignItems: 'center' },
    backTxt: { fontSize: 24, color: t.text.primary, lineHeight: 28 },
    headerTitle: { fontSize: t.typography.size.title, fontWeight: t.typography.weight.bold, color: t.text.primary },

    content: { flex: 1 },
    scrollContent: { padding: t.spacing['2xl'], paddingBottom: t.spacing['5xl'] },

    banner: {
        flexDirection: 'row',
        backgroundColor: t.brand.primary + '15',
        borderRadius: t.radius.xl,
        padding: t.spacing.xl,
        marginBottom: t.spacing['3xl'],
        borderWidth: 1,
        borderColor: t.brand.primary + '30',
    },
    bannerIcon: { fontSize: 32, marginRight: t.spacing.lg },
    bannerTextContainer: { flex: 1 },
    bannerTitle: { color: t.brand.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.bold, marginBottom: t.spacing.sm },
    bannerDesc: { color: t.text.secondary, fontSize: t.typography.size.caption, lineHeight: 20 },

    formGroup: { marginBottom: t.spacing['2xl'] },
    label: { color: t.text.primary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.semibold, marginBottom: t.spacing.md, letterSpacing: t.typography.tracking.caption },
    required: { color: t.status.error.base },
    input: {
        backgroundColor: t.background.surface,
        borderWidth: 1,
        borderColor: t.border.default,
        borderRadius: t.radius.lg,
        padding: t.spacing.md,
        color: t.text.primary,
        fontSize: t.typography.size.body,
    },
    textArea: { height: 120, minHeight: 120 },
    charCount: { textAlign: 'right', color: t.text.tertiary, fontSize: t.typography.size.micro, marginTop: t.spacing.sm },
    hint: { color: t.text.secondary, fontSize: t.typography.size.micro, marginTop: t.spacing.sm },

    footer: {
        padding: t.spacing['2xl'],
        backgroundColor: t.background.surface,
        borderTopWidth: 1,
        borderTopColor: t.border.default,
        paddingBottom: 40
    },

    imgRow: { flexDirection: 'row', gap: t.spacing.md, flexWrap: 'wrap' },
    imgWrap: { position: 'relative', width: 80, height: 80 },
    previewImg: { width: '100%', height: '100%', borderRadius: t.radius.md },
    rmBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: t.status.error.base, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    rmTxt: { color: '#FFF', fontSize: 10, fontWeight: '900' },
    addImgBtn: { width: 80, height: 80, borderRadius: t.radius.md, borderWidth: 2, borderColor: t.border.hover, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: t.background.surfaceRaised },
    addImgPlus: { fontSize: 24, color: t.text.tertiary }
});
