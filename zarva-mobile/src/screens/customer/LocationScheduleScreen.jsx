import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import * as Haptics from 'expo-haptics';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useT } from '../../hooks/useT';
import apiClient from '../../services/api/client';
import { colors, spacing, radius, shadows } from '../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../design-system/typography';
import { useJobStore } from '../../stores/jobStore';
import LocationInput from '../../components/LocationInput';
import PremiumButton from '../../components/PremiumButton';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import FadeInView from '../../components/FadeInView';
import Card from '../../components/Card';

dayjs.extend(customParseFormat);

export default function LocationScheduleScreen({ route, navigation }) {
    const t = useT();
    const { category, label, answers, structuredAnswers, basePrice } = route.params || {};

    const [customerLocation, setCustomerLocation] = useState({});
    const [scheduleType, setScheduleType] = useState('now'); // 'now' or 'later'
    const [scheduledDate, setScheduledDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [isEmergency, setIsEmergency] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleConfirm = async () => {
        if (scheduleType === 'later') {
            if (dayjs(scheduledDate).isBefore(dayjs())) {
                Alert.alert('Invalid Time', 'Scheduled time must be in the future.');
                return;
            }
        }

        setLoading(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        try {
            const payload = {
                category,
                description: structuredAnswers && structuredAnswers.length > 0
                    ? JSON.stringify(structuredAnswers)
                    : (answers && Object.keys(answers).length > 0 ? JSON.stringify(answers) : null),
                customer_address: customerLocation.full_address,
                customer_lat: customerLocation.lat,
                customer_lng: customerLocation.lng,
                customer_address_detail: {
                    house: customerLocation.house,
                    street: customerLocation.street,
                    landmark: customerLocation.landmark,
                    district: customerLocation.district,
                    city: customerLocation.city,
                    state: customerLocation.state,
                    pincode: customerLocation.pincode
                },
                scheduled_for: scheduleType === 'now' ? null : dayjs(scheduledDate).format('YYYY-MM-DD HH:mm:ss'),
                is_emergency: isEmergency ? 1 : 0
            };

            const idempotencyKey = `job-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
            const res = await apiClient.post('/api/jobs', payload, {
                headers: { 'X-Idempotency-Key': idempotencyKey }
            });
            const newJobId = res.data?.job?.id || `job-${Date.now()}`;

            const store = useJobStore.getState();
            store.setActiveJob({ id: newJobId, category });
            store.setSearchPhase('searching');
            store.setCanMinimize(false);

            try {
                store.startListening(newJobId);
            } catch (fbErr) {
                console.error('[LocationSchedule] Firebase listener failed:', fbErr);
            }

            navigation.replace('Searching', { category, jobId: newJobId });
        } catch (e) {
            console.error('Job dispatch error', e);
            Alert.alert('Error', 'Failed to dispatch request. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const isReady = customerLocation?.isValid;

    return (
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <PressableAnimated onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Text style={styles.headerBtnTxt}>←</Text>
                </PressableAnimated>
                <Text style={styles.headerTitle}>{t('where_and_when')}</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                <FadeInView delay={50}>
                    <Text style={styles.introTitle}>{t('where_and_when')}</Text>
                    <Text style={styles.introSub}>{t('set_location_time')}</Text>
                </FadeInView>

                {/* Location Input Component */}
                <LocationInput onChange={setCustomerLocation} />

                {/* Schedule Section */}
                <FadeInView delay={300} style={styles.section}>
                    <Text style={styles.sectionHeader}>{t('schedule_caps')}</Text>
                    <View style={styles.tabRow}>
                        <PressableAnimated
                            style={[styles.tab, scheduleType === 'now' && styles.tabActive]}
                            onPress={() => {
                                setScheduleType('now');
                                Haptics.selectionAsync();
                            }}
                        >
                            <Text style={[styles.tabTxt, scheduleType === 'now' && styles.tabTxtActive]}>{t('asap_now')}</Text>
                        </PressableAnimated>
                        <PressableAnimated
                            style={[styles.tab, scheduleType === 'later' && styles.tabActive]}
                            onPress={() => {
                                setScheduleType('later');
                                Haptics.selectionAsync();
                            }}
                        >
                            <Text style={[styles.tabTxt, scheduleType === 'later' && styles.tabTxtActive]}>{t('schedule_later')}</Text>
                        </PressableAnimated>
                    </View>

                    {scheduleType === 'later' && (
                        <FadeInView delay={100}>
                            <Card style={styles.pickerCard}>
                                <View style={styles.pickerRow}>
                                    <TouchableOpacity
                                        style={styles.pickerBtn}
                                        onPress={() => setShowDatePicker(true)}
                                    >
                                        <Text style={styles.pickerLabel}>{t('date_caps')}</Text>
                                        <Text style={styles.pickerValue}>{dayjs(scheduledDate).format('MMM D, YYYY')}</Text>
                                    </TouchableOpacity>
                                    <View style={styles.pickerDivider} />
                                    <TouchableOpacity
                                        style={styles.pickerBtn}
                                        onPress={() => setShowTimePicker(true)}
                                    >
                                        <Text style={styles.pickerLabel}>{t('time_caps')}</Text>
                                        <Text style={styles.pickerValue}>{dayjs(scheduledDate).format('hh:mm A')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </Card>
                        </FadeInView>
                    )}
                </FadeInView>

                {/* Emergency Section */}
                <FadeInView delay={400} style={styles.section}>
                    <Card style={[styles.emergencyCard, isEmergency && styles.emergencyCardActive]}>
                        <View style={styles.emergencyRow}>
                            <View style={styles.emergencyInfo}>
                                <Text style={styles.emergencyTitle}>{t('emergency_dispatch')}</Text>
                                <Text style={styles.emergencySub}>{t('prioritize_request')}</Text>
                            </View>
                            <Switch
                                value={isEmergency}
                                onValueChange={(val) => {
                                    setIsEmergency(val);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                                trackColor={{ false: colors.elevated, true: colors.accent.primary }}
                                thumbColor={isEmergency ? '#FFF' : '#AAA'}
                            />
                        </View>
                    </Card>
                </FadeInView>

                <View style={styles.footer}>
                    <PremiumButton
                        title={t('search_for_pro')}
                        loading={loading}
                        isDisabled={!isReady}
                        onPress={handleConfirm}
                    />
                </View>

            </ScrollView>

            {showDatePicker && (
                <DateTimePicker
                    value={scheduledDate}
                    mode="date"
                    display="spinner"
                    onChange={(event, date) => {
                        setShowDatePicker(false);
                        if (date) setScheduledDate(date);
                    }}
                />
            )}
            {showTimePicker && (
                <DateTimePicker
                    value={scheduledDate}
                    mode="time"
                    display="spinner"
                    onChange={(event, date) => {
                        setShowTimePicker(false);
                        if (date) setScheduledDate(date);
                    }}
                />
            )}
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

    section: { marginTop: spacing[32], gap: spacing[16] },
    sectionHeader: { color: colors.accent.primary, fontSize: fontSize.micro, fontWeight: fontWeight.bold, letterSpacing: 1.5 },

    tabRow: { flexDirection: 'row', gap: spacing[12] },
    tab: {
        flex: 1,
        paddingVertical: spacing[16],
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.accent.border + '22',
        alignItems: 'center',
        ...shadows.premium
    },
    tabActive: {
        backgroundColor: colors.accent.primary + '11',
        borderColor: colors.accent.primary
    },
    tabTxt: { color: colors.text.muted, fontSize: fontSize.caption, fontWeight: fontWeight.bold },
    tabTxtActive: { color: colors.accent.primary },

    pickerCard: { padding: 0, overflow: 'hidden', marginTop: spacing[8] },
    pickerRow: { flexDirection: 'row', alignItems: 'center' },
    pickerBtn: { flex: 1, padding: spacing[20], alignItems: 'center', gap: 4 },
    pickerLabel: { color: colors.text.muted, fontSize: 8, fontWeight: fontWeight.bold, letterSpacing: 1 },
    pickerValue: { color: colors.text.primary, fontSize: fontSize.body, fontWeight: fontWeight.semibold },
    pickerDivider: { width: 1, height: '60%', backgroundColor: colors.accent.border + '22' },

    emergencyCard: {
        padding: spacing[24],
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.accent.border + '22'
    },
    emergencyCardActive: { borderColor: colors.accent.primary + '44' },
    emergencyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[16] },
    emergencyInfo: { flex: 1 },
    emergencyTitle: { color: colors.text.primary, fontSize: fontSize.cardTitle, fontWeight: fontWeight.bold, letterSpacing: tracking.cardTitle },
    emergencySub: { color: colors.text.secondary, fontSize: 10, marginTop: 4, lineHeight: 14 },

    footer: { marginTop: spacing[48] }
});
