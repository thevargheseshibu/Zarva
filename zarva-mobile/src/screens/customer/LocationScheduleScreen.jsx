import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Switch } from 'react-native';
import * as Location from 'expo-location';
import apiClient from '../../services/api/client';
import { colors, spacing, radius } from '../../design-system/tokens';
import GoldButton from '../../components/GoldButton';
import LocationInput from '../../components/LocationInput';
import { useJobStore } from '../../stores/jobStore';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import DateTimePicker from '@react-native-community/datetimepicker';

dayjs.extend(customParseFormat);

export default function LocationScheduleScreen({ route, navigation }) {
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

            // Register active job in store to survive screen unmounts
            const store = useJobStore.getState();
            store.setActiveJob({ id: newJobId, category });
            store.setSearchPhase('searching');
            store.setCanMinimize(false);
            try {
                store.startListening(newJobId);
            } catch (fbErr) {
                // Firebase listener failed — job exists in DB, we still navigate.
                // The user will see the Searching screen; Firebase may reconnect.
                console.error('[LocationSchedule] Firebase listener failed — continuing anyway:', fbErr);
            }

            navigation.navigate('Searching', { category, jobId: newJobId });
        } catch (e) {
            console.error('Job dispatch error', e);
            Alert.alert('Error', 'Failed to dispatch job.');
        } finally {
            setLoading(false);
        }
    };

    const isReady = customerLocation?.isValid;

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backTxt}>←</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Location & Schedule</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Location Section */}
                <LocationInput onChange={setCustomerLocation} />

                {/* Schedule Section */}
                <Text style={styles.sectionTitle}>When do you need the service?</Text>
                <View style={styles.tabRow}>
                    <TouchableOpacity
                        style={[styles.tab, scheduleType === 'now' && styles.tabActive]}
                        onPress={() => setScheduleType('now')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.tabTxt, scheduleType === 'now' && styles.tabTxtActive]}>ASAP (Now)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, scheduleType === 'later' && styles.tabActive]}
                        onPress={() => setScheduleType('later')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.tabTxt, scheduleType === 'later' && styles.tabTxtActive]}>Schedule Later</Text>
                    </TouchableOpacity>
                </View>

                {scheduleType === 'later' && (
                    <Card style={styles.card}>
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Date</Text>
                                <TouchableOpacity style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
                                    <Text style={{ color: colors.text.primary }}>{dayjs(scheduledDate).format('DD/MM/YYYY')}</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={{ width: spacing.md }} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Time</Text>
                                <TouchableOpacity style={styles.dateInput} onPress={() => setShowTimePicker(true)}>
                                    <Text style={{ color: colors.text.primary }}>{dayjs(scheduledDate).format('hh:mm A')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        {showDatePicker && (
                            <DateTimePicker
                                value={scheduledDate}
                                mode="date"
                                display="default"
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
                                display="default"
                                onChange={(event, date) => {
                                    setShowTimePicker(false);
                                    if (date) setScheduledDate(date);
                                }}
                            />
                        )}
                    </Card>
                )}

                <Card style={[styles.card, { marginTop: spacing.lg }]}>
                    <View style={[styles.row, { alignItems: 'center', justifyContent: 'space-between' }]}>
                        <View style={{ flex: 1, paddingRight: spacing.md }}>
                            <Text style={styles.sectionTitle}>Emergency Service</Text>
                            <Text style={{ color: colors.text.muted, fontSize: 13, marginTop: 4 }}>Need this handled immediately? Surcharges may apply.</Text>
                        </View>
                        <Switch
                            value={isEmergency}
                            onValueChange={setIsEmergency}
                            trackColor={{ false: colors.bg.surface, true: colors.gold.primary }}
                        />
                    </View>
                </Card>

            </ScrollView>

            <View style={styles.footer}>
                <GoldButton
                    title="Confirm & Find Worker"
                    loading={loading}
                    disabled={!isReady}
                    onPress={handleConfirm}
                />
            </View>
        </View>
    );
}

// Inline Card component since we don't import the shared one to avoid dependency cycles if modified
const Card = ({ children, style }) => (
    <View style={[{ backgroundColor: colors.bg.surface, borderRadius: radius.lg, padding: spacing.lg }, style]}>
        {children}
    </View>
);

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

    card: { gap: spacing.sm, backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.bg.surface },

    label: { color: colors.text.secondary, fontSize: 14, fontWeight: '600' },
    input: {
        backgroundColor: colors.bg.primary, borderRadius: radius.md,
        color: colors.text.primary, padding: spacing.md, fontSize: 15,
        minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.bg.surface
    },
    gpsBtn: { alignSelf: 'flex-start', marginTop: spacing.xs },
    gpsTxt: { color: colors.gold.primary, fontWeight: '600', fontSize: 14 },

    tabRow: { flexDirection: 'row', gap: spacing.sm },
    tab: {
        flex: 1, paddingVertical: spacing.md, alignItems: 'center',
        backgroundColor: colors.bg.surface, borderRadius: radius.lg,
        borderWidth: 1, borderColor: colors.bg.surface
    },
    tabActive: { backgroundColor: colors.gold.glow, borderColor: colors.gold.primary },
    tabTxt: { color: colors.text.secondary, fontSize: 16, fontWeight: '600' },
    tabTxtActive: { color: colors.gold.primary },

    row: { flexDirection: 'row', justifyContent: 'space-between' },
    dateInput: {
        backgroundColor: colors.bg.primary, borderRadius: radius.md,
        color: colors.text.primary, padding: spacing.md, fontSize: 15,
        borderWidth: 1, borderColor: colors.bg.surface, textAlign: 'center'
    },

    footer: { padding: spacing.lg, paddingBottom: spacing.xl * 2, borderTopWidth: 1, borderTopColor: colors.bg.surface }
});
