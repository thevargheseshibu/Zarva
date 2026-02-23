import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import dayjs from 'dayjs';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useT } from '../../hooks/useT';
import apiClient from '../../services/api/client';
import { colors, spacing, radius, shadows } from '../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../design-system/typography';
import LocationInput from '../../components/LocationInput';
import PremiumButton from '../../components/PremiumButton';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import FadeInView from '../../components/FadeInView';
import Card from '../../components/Card';

export default function EditJobScreen({ route, navigation }) {
    const t = useT();
    const { jobId } = route.params || {};

    const [job, setJob] = useState(null);
    const [config, setConfig] = useState(null);
    const [answers, setAnswers] = useState({});
    const [customerLocation, setCustomerLocation] = useState({});
    const [scheduledDate, setScheduledDate] = useState(new Date());
    const [scheduleType, setScheduleType] = useState('now');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    useEffect(() => {
        const loadJobAndConfig = async () => {
            try {
                const jobRes = await apiClient.get(`/api/jobs/${jobId}`);
                const jobData = jobRes.data?.job;
                setJob(jobData);

                if (jobData.scheduled_at) {
                    setScheduleType('later');
                    setScheduledDate(new Date(jobData.scheduled_at));
                }

                try {
                    const descStr = jobData.description || jobData.desc;
                    const parsedDesc = typeof descStr === 'string' ? JSON.parse(descStr) : descStr;

                    if (Array.isArray(parsedDesc)) {
                        const initialAnswers = {};
                        parsedDesc.forEach((item, index) => {
                            if (index < 3) {
                                initialAnswers[`q${index + 1}`] = item.answer === 'SKIPPED' ? '' : item.answer;
                            }
                        });
                        setAnswers(initialAnswers);
                    } else if (typeof parsedDesc === 'object' && parsedDesc !== null) {
                        setAnswers(parsedDesc);
                    }
                } catch (e) {
                    console.error('Failed to parse description', e);
                }

                const cfgRes = await apiClient.get('/api/jobs/config');
                const catQuestions = cfgRes.data?.questions?.[jobData.category] || [];

                const dynamicQuestions = [
                    { id: 'q1', type: 'text', label: catQuestions[0] || 'Describe the issue briefly', required: true },
                    { id: 'q2', type: 'text', label: catQuestions[1] || 'Any specific requirements?', required: false, skippable: true },
                    { id: 'q3', type: 'image', label: 'Upload a photo (optional)', required: false, skippable: true }
                ];
                setConfig({ questions: dynamicQuestions });

            } catch (err) {
                console.error('Failed to load edit data', err);
                Alert.alert('Error', 'Failed to load job details.');
                navigation.goBack();
            } finally {
                setLoading(false);
            }
        };
        loadJobAndConfig();
    }, [jobId]);

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
            console.error('Upload error', err);
            Alert.alert('Upload Failed', 'Could not save photo.');
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            const structuredAnswers = config.questions.map(q => ({
                question: q.label,
                answer: answers[q.id] || (q.required ? '' : 'SKIPPED')
            })).filter(a => a.answer !== '');

            const payload = {
                description: JSON.stringify(structuredAnswers),
                scheduled_at: scheduleType === 'now' ? null : dayjs(scheduledDate).format('YYYY-MM-DD HH:mm:ss'),
            };

            if (customerLocation?.isValid) {
                payload.address = customerLocation.full_address;
                payload.latitude = customerLocation.lat;
                payload.longitude = customerLocation.lng;
            }

            await apiClient.put(`/api/jobs/${jobId}`, payload);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Success', 'Job details updated successfully.');
            navigation.goBack();
        } catch (err) {
            console.error('Save failed', err);
            Alert.alert('Error', 'Failed to update job.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={colors.accent.primary} />
                <Text style={styles.loadingTxt}>Preparing editor...</Text>
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <PressableAnimated onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Text style={styles.headerBtnTxt}>←</Text>
                </PressableAnimated>
                <Text style={styles.headerTitle}>Edit Request</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                <FadeInView delay={50}>
                    <Text style={styles.introTitle}>Modify details</Text>
                    <Text style={styles.introSub}>Update your service requirements, location or scheduled time.</Text>
                </FadeInView>

                {/* Questions Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionHeader}>REQUIREMENTS</Text>
                    {config.questions.map((q, i) => (
                        <FadeInView key={q.id} delay={100 + i * 100}>
                            <Card style={styles.questionCard}>
                                <Text style={styles.qLabel}>{q.label}</Text>
                                {q.type === 'text' ? (
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Add more details..."
                                        placeholderTextColor={colors.text.muted}
                                        value={answers[q.id] || ''}
                                        onChangeText={(txt) => handleAnswer(q.id, txt)}
                                        multiline
                                        selectionColor={colors.accent.primary}
                                    />
                                ) : q.type === 'image' ? (
                                    <PressableAnimated
                                        style={[styles.uploadBox, answers[q.id] && styles.uploadBoxDone]}
                                        onPress={() => handleImageUpload(q.id)}
                                    >
                                        {answers[q.id] ? (
                                            <Image source={{ uri: answers[q.id] }} style={styles.previewImage} />
                                        ) : (
                                            <View style={styles.uploadPlaceholder}>
                                                <Text style={styles.uploadIcon}>{uploading ? '⏳' : '📸'}</Text>
                                                <Text style={styles.uploadText}>{uploading ? 'Uploading...' : 'Update photo'}</Text>
                                            </View>
                                        )}
                                    </PressableAnimated>
                                ) : null}
                            </Card>
                        </FadeInView>
                    ))}
                </View>

                {/* Location Section */}
                <FadeInView delay={400} style={styles.section}>
                    <Text style={styles.sectionHeader}>LOCATION</Text>
                    <LocationInput
                        onChange={setCustomerLocation}
                        initialData={{
                            street: job.address,
                            lat: parseFloat(job.latitude),
                            lng: parseFloat(job.longitude)
                        }}
                    />
                </FadeInView>

                {/* Schedule Section */}
                <FadeInView delay={500} style={styles.section}>
                    <Text style={styles.sectionHeader}>SCHEDULE</Text>
                    <View style={styles.tabRow}>
                        <PressableAnimated
                            style={[styles.tab, scheduleType === 'now' && styles.tabActive]}
                            onPress={() => {
                                setScheduleType('now');
                                Haptics.selectionAsync();
                            }}
                        >
                            <Text style={[styles.tabTxt, scheduleType === 'now' && styles.tabTxtActive]}>ASAP</Text>
                        </PressableAnimated>
                        <PressableAnimated
                            style={[styles.tab, scheduleType === 'later' && styles.tabActive]}
                            onPress={() => {
                                setScheduleType('later');
                                Haptics.selectionAsync();
                            }}
                        >
                            <Text style={[styles.tabTxt, scheduleType === 'later' && styles.tabTxtActive]}>Later</Text>
                        </PressableAnimated>
                    </View>

                    {scheduleType === 'later' && (
                        <Card style={styles.pickerCard}>
                            <View style={styles.pickerRow}>
                                <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowDatePicker(true)}>
                                    <Text style={styles.pickerLabel}>DATE</Text>
                                    <Text style={styles.pickerValue}>{dayjs(scheduledDate).format('DD/MM/YYYY')}</Text>
                                </TouchableOpacity>
                                <View style={styles.pickerDivider} />
                                <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowTimePicker(true)}>
                                    <Text style={styles.pickerLabel}>TIME</Text>
                                    <Text style={styles.pickerValue}>{dayjs(scheduledDate).format('hh:mm A')}</Text>
                                </TouchableOpacity>
                            </View>
                        </Card>
                    )}
                </FadeInView>

                <View style={styles.footer}>
                    <PremiumButton
                        title="Update Job Details"
                        loading={saving}
                        onPress={handleSave}
                    />
                </View>

            </ScrollView>

            {showDatePicker && (
                <DateTimePicker
                    value={scheduledDate}
                    mode="date"
                    display="spinner"
                    onChange={(e, d) => { setShowDatePicker(false); if (d) setScheduledDate(d); }}
                />
            )}
            {showTimePicker && (
                <DateTimePicker
                    value={scheduledDate}
                    mode="time"
                    display="spinner"
                    onChange={(e, d) => { setShowTimePicker(false); if (d) setScheduledDate(d); }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    loadingBox: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', gap: spacing[16] },
    loadingTxt: { color: colors.text.muted, fontSize: fontSize.caption },

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

    section: { marginTop: spacing[32], gap: spacing[16] },
    sectionHeader: { color: colors.accent.primary, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 2, marginLeft: 4 },

    questionCard: { padding: spacing[20], gap: spacing[12], backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surface },
    qLabel: { color: colors.text.primary, fontSize: fontSize.caption, fontWeight: fontWeight.bold },
    input: {
        backgroundColor: colors.elevated,
        borderRadius: radius.md,
        padding: spacing[16],
        color: colors.text.primary,
        fontSize: fontSize.body,
        minHeight: 100,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: colors.surface
    },

    uploadBox: {
        height: 120,
        backgroundColor: colors.elevated,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.surface,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
    },
    uploadBoxDone: { borderStyle: 'solid', borderColor: colors.accent.primary + '44' },
    uploadPlaceholder: { alignItems: 'center', gap: 4 },
    uploadIcon: { fontSize: 24 },
    uploadText: { color: colors.text.muted, fontSize: 10, fontWeight: fontWeight.medium },
    previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },

    tabRow: { flexDirection: 'row', gap: spacing[12] },
    tab: {
        flex: 1,
        paddingVertical: spacing[16],
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.accent.border + '11',
        alignItems: 'center'
    },
    tabActive: { backgroundColor: colors.accent.primary + '11', borderColor: colors.accent.primary },
    tabTxt: { color: colors.text.muted, fontSize: fontSize.caption, fontWeight: fontWeight.bold },
    tabTxtActive: { color: colors.accent.primary },

    pickerCard: { padding: 0, overflow: 'hidden', marginTop: spacing[8] },
    pickerRow: { flexDirection: 'row', alignItems: 'center' },
    pickerBtn: { flex: 1, padding: spacing[20], alignItems: 'center', gap: 4 },
    pickerLabel: { color: colors.text.muted, fontSize: 8, fontWeight: fontWeight.bold, letterSpacing: 1 },
    pickerValue: { color: colors.text.primary, fontSize: fontSize.body, fontWeight: fontWeight.semibold },
    pickerDivider: { width: 1, height: '60%', backgroundColor: colors.accent.border + '22' },

    footer: { marginTop: spacing[48] }
});
