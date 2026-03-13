import React, { useState } from 'react';
import { useTokens } from '../../design-system';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import * as Haptics from 'expo-haptics';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useT } from '../../hooks/useT';
import apiClient from '../../services/api/client';
import coverageApi from '../../services/api/coverageApi';


import { useJobStore } from '../../stores/jobStore';
import { useUIStore } from '../../stores/uiStore';
import LocationInput from '../../components/LocationInput';
import PremiumButton from '../../components/PremiumButton';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import FadeInView from '../../components/FadeInView';
import Card from '../../components/Card';

dayjs.extend(customParseFormat);

export default function LocationScheduleScreen({ route, navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const { category, label, answers, structuredAnswers, basePrice } = route.params || {};

    const [customerLocation, setCustomerLocation] = useState({});
    const [scheduleType, setScheduleType] = useState('now'); // 'now' or 'later'
    const [scheduledDate, setScheduledDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [isEmergency, setIsEmergency] = useState(false);
    const { showLoader, hideLoader } = useUIStore();
    const [isServiceable, setIsServiceable] = useState(true); // Default to true until checked
    const [coverageMsg, setCoverageMsg] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Auto-check coverage when a valid location is entered
    React.useEffect(() => {
        let mounted = true;
        const checkCoverage = async () => {
            if (customerLocation?.isValid && customerLocation?.lat && customerLocation?.lng && category) {
                try {
                    const coverage = await coverageApi.checkServiceability(
                        customerLocation.lat,
                        customerLocation.lng,
                        category
                    );
                    if (mounted) {
                        setIsServiceable(coverage.is_serviceable);
                        if (!coverage.is_serviceable) {
                            setCoverageMsg(`Nearest professional is ${coverage.nearest_worker_distance_km ? coverage.nearest_worker_distance_km.toFixed(1) : 'unknown'} km away.`);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        } else {
                            setCoverageMsg(null);
                        }
                    }
                } catch (err) {
                    console.error("Coverage check error:", err);
                }
            } else {
                if (mounted) setIsServiceable(true); // Reset if incomplete
            }
        };

        // Debounce slightly to avoid spamming as user types, though GPS is instant
        const timer = setTimeout(checkCoverage, 500);
        return () => {
            mounted = false;
            clearTimeout(timer);
        };
    }, [customerLocation, category]);

    const handleConfirm = async () => {
        if (scheduleType === 'later') {
            if (dayjs(scheduledDate).isBefore(dayjs())) {
                Alert.alert('Invalid Time', 'Scheduled time must be in the future.');
                return;
            }
        }

        showLoader(`Finding nearby ${category} professionals...`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        try {
            // STEP 1: Verify serviceability BEFORE attempting to create job
            const coverage = await coverageApi.checkServiceability(
                customerLocation.lat,
                customerLocation.lng,
                category
            );

            if (!coverage.is_serviceable) {
                hideLoader();
                Alert.alert(
                    'Area Not Covered',
                    `We don't have ${category} professionals available in this area right now.\n\nNearest professional is ${coverage.nearest_worker_distance_km ? coverage.nearest_worker_distance_km.toFixed(1) : 'unknown'} km away.`
                );
                return;
            }

            const payload = {
                category,
                description: structuredAnswers && structuredAnswers.length > 0
                    ? JSON.stringify(structuredAnswers)
                    : (answers && Object.keys(answers).length > 0 ? JSON.stringify(answers) : null),
                address: customerLocation.full_address,
                latitude: customerLocation.lat,
                longitude: customerLocation.lng,
                pincode: customerLocation.pincode,
                city: customerLocation.city,
                district: customerLocation.district,
                customer_address_detail: {
                    house: customerLocation.house,
                    street: customerLocation.street,
                    landmark: customerLocation.landmark,
                    district: customerLocation.district,
                    city: customerLocation.city,
                    state: customerLocation.state,
                    pincode: customerLocation.pincode
                },
                scheduled_at: scheduleType === 'now' ? null : dayjs(scheduledDate).format('YYYY-MM-DD HH:mm:ss'),
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

            hideLoader();

            navigation.reset({
                index: 0,
                routes: [{ name: 'Searching', params: { category, jobId: newJobId } }],
            });
        } catch (e) {
            console.error('Job dispatch error', e);
            Alert.alert('Error', 'Failed to dispatch request. Please try again.');
        } finally {
            hideLoader();
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

                {/* Inline Serviceability Warning */}
                {!isServiceable && (
                    <FadeInView delay={100} style={styles.warningBox}>
                        <Text style={styles.warningTitle}>Area Not Covered</Text>
                        <Text style={styles.warningText}>
                            We don't have {category} professionals available in this area right now.
                            {coverageMsg ? `\n${coverageMsg}` : ''}
                        </Text>
                    </FadeInView>
                )}

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
                                trackColor={{ false: tTheme.background.surfaceRaised, true: tTheme.brand.primary }}
                                thumbColor={isEmergency ? '#FFF' : '#AAA'}
                            />
                        </View>
                    </Card>
                </FadeInView>

                <View style={styles.footer}>
                    <PremiumButton
                        title={t('search_for_pro')}
                        loading={isLoading}
                        disabled={!isReady || !isServiceable}
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

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.app },
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
    sectionHeader: { color: t.brand.primary, fontSize: t.typography.size.micro, fontWeight: t.typography.weight.bold, letterSpacing: 1.5 },

    tabRow: { flexDirection: 'row', gap: t.spacing.md },
    tab: {
        flex: 1,
        paddingVertical: t.spacing.lg,
        backgroundColor: t.background.surface,
        borderRadius: t.radius.xl,
        borderWidth: 1,
        borderColor: t.border.default + '22',
        alignItems: 'center',
        ...t.shadows.premium
    },
    tabActive: {
        backgroundColor: t.brand.primary + '11',
        borderColor: t.brand.primary
    },
    tabTxt: { color: t.text.tertiary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.bold },
    tabTxtActive: { color: t.brand.primary },

    pickerCard: { padding: 0, overflow: 'hidden', marginTop: t.spacing.sm },
    pickerRow: { flexDirection: 'row', alignItems: 'center' },
    pickerBtn: { flex: 1, padding: t.spacing[20], alignItems: 'center', gap: 4 },
    pickerLabel: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1 },
    pickerValue: { color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.semibold },
    pickerDivider: { width: 1, height: '60%', backgroundColor: t.border.default + '22' },

    emergencyCard: {
        padding: t.spacing['2xl'],
        backgroundColor: t.background.surface,
        borderWidth: 1,
        borderColor: t.border.default + '22'
    },
    emergencyCardActive: { borderColor: t.brand.primary + '44' },
    emergencyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.spacing.lg },
    emergencyInfo: { flex: 1 },
    emergencyTitle: { color: t.text.primary, fontSize: t.typography.size.cardTitle, fontWeight: t.typography.weight.bold, letterSpacing: t.typography.tracking.cardTitle },
    emergencySub: { color: t.text.secondary, fontSize: 10, marginTop: 4, lineHeight: 14 },

    footer: { marginTop: t.spacing[48] },

    warningBox: {
        marginTop: t.spacing.lg,
        backgroundColor: t.status.warning.base + '11',
        borderWidth: 1,
        borderColor: t.status.warning.base + '44',
        borderRadius: t.radius.md,
        padding: t.spacing.lg,
    },
    warningTitle: { color: t.status.warning.base, fontSize: t.typography.size.base, fontWeight: t.typography.weight.bold, marginBottom: 4 },
    warningText: { color: t.text.primary, fontSize: t.typography.size.sm, lineHeight: 20 }
});
