import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator, Switch } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radius } from '../../design-system/tokens';
import GoldButton from '../../components/GoldButton';
import apiClient from '../../services/api/client';
import LocationInput from '../../components/LocationInput';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';

export default function EditJobScreen({ route, navigation }) {
    const { jobId } = route.params || {};

    const [job, setJob] = useState(null);
    const [config, setConfig] = useState(null);
    const [answers, setAnswers] = useState({});
    const [customerLocation, setCustomerLocation] = useState({});
    const [isEmergency, setIsEmergency] = useState(false);
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
                // 1. Fetch Job Details
                const jobRes = await apiClient.get(`/api/jobs/${jobId}`);
                const jobData = jobRes.data?.job;
                setJob(jobData);

                // Initialize state from job data
                if (jobData.scheduled_at) {
                    setScheduleType('later');
                    setScheduledDate(new Date(jobData.scheduled_at));
                }

                // Parse existing description
                try {
                    const descStr = jobData.description || jobData.desc;
                    const parsedDesc = typeof descStr === 'string' ? JSON.parse(descStr) : descStr;

                    if (Array.isArray(parsedDesc)) {
                        const initialAnswers = {};
                        parsedDesc.forEach((item, index) => {
                            if (index < 3) { // Our current dynamic config has 3 slots
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

                // 2. Fetch Config for Category
                const cfgRes = await apiClient.get('/api/jobs/config');
                const catQuestions = cfgRes.data?.questions?.[jobData.category] || [];

                const dynamicQuestions = [
                    { id: 'q1', type: 'text', label: catQuestions[0] || 'Describe the issue briefly', required: true },
                    { id: 'q2', type: 'text', label: catQuestions[1] || 'Any specific requirements?', required: false, skippable: true },
                    { id: 'q3', type: 'image', label: 'Upload a photo (optional)', required: false, skippable: true }
                ];
                setConfig({ questions: dynamicQuestions });

                // Initialize answers if they were flat objects
                // In Zarva, DynamicQuestionsScreen uses q1, q2, q3 as IDs
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
        } catch (err) {
            console.error('Upload error', err);
            Alert.alert('Upload Failed', 'Could not save photo.');
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
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
            Alert.alert('Success', 'Job updated successfully.');
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
                <ActivityIndicator size="large" color={colors.gold.primary} />
                <Text style={styles.loadingTxt}>Loading job details...</Text>
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backTxt}>←</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Edit Job</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.sectionTitle}>Details & Questions</Text>
                {config.questions.map((q, i) => (
                    <View key={q.id} style={styles.questionBlock}>
                        <Text style={styles.qLabel}>{i + 1}. {q.label}</Text>
                        {q.type === 'text' ? (
                            <TextInput
                                style={styles.input}
                                placeholder="Type here..."
                                placeholderTextColor={colors.text.muted}
                                value={answers[q.id] || ''}
                                onChangeText={(txt) => handleAnswer(q.id, txt)}
                                multiline
                            />
                        ) : q.type === 'image' ? (
                            <TouchableOpacity
                                style={[styles.uploadBox, answers[q.id] && styles.uploadBoxDone]}
                                onPress={() => handleImageUpload(q.id)}
                            >
                                {answers[q.id] ? (
                                    <Image source={{ uri: answers[q.id] }} style={styles.previewImage} />
                                ) : (
                                    <View style={styles.uploadPlaceholder}>
                                        <Text style={styles.cameraIcon}>📷</Text>
                                        <Text style={styles.uploadText}>{uploading ? 'Uploading...' : 'Tap to upload photo'}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        ) : null}
                    </View>
                ))}

                <Text style={styles.sectionTitle}>Location</Text>
                <LocationInput
                    onChange={setCustomerLocation}
                    initialData={{
                        street: job.address,
                        lat: parseFloat(job.latitude),
                        lng: parseFloat(job.longitude)
                    }}
                />

                <Text style={styles.sectionTitle}>Schedule</Text>
                <View style={styles.tabRow}>
                    <TouchableOpacity
                        style={[styles.tab, scheduleType === 'now' && styles.tabActive]}
                        onPress={() => setScheduleType('now')}
                    >
                        <Text style={[styles.tabTxt, scheduleType === 'now' && styles.tabTxtActive]}>ASAP</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, scheduleType === 'later' && styles.tabActive]}
                        onPress={() => setScheduleType('later')}
                    >
                        <Text style={[styles.tabTxt, scheduleType === 'later' && styles.tabTxtActive]}>Later</Text>
                    </TouchableOpacity>
                </View>

                {scheduleType === 'later' && (
                    <View style={styles.dateTimeRow}>
                        <TouchableOpacity style={styles.dtBox} onPress={() => setShowDatePicker(true)}>
                            <Text style={styles.dtTxt}>{dayjs(scheduledDate).format('DD/MM/YYYY')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.dtBox} onPress={() => setShowTimePicker(true)}>
                            <Text style={styles.dtTxt}>{dayjs(scheduledDate).format('hh:mm A')}</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {showDatePicker && (
                    <DateTimePicker
                        value={scheduledDate}
                        mode="date"
                        onChange={(e, d) => { setShowDatePicker(false); if (d) setScheduledDate(d); }}
                    />
                )}
                {showTimePicker && (
                    <DateTimePicker
                        value={scheduledDate}
                        mode="time"
                        onChange={(e, d) => { setShowTimePicker(false); if (d) setScheduledDate(d); }}
                    />
                )}

                <GoldButton
                    title="Save Changes"
                    loading={saving}
                    onPress={handleSave}
                    style={{ marginTop: spacing.xl, marginBottom: spacing.xl * 2 }}
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
    content: { padding: spacing.lg, gap: spacing.lg },
    sectionTitle: { color: colors.text.primary, fontSize: 18, fontWeight: '700', marginTop: spacing.md },
    loadingBox: { flex: 1, backgroundColor: colors.bg.primary, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
    loadingTxt: { color: colors.text.secondary, fontSize: 15 },
    questionBlock: { gap: spacing.sm },
    qLabel: { color: colors.text.primary, fontSize: 15, fontWeight: '600' },
    input: {
        backgroundColor: colors.bg.surface, borderRadius: radius.md,
        color: colors.text.primary, padding: spacing.md, fontSize: 15,
        minHeight: 80, textAlignVertical: 'top'
    },
    uploadBox: {
        height: 100, backgroundColor: colors.bg.surface, borderRadius: radius.md,
        borderWidth: 1, borderColor: colors.bg.surface, borderStyle: 'dashed',
        justifyContent: 'center', alignItems: 'center', overflow: 'hidden'
    },
    uploadBoxDone: { borderStyle: 'solid', borderColor: colors.gold.primary },
    uploadPlaceholder: { alignItems: 'center', gap: spacing.xs },
    cameraIcon: { fontSize: 24 },
    uploadText: { color: colors.text.secondary, fontSize: 12 },
    previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    tabRow: { flexDirection: 'row', gap: spacing.sm },
    tab: {
        flex: 1, paddingVertical: spacing.md, alignItems: 'center',
        backgroundColor: colors.bg.surface, borderRadius: radius.lg
    },
    tabActive: { backgroundColor: colors.gold.glow, borderWidth: 1, borderColor: colors.gold.primary },
    tabTxt: { color: colors.text.secondary, fontSize: 15, fontWeight: '600' },
    tabTxtActive: { color: colors.gold.primary },
    dateTimeRow: { flexDirection: 'row', gap: spacing.md },
    dtBox: {
        flex: 1, backgroundColor: colors.bg.surface, padding: spacing.md,
        borderRadius: radius.md, alignItems: 'center', borderWidth: 1, borderColor: colors.bg.surface
    },
    dtTxt: { color: colors.text.primary, fontSize: 15 },
    emergencyRow: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.elevated,
        padding: spacing.lg, borderRadius: radius.lg, marginTop: spacing.md
    },
    emergencyTitle: { color: colors.text.primary, fontSize: 16, fontWeight: '700' },
    emergencySub: { color: colors.text.muted, fontSize: 12, marginTop: 2 }
});
