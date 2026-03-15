import React, { useState, useEffect } from 'react';
import { useTokens } from '../../design-system';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import dayjs from 'dayjs';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useT } from '../../hooks/useT';
import apiClient, { uploadFileRaw } from '@infra/api/client';


import LocationInput from '@jobs/components/LocationInput';
import PremiumButton from '@shared/ui/PremiumButton';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import FadeInView from '@shared/ui/FadeInView';
import Card from '@shared/ui/ZCard';

export default function EditJobScreen({ route, navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
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
            const uploadRes = await uploadFileRaw('/api/uploads/image', localUri, 'job_photo');

            if (uploadRes.data.status !== 'ok') throw new Error(`Upload failed`);

            const public_url = uploadRes.data.url.split('?')[0];
            handleAnswer(questionId, public_url);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            console.error('Upload error', err);
            Alert.alert('Upload Failed', err.message || 'Could not save photo.');
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
                <ActivityIndicator size="large" color={tTheme.brand.primary} />
                <Text style={styles.loadingTxt}>{t('preparing_editor')}</Text>
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
                <Text style={styles.headerTitle}>{t('edit_request')}</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                <FadeInView delay={50}>
                    <Text style={styles.introTitle}>{t('modify_details')}</Text>
                    <Text style={styles.introSub}>{t('update_requirements')}</Text>
                </FadeInView>

                {/* Questions Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionHeader}>{t('requirements_caps')}</Text>
                    {config.questions.map((q, i) => (
                        <FadeInView key={q.id} delay={100 + i * 100}>
                            <Card style={styles.questionCard}>
                                <Text style={styles.qLabel}>{q.label}</Text>
                                {q.type === 'text' ? (
                                    <TextInput
                                        style={styles.input}
                                        placeholder={t('add_more_details')}
                                        placeholderTextColor={tTheme.text.tertiary}
                                        value={answers[q.id] || ''}
                                        onChangeText={(txt) => handleAnswer(q.id, txt)}
                                        multiline
                                        selectionColor={tTheme.brand.primary}
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
                                                <Text style={styles.uploadText}>{uploading ? t('uploading_dots') : t('update_photo')}</Text>
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
                    <Text style={styles.sectionHeader}>{t('location_caps')}</Text>
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
                    <Text style={styles.sectionHeader}>{t('schedule_caps')}</Text>
                    <View style={styles.tabRow}>
                        <PressableAnimated
                            style={[styles.tab, scheduleType === 'now' && styles.tabActive]}
                            onPress={() => {
                                setScheduleType('now');
                                Haptics.selectionAsync();
                            }}
                        >
                            <Text style={[styles.tabTxt, scheduleType === 'now' && styles.tabTxtActive]}>{t('asap_now').replace(' (Now)', '')}</Text>
                        </PressableAnimated>
                        <PressableAnimated
                            style={[styles.tab, scheduleType === 'later' && styles.tabActive]}
                            onPress={() => {
                                setScheduleType('later');
                                Haptics.selectionAsync();
                            }}
                        >
                            <Text style={[styles.tabTxt, scheduleType === 'later' && styles.tabTxtActive]}>{t('schedule_later').replace('Schedule ', '')}</Text>
                        </PressableAnimated>
                    </View>

                    {scheduleType === 'later' && (
                        <Card style={styles.pickerCard}>
                            <View style={styles.pickerRow}>
                                <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowDatePicker(true)}>
                                    <Text style={styles.pickerLabel}>{t('date_caps')}</Text>
                                    <Text style={styles.pickerValue}>{dayjs(scheduledDate).format('DD/MM/YYYY')}</Text>
                                </TouchableOpacity>
                                <View style={styles.pickerDivider} />
                                <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowTimePicker(true)}>
                                    <Text style={styles.pickerLabel}>{t('time_caps')}</Text>
                                    <Text style={styles.pickerValue}>{dayjs(scheduledDate).format('hh:mm A')}</Text>
                                </TouchableOpacity>
                            </View>
                        </Card>
                    )}
                </FadeInView>

                <View style={styles.footer}>
                    <PremiumButton
                        title={t('update_job_details')}
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

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.app },
    loadingBox: { flex: 1, backgroundColor: t.background.app, justifyContent: 'center', alignItems: 'center', gap: t.spacing.lg },
    loadingTxt: { color: t.text.tertiary, fontSize: t.typography.size.caption },

    header: {
        paddingTop: 60,
        paddingHorizontal: t.spacing['2xl'],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: t.spacing.lg
    },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.background.surface, justifyContent: 'center', alignItems: 'center' },
    headerBtnTxt: { color: t.text.primary, fontSize: 20 },
    headerTitle: { color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.bold, letterSpacing: t.typography.tracking.body },

    scrollContent: { padding: t.spacing['2xl'], paddingBottom: 120 },

    introTitle: { color: t.text.primary, fontSize: t.typography.size.hero, fontWeight: t.typography.weight.bold, letterSpacing: t.typography.tracking.hero },
    introSub: { color: t.text.secondary, fontSize: t.typography.size.body, marginTop: 4, marginBottom: t.spacing[32], letterSpacing: t.typography.tracking.body },

    section: { marginTop: t.spacing[32], gap: t.spacing.lg },
    sectionHeader: { color: t.brand.primary, fontSize: 9, fontWeight: t.typography.weight.bold, letterSpacing: 2, marginLeft: 4 },

    questionCard: { padding: t.spacing[20], gap: t.spacing.md, backgroundColor: t.background.surface, borderWidth: 1, borderColor: t.background.surface },
    qLabel: { color: t.text.primary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.bold },
    input: {
        backgroundColor: t.background.surfaceRaised,
        borderRadius: t.radius.md,
        padding: t.spacing.lg,
        color: t.text.primary,
        fontSize: t.typography.size.body,
        minHeight: 100,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: t.background.surface
    },

    uploadBox: {
        height: 120,
        backgroundColor: t.background.surfaceRaised,
        borderRadius: t.radius.md,
        borderWidth: 1,
        borderColor: t.background.surface,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
    },
    uploadBoxDone: { borderStyle: 'solid', borderColor: t.brand.primary + '44' },
    uploadPlaceholder: { alignItems: 'center', gap: 4 },
    uploadIcon: { fontSize: 24 },
    uploadText: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.medium },
    previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },

    tabRow: { flexDirection: 'row', gap: t.spacing.md },
    tab: {
        flex: 1,
        paddingVertical: t.spacing.lg,
        backgroundColor: t.background.surface,
        borderRadius: t.radius.xl,
        borderWidth: 1,
        borderColor: t.border.default + '11',
        alignItems: 'center'
    },
    tabActive: { backgroundColor: t.brand.primary + '11', borderColor: t.brand.primary },
    tabTxt: { color: t.text.tertiary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.bold },
    tabTxtActive: { color: t.brand.primary },

    pickerCard: { padding: 0, overflow: 'hidden', marginTop: t.spacing.sm },
    pickerRow: { flexDirection: 'row', alignItems: 'center' },
    pickerBtn: { flex: 1, padding: t.spacing[20], alignItems: 'center', gap: 4 },
    pickerLabel: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1 },
    pickerValue: { color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.semibold },
    pickerDivider: { width: 1, height: '60%', backgroundColor: t.border.default + '22' },

    footer: { marginTop: t.spacing[48] }
});
