import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTokens } from '../../design-system';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Alert, ActivityIndicator, Linking, TextInput, Animated,
    Modal, Platform, DatePickerAndroid
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { ref, onValue, off } from 'firebase/database';
import { useT } from '../../hooks/useT';
import apiClient from '../../services/api/client';
import { db } from '../../utils/firebase';
import FadeInView from '../../components/FadeInView';
import PremiumButton from '../../components/PremiumButton';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import Card from '../../components/Card';
import StatusPill from '../../components/StatusPill';
import OTPInput from '../../components/OTPInput';
import MainBackground from '../../components/MainBackground';
import * as Location from 'expo-location';

// ── Large End OTP Digit Display ──────────────────────────────────────────────
function EndOtpDigits({ code = null }) {
    const tTheme = useTokens();
    const displayCode = code || '----';
    const digits = String(displayCode).padEnd(4, '-').split('');
    const isReal = code !== null && code !== '----' && code?.length === 4;
    const color = tTheme.status?.success?.base || '#22c55e';
    return (
        <View style={{ alignItems: 'center', marginVertical: 8 }}>
            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center', marginVertical: 12 }}>
                {digits.map((d, i) => (
                    <View key={i} style={{
                        width: 68,
                        height: 80,
                        borderRadius: 18,
                        backgroundColor: color + '0D',
                        borderWidth: isReal ? 2.5 : 1,
                        borderColor: isReal ? color + 'BB' : color + '22',
                        justifyContent: 'center',
                        alignItems: 'center',
                        shadowColor: color,
                        shadowOpacity: isReal ? 0.45 : 0,
                        shadowRadius: 14,
                        elevation: isReal ? 8 : 0,
                    }}>
                        <Text style={{
                            color: isReal ? color : color + '33',
                            fontSize: 36,
                            fontWeight: '900',
                            letterSpacing: 1,
                            fontVariant: ['tabular-nums'],
                        }}>{d}</Text>
                    </View>
                ))}
            </View>
            <Text style={{ color: tTheme.text.tertiary, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginTop: 4 }}>
                {isReal ? 'SHARE THIS CODE WITH YOUR CLIENT' : 'LOADING CODE…'}
            </Text>
        </View>
    );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function ActiveJobScreen({ route, navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const { jobId } = route.params || {};
    const [status, setStatus] = useState('assigned');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [job, setJob] = useState(null);
    const [startOtp, setStartOtp] = useState(['', '', '', '']);
    const [inspectionOtp, setInspectionOtp] = useState(['', '', '', '']);
    const [estimateData, setEstimateData] = useState({ minutes: '', notes: '' });
    const [timeElapsed, setTimeElapsed] = useState(0);
    const [endOtp, setEndOtp] = useState(null); // null until server provides the real code
    const [inspectionExpirySeconds, setInspectionExpirySeconds] = useState(null);
    const [otpExpirySeconds, setOtpExpirySeconds] = useState(null);
    const [chatUnread, setChatUnread] = useState(0);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // ── New lifecycle state ───────────────────────────────────────────────────
    const [stopSheetVisible, setStopSheetVisible] = useState(false);
    const [pauseReason, setPauseReason] = useState('');
    const [isPauseMode, setIsPauseMode] = useState(null); // 'pause' | 'reschedule'
    const [rescheduleDate, setRescheduleDate] = useState(new Date(Date.now() + 86400000));
    const [rescheduleReason, setRescheduleReason] = useState('');
    const [materialsVisible, setMaterialsVisible] = useState(false);
    const [materials, setMaterials] = useState([{ name: '', amount: '' }]);
    const [inspectExtRequested, setInspectExtRequested] = useState(false);
    const [inspectExtOtp, setInspectExtOtp] = useState(null);


    // Firebase listeners
    useEffect(() => {
        if (!jobId) return;
        const jobRef = ref(db, `active_jobs/${jobId}`);
        const listener = onValue(jobRef, (snapshot) => {
            const data = snapshot.val();
            if (data?.status) setStatus(data.status);
        });
        const chatRef = ref(db, `active_jobs/${jobId}/chat_unread/worker`);
        const chatListener = onValue(chatRef, (snap) => setChatUnread(snap.val() || 0));
        return () => {
            off(jobRef, 'value', listener);
            off(chatRef, 'value', chatListener);
        };
    }, [jobId]);

    // Pulse animation for waiting states
    useEffect(() => {
        if (['assigned', 'worker_en_route', 'estimate_submitted'].includes(status)) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.12, duration: 1000, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
                ])
            ).start();
        } else {
            pulseAnim.stopAnimation();
            pulseAnim.setValue(1);
        }
    }, [status]);

    // Elapsed timer (inspection + job, excluding pause time)
    useEffect(() => {
        let int;
        const updateTimer = () => {
            if (!job) return;
            let total = 0;

            // Inspection timer - runs when inspection is active
            if (job.inspection_started_at) {
                const s = new Date(job.inspection_started_at).getTime();
                const e = job.inspection_ended_at ? new Date(job.inspection_ended_at).getTime() : Date.now();
                // Only add time if inspection is currently active OR has been completed
                if (status === 'inspection_active' || job.inspection_ended_at) {
                    total += Math.max(0, Math.floor((e - s) / 1000));
                }
            }

            // Job timer - runs when job is in progress
            if (job.job_started_at) {
                const s = new Date(job.job_started_at).getTime();
                const e = job.job_ended_at ? new Date(job.job_ended_at).getTime() : Date.now();
                const paused = parseInt(job.total_paused_seconds || 0, 10);

                // If currently paused, stop the timer at pause start
                let elapsed;
                if (['work_paused', 'pause_requested', 'resume_requested'].includes(status) && job.paused_at) {
                    elapsed = Math.max(0, Math.floor((new Date(job.paused_at).getTime() - s) / 1000) - paused);
                } else if (status === 'in_progress' || job.job_ended_at) {
                    elapsed = Math.max(0, Math.floor((e - s) / 1000) - paused);
                } else {
                    elapsed = 0;
                }
                total += elapsed;
            }

            setTimeElapsed(total);
        };

        // Start timer when inspection is active OR job is in progress
        if (status === 'inspection_active' || status === 'in_progress') {
            updateTimer();
            int = setInterval(updateTimer, 1000);
        }

        return () => clearInterval(int);
    }, [status, job]);


    // Inspection expiry countdown
    useEffect(() => {
        let int;
        if (status === 'worker_arrived' && job?.inspection_expires_at) {
            const expiry = new Date(job.inspection_expires_at).getTime();
            const tick = () => setInspectionExpirySeconds(Math.max(0, Math.floor((expiry - Date.now()) / 1000)));
            tick(); int = setInterval(tick, 1000);
        }
        return () => clearInterval(int);
    }, [status, job?.inspection_expires_at]);

    // Start OTP expiry countdown
    useEffect(() => {
        let int;
        if (status === 'estimate_submitted' && job?.start_otp_generated_at) {
            const expiry = new Date(job.start_otp_generated_at).getTime() + 3600000;
            const tick = () => setOtpExpirySeconds(Math.max(0, Math.floor((expiry - Date.now()) / 1000)));
            tick(); int = setInterval(tick, 1000);
        }
        return () => clearInterval(int);
    }, [status, job?.start_otp_generated_at]);

    useEffect(() => {
        if (jobId) {
            console.log(`[ActiveJob] JobID changed to ${jobId}. Resetting states & fetching...`);
            // Reset phase-specific states for clean transition
            setInspectExtRequested(false);
            setInspectExtOtp(null);
            setEndOtp(null);
            setStartOtp(['', '', '', '']);
            fetchJob();
        }
    }, [jobId]);

    const fetchJob = async () => {
        try {
            setLoading(true);
            const res = await apiClient.get(`/api/worker/jobs/${jobId}`);
            const data = res.data?.job;
            setJob(data);
            if (data.status) setStatus(data.status);
            if (data.end_otp) setEndOtp(data.end_otp);
            const isExtPending = Boolean(data.inspection_extension_otp_hash);
            setInspectExtRequested(isExtPending);

            if (isExtPending) {
                try {
                    const extRes = await apiClient.get(`/api/worker/jobs/${jobId}/inspection/extension-otp`, { useLoader: false });
                    if (extRes.data?.otp) setInspectExtOtp(extRes.data.otp);
                } catch (e) {
                    console.log('[ActiveJob] Could not recover extension OTP:', e.message);
                }
            }
        } catch (err) {
            Alert.alert('Error', 'Could not load job details.');
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { if (jobId) fetchJob(); }, [jobId]));

    const formatTime = (s) => {
        const h = Math.floor(s / 3600).toString().padStart(2, '0');
        const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
        const ss = (s % 60).toString().padStart(2, '0');
        return h === '00' ? `${m}:${ss}` : `${h}:${m}:${ss}`;
    };

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleCall = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (job?.customer_phone) Linking.openURL(`tel:${job.customer_phone}`);
    };

    const handleNavigate = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const lat = job?.latitude || '';
        const lng = job?.longitude || '';
        const query = lat && lng ? `${lat},${lng}` : encodeURIComponent(job?.address || 'Kochi');
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${query}`);
    };

    const handleArrived = async () => {
        setActionLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            // Capture latest GPS and sync to backend so customer map sees accurate arrival point
            const { status: perm } = await Location.requestForegroundPermissionsAsync();
            if (perm === 'granted') {
                try {
                    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    await apiClient.put('/api/worker/location', {
                        lat: loc.coords.latitude,
                        lng: loc.coords.longitude
                    });
                } catch (e) {
                    console.warn('[ActiveJob] Failed to capture arrival location', e);
                }
            }

            await apiClient.post(`/api/worker/jobs/${jobId}/arrived`);
            setStatus('worker_arrived');
            await fetchJob(); // refresh to get inspection_expires_at
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to update status.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleVerifyInspectionOtp = async () => {
        const code = inspectionOtp.join('');
        if (code.length !== 4) return;
        setActionLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        try {
            const res = await apiClient.post(`/api/worker/jobs/${jobId}/verify-inspection-otp`, { otp: code });
            if (res.data?.verified || res.status === 200) {
                setStatus('inspection_active');
                await fetchJob();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        } catch (err) {
            Alert.alert('Invalid Code', err.response?.data?.message || 'Incorrect inspection code.');
            setInspectionOtp(['', '', '', '']);
        } finally {
            setActionLoading(false);
        }
    };

    const handleSubmitEstimate = async () => {
        if (!estimateData.minutes || isNaN(estimateData.minutes)) {
            return Alert.alert('Invalid Input', 'Please enter a valid number of minutes.');
        }
        setActionLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await apiClient.post(`/api/worker/jobs/${jobId}/inspection/estimate`, {
                estimated_minutes: parseInt(estimateData.minutes, 10),
                notes: estimateData.notes,
            });
            setStatus('estimate_submitted');
            setEstimateData({ minutes: '', notes: '' });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to submit estimate.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleVerifyStartOtp = async () => {
        const code = startOtp.join('');
        if (code.length !== 4) return;
        setActionLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        try {
            // CHANGE: Backend expects `otp` field; sending `code` always fails verification.
            await apiClient.post(`/api/worker/jobs/${jobId}/verify-start-otp`, { otp: code });
            await fetchJob();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            Alert.alert('Invalid Code', err.response?.data?.message || 'Incorrect start code.');
            setStartOtp(['', '', '', '']);
        } finally {
            setActionLoading(false);
        }
    };

    const handleMarkComplete = async () => {
        setActionLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            const res = await apiClient.post(`/api/worker/jobs/${jobId}/complete`);
            setStatus('pending_completion');
            if (res.data?.end_otp) {
                setEndOtp(res.data.end_otp);
                await fetchJob();
                // Only open materials modal once we have the real end OTP
                setMaterialsVisible(true);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                // OTP not returned inline — fetchJob will pick it up from the DB
                await fetchJob();
                setMaterialsVisible(true);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to complete job.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRequestInspectionExtension = async () => {
        if (inspectExtRequested) return;
        setActionLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            const res = await apiClient.post(`/api/worker/jobs/${jobId}/inspection/extend-request`);
            setInspectExtRequested(true);
            if (res.data?.otp) setInspectExtOtp(res.data.otp);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('✅ Extension Requested', 'The customer will see an OTP to approve +10 more minutes.');
        } catch (err) {
            Alert.alert('Cannot Extend', err.response?.data?.message || 'Extension request failed.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRequestPause = async () => {
        if (!pauseReason.trim()) return Alert.alert('Required', 'Please provide a reason for pausing.');
        setActionLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await apiClient.post(`/api/worker/jobs/${jobId}/pause-request`, { reason: pauseReason });
            setStopSheetVisible(false);
            setIsPauseMode(null);
            setPauseReason('');
            await fetchJob();
            Alert.alert('⏸ Pause Requested', 'Waiting for customer to approve with their OTP.');
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Could not request pause.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRequestResume = async () => {
        setActionLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await apiClient.post(`/api/worker/jobs/${jobId}/resume-request`);
            await fetchJob();
            Alert.alert('▶ Resume Requested', 'Waiting for customer to approve resume with their OTP.');
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Could not request resume.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRequestSuspend = async () => {
        if (!rescheduleReason.trim()) return Alert.alert('Required', 'Please provide a reason.');
        setActionLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await apiClient.post(`/api/worker/jobs/${jobId}/suspend-request`, {
                reason: rescheduleReason,
                reschedule_at: rescheduleDate.toISOString(),
            });
            setStopSheetVisible(false);
            setIsPauseMode(null);
            setRescheduleReason('');
            await fetchJob();
            Alert.alert('📅 Reschedule Requested', 'The customer will see an OTP to approve the new date/time.');
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Could not request reschedule.');
        } finally {
            setActionLoading(false);
        }
    };

    const handlePickRescheduleDate = async () => {
        // Small helper to let worker pick a practical time slot after selecting date.
        const promptTimeSlot = (dateBase) => {
            Alert.alert(
                'Select Time',
                'Choose a preferred start time',
                [
                    { text: '09:00 AM', onPress: () => setRescheduleDate(new Date(dateBase.getFullYear(), dateBase.getMonth(), dateBase.getDate(), 9, 0, 0, 0)) },
                    { text: '12:00 PM', onPress: () => setRescheduleDate(new Date(dateBase.getFullYear(), dateBase.getMonth(), dateBase.getDate(), 12, 0, 0, 0)) },
                    { text: '03:00 PM', onPress: () => setRescheduleDate(new Date(dateBase.getFullYear(), dateBase.getMonth(), dateBase.getDate(), 15, 0, 0, 0)) },
                    { text: '06:00 PM', onPress: () => setRescheduleDate(new Date(dateBase.getFullYear(), dateBase.getMonth(), dateBase.getDate(), 18, 0, 0, 0)) },
                    { text: 'Cancel', style: 'cancel' },
                ]
            );
        };

        if (Platform.OS === 'android') {
            try {
                const { action, year, month, day } = await DatePickerAndroid.open({
                    date: rescheduleDate,
                    minDate: new Date()
                });
                if (action !== DatePickerAndroid.dismissedAction) {
                    const newDate = new Date(year, month, day, rescheduleDate.getHours(), rescheduleDate.getMinutes());
                    // Ask for time too (date-only picker alone caused fixed-time scheduling frustration).
                    promptTimeSlot(newDate);
                }
            } catch ({ code, message }) {
                console.warn('Cannot open date picker', message);
            }
        } else {
            // Simplified fallback for iOS where native DatePicker isn't built-in to core RN anymore
            Alert.alert(
                'Select Reschedule Date',
                'Pick a date for rescheduling',
                [
                    {
                        text: 'Tomorrow', onPress: () => {
                            const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
                            promptTimeSlot(d);
                        }
                    },
                    {
                        text: 'Day After Tomorrow', onPress: () => {
                            const d = new Date(); d.setDate(d.getDate() + 2); d.setHours(9, 0, 0, 0);
                            promptTimeSlot(d);
                        }
                    },
                    {
                        text: 'Next Week', onPress: () => {
                            const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0);
                            promptTimeSlot(d);
                        }
                    },
                    { text: 'Cancel', style: 'cancel' },
                ]
            );
        }
    };

    const handleSubmitMaterials = async (skip = false) => {
        setActionLoading(true);
        try {
            const validItems = skip ? [] : materials.filter(m => m.name.trim() && parseFloat(m.amount) > 0);
            await apiClient.post(`/api/jobs/${jobId}/materials`, { items: validItems });
            setMaterialsVisible(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Could not save materials.');
        } finally {
            setActionLoading(false);
        }
    };


    // ── Phase Rendering ───────────────────────────────────────────────────────
    const renderPhaseCard = () => {
        const isAssigned = status === 'assigned' || status === 'worker_en_route';
        const isArrived = status === 'worker_arrived';
        const isInspection = status === 'inspection_active';
        const isEstimateSubmitted = status === 'estimate_submitted';
        const isInProgress = status === 'in_progress';
        const isPending = status === 'pending_completion';
        const isCompleted = ['completed', 'cancelled', 'no_worker_found'].includes(status);

        if (isAssigned) return (
            <FadeInView delay={100}>
                {/* Navigation Phase */}
                <View style={[styles.phaseCard, { borderColor: '#00E0FF33' }]}>
                    <View style={styles.phaseHeader}>
                        <View style={[styles.phaseIconBox, { backgroundColor: '#00E0FF15' }]}>
                            <Text style={{ fontSize: 24 }}>🛵</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.phaseMeta}>MISSION BRIEFING</Text>
                            <Text style={styles.phaseTitle}>Navigate to Client</Text>
                        </View>
                        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                            <View style={[styles.liveBadge, { backgroundColor: '#00E0FF11', borderColor: '#00E0FF33', borderWidth: 1 }]}>
                                <View style={[styles.liveDot, { backgroundColor: '#00E0FF' }]} />
                                <Text style={[styles.liveTxt, { color: '#00E0FF' }]}>EN ROUTE</Text>
                            </View>
                        </Animated.View>
                    </View>

                    <View style={styles.addressBox}>
                        <Text style={styles.addressLabel}>📍 SERVICE ADDRESS</Text>
                        <Text style={styles.addressText} numberOfLines={2}>{job?.address || '—'}</Text>
                    </View>

                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.iconActionBtn} onPress={handleNavigate}>
                            <Text style={{ fontSize: 20 }}>🧭</Text>
                            <Text style={styles.iconActionTxt}>Navigate</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconActionBtn} onPress={handleCall}>
                            <Text style={{ fontSize: 20 }}>📞</Text>
                            <Text style={styles.iconActionTxt}>Call Client</Text>
                        </TouchableOpacity>
                    </View>

                    <PremiumButton
                        title="✓ I'm Here — Confirm Arrival"
                        onPress={handleArrived}
                        loading={actionLoading}
                        style={{ marginTop: 4 }}
                    />
                </View>
            </FadeInView>
        );

        if (isArrived) return (
            <FadeInView delay={100}>
                {/* Inspection Code Entry */}
                <View style={[styles.phaseCard, { borderColor: tTheme.brand.primary + '44' }]}>
                    <View style={styles.phaseHeader}>
                        <View style={[styles.phaseIconBox, { backgroundColor: tTheme.brand.primary + '15' }]}>
                            <Text style={{ fontSize: 24 }}>🔐</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.phaseMeta}>VERIFICATION PHASE</Text>
                            <Text style={styles.phaseTitle}>Secure Arrival</Text>
                        </View>
                        {inspectionExpirySeconds !== null && (
                            <View style={[styles.countdownBox, { borderColor: tTheme.brand.primary + '44' }]}>
                                <Text style={[styles.countdownVal, { color: tTheme.brand.primary }]}>
                                    {formatTime(inspectionExpirySeconds)}
                                </Text>
                                <Text style={styles.countdownLbl}>LEFT</Text>
                            </View>
                        )}
                    </View>

                    <View style={[styles.instructBanner, { backgroundColor: tTheme.brand.primary + '08', borderColor: tTheme.brand.primary + '22' }]}>
                        <Text style={[styles.instructIcon]}>📱</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.instructTitle, { color: tTheme.brand.primary }]}>ASK THE CUSTOMER FOR THEIR CODE</Text>
                            <Text style={styles.instructSub}>The client's app shows a 4-digit inspection code. Ask them to share it with you.</Text>
                        </View>
                    </View>

                    <Text style={styles.otpInputLabel}>ENTER INSPECTION CODE</Text>
                    <OTPInput
                        disabled={actionLoading}
                        onChange={(code) => setInspectionOtp(code.split('').concat(Array(4).fill('')).slice(0, 4))}
                    />

                    <PremiumButton
                        title="Verify & Begin Inspection"
                        onPress={handleVerifyInspectionOtp}
                        loading={actionLoading}
                        disabled={inspectionOtp.join('').length < 4}
                        style={{ marginTop: 16 }}
                    />
                </View>
            </FadeInView>
        );

        if (isInspection) return (
            <FadeInView delay={100}>
                {/* Estimate Submission Form */}
                <View style={[styles.phaseCard, { borderColor: '#00E0FF33' }]}>
                    <View style={styles.phaseHeader}>
                        <View style={[styles.phaseIconBox, { backgroundColor: '#00E0FF15' }]}>
                            <Text style={{ fontSize: 24 }}>📋</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.phaseMeta}>ASSESSMENT PHASE</Text>
                            <Text style={styles.phaseTitle}>Service Estimate</Text>
                        </View>
                        <View style={[styles.timerBadge, { borderColor: '#00E0FF55' }]}>
                            <Text style={[styles.timerTxt, { color: '#00E0FF' }]}>{formatTime(timeElapsed)}</Text>
                            <Text style={[styles.timerLbl, { color: '#00E0FF88' }]}>ELAPSED</Text>
                        </View>
                    </View>

                    <Text style={[styles.phaseSub, { marginBottom: 16 }]}>
                        Inspect the issue and fill out your professional assessment below.
                    </Text>

                    <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>ESTIMATED TIME (MINUTES)</Text>
                        <View style={styles.formInputRow}>
                            <TextInput
                                style={[styles.formInput, { flex: 1 }]}
                                keyboardType="numeric"
                                placeholder="e.g. 90"
                                placeholderTextColor={tTheme.text.tertiary}
                                value={estimateData.minutes}
                                onChangeText={(v) => setEstimateData(p => ({ ...p, minutes: v }))}
                            />
                            <View style={styles.unitBox}>
                                <Text style={styles.unitTxt}>MIN</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>FINDINGS & NOTES</Text>
                        <TextInput
                            style={styles.formTextArea}
                            multiline
                            placeholder="Describe the issue and proposed fix…"
                            placeholderTextColor={tTheme.text.tertiary}
                            value={estimateData.notes}
                            onChangeText={(v) => setEstimateData(p => ({ ...p, notes: v }))}
                        />
                    </View>

                    <PremiumButton
                        title="Send Estimate to Client →"
                        onPress={handleSubmitEstimate}
                        loading={actionLoading}
                        disabled={!estimateData.minutes}
                        style={{ marginTop: 8 }}
                    />

                    <PremiumButton
                        title={`Request +10 min Inspection Time (${job?.inspection_extension_count || 0}/2 used)`}
                        variant="secondary"
                        onPress={handleRequestInspectionExtension}
                        loading={actionLoading}
                        disabled={
                            actionLoading ||
                            inspectExtRequested ||
                            parseInt(job?.inspection_extension_count || 0, 10) >= 2
                        }
                        style={{ marginTop: 10 }}
                    />

                    {inspectExtOtp && (
                        <View style={{ marginTop: 12, alignItems: 'center', backgroundColor: tTheme.brand.primary + '08', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: tTheme.brand.primary + '15' }}>
                            <Text style={{ color: tTheme.text.tertiary, fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8 }}>SHARE THIS CODE TO APPROVE +10 MIN:</Text>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                {inspectExtOtp.split('').map((digit, idx) => (
                                    <View key={idx} style={{ width: 44, height: 52, borderRadius: 12, backgroundColor: tTheme.background.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: tTheme.brand.primary + '33' }}>
                                        <Text style={{ color: tTheme.brand.primary, fontSize: 22, fontWeight: '900' }}>{digit}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {inspectExtRequested && !inspectExtOtp && (
                        <Text style={[styles.phaseSub, { marginTop: 8, color: tTheme.status?.warning?.base }]}>Extension request sent. Ask customer to approve OTP in their app.</Text>
                    )}
                </View>
            </FadeInView>
        );

        if (isEstimateSubmitted) return (
            <FadeInView delay={100}>
                {/* Waiting for customer approval + Start OTP entry */}
                <View style={[styles.phaseCard, { borderColor: tTheme.status?.warning?.base + '44' }]}>
                    <View style={styles.phaseHeader}>
                        <Animated.View style={[styles.phaseIconBox, { backgroundColor: tTheme.status?.warning?.base + '15', transform: [{ scale: pulseAnim }] }]}>
                            <Text style={{ fontSize: 24 }}>⏳</Text>
                        </Animated.View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.phaseMeta}>AWAITING APPROVAL</Text>
                            <Text style={styles.phaseTitle}>Estimate Sent</Text>
                        </View>
                    </View>

                    <View style={[styles.instructBanner, { backgroundColor: tTheme.status?.warning?.base + '08', borderColor: tTheme.status?.warning?.base + '22' }]}>
                        <Text style={{ fontSize: 18 }}>📲</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.instructTitle, { color: tTheme.status?.warning?.base }]}>WAITING FOR CLIENT DECISION</Text>
                            <Text style={styles.instructSub}>The customer is reviewing your estimate. Once approved, they'll share the Start Code with you.</Text>
                        </View>
                    </View>

                    <View style={[styles.dividerLine, { marginVertical: 16 }]} />

                    <Text style={styles.otpInputLabel}>
                        ENTER START CODE WHEN CLIENT APPROVES
                        {otpExpirySeconds !== null ? ` — Expires in ${formatTime(otpExpirySeconds)}` : ''}
                    </Text>
                    <OTPInput
                        disabled={actionLoading}
                        onChange={(code) => setStartOtp(code.split('').concat(Array(4).fill('')).slice(0, 4))}
                    />
                    <PremiumButton
                        title="Start Billable Session →"
                        onPress={handleVerifyStartOtp}
                        loading={actionLoading}
                        disabled={startOtp.join('').length < 4}
                        style={{ marginTop: 8 }}
                    />
                </View>
            </FadeInView>
        );

        if (isInProgress) return (
            <FadeInView delay={100}>
                {/* Active Session */}
                <View style={[styles.phaseCard, { borderColor: tTheme.status?.success?.base + '33' }]}>
                    <View style={styles.phaseHeader}>
                        <View style={[styles.phaseIconBox, { backgroundColor: tTheme.status?.success?.base + '15' }]}>
                            <Text style={{ fontSize: 24 }}>🔧</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.phaseMeta}>ACTIVE SESSION</Text>
                            <Text style={styles.phaseTitle}>Work In Progress</Text>
                        </View>
                    </View>

                    {/* Big timer */}
                    <View style={styles.bigTimerWrap}>
                        <Text style={[styles.bigTimerVal, { color: tTheme.status?.success?.base }]}>
                            {formatTime(timeElapsed)}
                        </Text>
                        <View style={[styles.liveBadge, { backgroundColor: tTheme.status?.success?.base + '11', borderColor: tTheme.status?.success?.base + '33', borderWidth: 1 }]}>
                            <View style={[styles.liveDot, { backgroundColor: tTheme.status?.success?.base }]} />
                            <Text style={[styles.liveTxt, { color: tTheme.status?.success?.base }]}>LIVE BILLING</Text>
                        </View>
                    </View>

                    {job?.hourly_rate && (
                        <View style={styles.costRow}>
                            <Text style={styles.costLabel}>Rate</Text>
                            <Text style={styles.costVal}>₹{job.hourly_rate}/hr</Text>
                            <Text style={styles.costSep}>·</Text>
                            <Text style={styles.costLabel}>Est. Total</Text>
                            <Text style={[styles.costVal, { color: tTheme.status?.success?.base }]}>
                                ₹{Math.round(parseFloat(job.hourly_rate) * timeElapsed / 3600)}
                            </Text>
                        </View>
                    )}

                    {/* Actions row */}
                    <View style={{ gap: 10 }}>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <PremiumButton
                                title="Extension"
                                variant="secondary"
                                onPress={() => navigation.navigate('ExtensionRequest', { jobId })}
                                disabled={actionLoading}
                                style={{ flex: 1 }}
                            />
                            <TouchableOpacity
                                style={[styles.stopBtn]}
                                onPress={() => setStopSheetVisible(true)}
                                activeOpacity={0.8}
                            >
                                <Text style={{ fontSize: 18 }}>⏸</Text>
                                <Text style={styles.stopBtnTxt}>Stop / Pause</Text>
                            </TouchableOpacity>
                        </View>
                        <PremiumButton
                            title="Mark Work Complete ✓"
                            onPress={handleMarkComplete}
                            loading={actionLoading}
                        />
                    </View>
                </View>
            </FadeInView>
        );

        // ── PAUSE REQUESTED ────────────────────────────────────────────────────
        if (status === 'pause_requested') return (
            <FadeInView delay={100}>
                <View style={[styles.phaseCard, { borderColor: '#F59E0B44', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 40, marginBottom: 8 }}>⏸</Text>
                    <Text style={[styles.phaseTitle, { color: '#F59E0B', textAlign: 'center' }]}>Pause Requested</Text>
                    <Text style={[styles.phaseSub, { textAlign: 'center', marginBottom: 16 }]}>
                        Waiting for customer to approve the pause with their OTP. Timer is still running.
                    </Text>
                    <View style={[styles.liveBadge, { backgroundColor: '#F59E0B11', borderColor: '#F59E0B33', borderWidth: 1 }]}>
                        <ActivityIndicator size="small" color="#F59E0B" />
                        <Text style={[styles.liveTxt, { color: '#F59E0B', marginLeft: 6 }]}>AWAITING CUSTOMER OTP</Text>
                    </View>
                </View>
            </FadeInView>
        );

        // ── WORK PAUSED ────────────────────────────────────────────────────────
        if (status === 'work_paused') return (
            <FadeInView delay={100}>
                <View style={[styles.phaseCard, { borderColor: '#F59E0B44', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 40, marginBottom: 8 }}>🟡</Text>
                    <Text style={[styles.phaseTitle, { color: '#F59E0B', textAlign: 'center' }]}>Work Paused</Text>
                    <Text style={[styles.phaseSub, { textAlign: 'center', marginBottom: 4 }]}>
                        Reason: {job?.pause_reason || '—'}
                    </Text>
                    <Text style={[styles.phaseSub, { textAlign: 'center', marginBottom: 16, fontSize: 11 }]}>
                        Timer is paused. Customer must approve resume OTP to restart.
                    </Text>
                    <PremiumButton
                        title="▶ Request Resume"
                        onPress={handleRequestResume}
                        loading={actionLoading}
                    />
                </View>
            </FadeInView>
        );

        // ── RESUME REQUESTED ───────────────────────────────────────────────────
        if (status === 'resume_requested') return (
            <FadeInView delay={100}>
                <View style={[styles.phaseCard, { borderColor: '#22c55e44', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 40, marginBottom: 8 }}>▶</Text>
                    <Text style={[styles.phaseTitle, { color: '#22c55e', textAlign: 'center' }]}>Resume Requested</Text>
                    <Text style={[styles.phaseSub, { textAlign: 'center', marginBottom: 16 }]}>
                        Waiting for customer to enter their resume OTP to restart the timer.
                    </Text>
                    <View style={[styles.liveBadge, { backgroundColor: '#22c55e11', borderColor: '#22c55e33', borderWidth: 1 }]}>
                        <ActivityIndicator size="small" color="#22c55e" />
                        <Text style={[styles.liveTxt, { color: '#22c55e', marginLeft: 6 }]}>AWAITING CUSTOMER OTP</Text>
                    </View>
                </View>
            </FadeInView>
        );

        // ── SUSPEND REQUESTED ──────────────────────────────────────────────────
        if (status === 'suspend_requested') return (
            <FadeInView delay={100}>
                <View style={[styles.phaseCard, { borderColor: '#8B5CF644', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 40, marginBottom: 8 }}>📅</Text>
                    <Text style={[styles.phaseTitle, { color: '#8B5CF6', textAlign: 'center' }]}>Reschedule Requested</Text>
                    <Text style={[styles.phaseSub, { textAlign: 'center', marginBottom: 4 }]}>
                        Proposed: {job?.suspend_reschedule_at ? new Date(job.suspend_reschedule_at).toLocaleString() : '—'}
                    </Text>
                    <Text style={[styles.phaseSub, { textAlign: 'center', marginBottom: 16, fontSize: 11 }]}>
                        Waiting for customer to approve with their OTP. Today's work will be billed on approval.
                    </Text>
                    <View style={[styles.liveBadge, { backgroundColor: '#8B5CF611', borderColor: '#8B5CF633', borderWidth: 1 }]}>
                        <ActivityIndicator size="small" color="#8B5CF6" />
                        <Text style={[styles.liveTxt, { color: '#8B5CF6', marginLeft: 6 }]}>AWAITING CUSTOMER OTP</Text>
                    </View>
                </View>
            </FadeInView>
        );

        // ── CUSTOMER STOPPING ─────────────────────────────────────────────────
        if (status === 'customer_stopping') return (
            <FadeInView delay={100}>
                <View style={[styles.phaseCard, { borderColor: '#EF444444', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 40, marginBottom: 8 }}>⛔</Text>
                    <Text style={[styles.phaseTitle, { color: '#EF4444', textAlign: 'center' }]}>Customer Stopping Work</Text>
                    <Text style={[styles.phaseSub, { textAlign: 'center', marginBottom: 4 }]}>
                        The customer has requested to stop. You have a 5-minute safe-stop window — wrap up safely.
                    </Text>
                    <Text style={[styles.phaseSub, { textAlign: 'center', marginBottom: 16, fontSize: 11, color: '#F59E0B' }]}>
                        Timer is frozen. You will be billed for actual elapsed time.
                    </Text>
                </View>
            </FadeInView>
        );

        if (isPending) return (
            <FadeInView delay={100}>
                {/* End OTP display */}
                <View style={[styles.phaseCard, { borderColor: tTheme.status?.success?.base + '33', alignItems: 'center' }]}>
                    <View style={styles.phaseHeader}>
                        <View style={[styles.phaseIconBox, { backgroundColor: tTheme.status?.success?.base + '15' }]}>
                            <Text style={{ fontSize: 24 }}>✅</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.phaseMeta}>AWAITING CONFIRMATION</Text>
                            <Text style={styles.phaseTitle}>Share Completion Code</Text>
                        </View>
                    </View>

                    <Text style={[styles.phaseSub, { textAlign: 'center', marginBottom: 4 }]}>
                        Show this code to your client. They will enter it to confirm work completion and trigger the payment.
                    </Text>

                    <EndOtpDigits code={endOtp} />

                    <View style={[styles.liveBadge, { marginTop: 8, backgroundColor: '#00E0FF11', borderColor: '#00E0FF33', borderWidth: 1 }]}>
                        <ActivityIndicator size="small" color="#00E0FF" />
                        <Text style={[styles.liveTxt, { color: '#00E0FF', marginLeft: 6 }]}>Awaiting client confirmation</Text>
                    </View>
                </View>
            </FadeInView>
        );

        if (isCompleted) return (
            <FadeInView delay={100}>
                <View style={[styles.phaseCard, { borderColor: tTheme.status?.success?.base + '44', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 56, marginBottom: 8 }}>🎉</Text>
                    <Text style={[styles.phaseTitle, { color: tTheme.status?.success?.base, textAlign: 'center' }]}>
                        {status === 'completed' ? 'Session Complete!' : 'Session Ended'}
                    </Text>
                    <Text style={[styles.phaseSub, { textAlign: 'center', marginBottom: 16 }]}>
                        {status === 'completed'
                            ? 'Great work! The payment has been initiated. Check your wallet for the credit.'
                            : 'This session has been closed.'}
                    </Text>
                    {job?.final_amount && (
                        <View style={[styles.earningsBox, { borderColor: tTheme.status?.success?.base + '44' }]}>
                            <Text style={styles.earningsLabel}>EARNED</Text>
                            <Text style={[styles.earningsAmount, { color: tTheme.status?.success?.base }]}>
                                ₹{parseFloat(job.final_amount).toFixed(0)}
                            </Text>
                        </View>
                    )}
                    <PremiumButton
                        variant="secondary"
                        title="Back to Dashboard"
                        onPress={() => navigation.navigate('WorkerTabs')}
                        style={{ marginTop: 8 }}
                    />
                </View>
            </FadeInView>
        );

        return null;
    };

    if (loading) return (
        <MainBackground>
            <View style={styles.loadingScreen}>
                <ActivityIndicator size="large" color={tTheme.brand.primary} />
                <Text style={styles.loadingTxt}>Syncing job session…</Text>
            </View>
        </MainBackground>
    );

    const canChat = ['assigned', 'worker_en_route', 'worker_arrived', 'inspection_active', 'estimate_submitted', 'in_progress', 'pending_completion'].includes(status);

    return (
        <MainBackground>
            {/* Header */}
            <View style={styles.header}>
                <PressableAnimated
                    onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace('WorkerTabs')}
                    style={styles.headerBtn}
                >
                    <Text style={styles.headerBtnTxt}>←</Text>
                </PressableAnimated>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>LIVE OPERATIONS</Text>
                    <View style={styles.statusPillWrap}>
                        <StatusPill status={status} />
                    </View>
                </View>
                {canChat && job ? (
                    <PressableAnimated
                        style={styles.chatBtn}
                        onPress={() => navigation.navigate('Chat', { jobId, userRole: 'worker', otherUserId: job.customer_id })}
                    >
                        <Text style={{ fontSize: 20 }}>💬</Text>
                        {chatUnread > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeTxt}>{chatUnread}</Text>
                            </View>
                        )}
                    </PressableAnimated>
                ) : <View style={{ width: 44 }} />}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

                {/* Client info card */}
                {job && (
                    <FadeInView delay={50}>
                        <View style={styles.clientCard}>
                            <View style={styles.clientRow}>
                                <View style={styles.clientAvatar}>
                                    <Text style={styles.avatarTxt}>{job?.customer_name?.charAt(0) || 'C'}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.clientLabel}>CLIENT</Text>
                                    <Text style={styles.clientName}>{job?.customer_name || 'Client'}</Text>
                                    <Text style={styles.clientCat}>{job?.category}</Text>
                                </View>
                                <TouchableOpacity style={styles.callChip} onPress={handleCall}>
                                    <Text style={{ fontSize: 14 }}>📞</Text>
                                    <Text style={styles.callChipTxt}>Call</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity style={styles.addrRow} onPress={handleNavigate} activeOpacity={0.7}>
                                <Text style={{ fontSize: 14, marginRight: 8 }}>📍</Text>
                                <Text style={styles.addrTxt} numberOfLines={2}>{job?.address || '—'}</Text>
                                <Text style={[styles.navChip]}>🧭 Go</Text>
                            </TouchableOpacity>
                        </View>
                    </FadeInView>
                )}

                {/* Phase Card */}
                {renderPhaseCard()}

            </ScrollView>

            {/* ── Stop / Pause Bottom Sheet ─────────────────────────────────── */}
            <Modal
                visible={stopSheetVisible}
                transparent
                animationType="slide"
                onRequestClose={() => { setStopSheetVisible(false); setIsPauseMode(null); }}
            >
                <View style={styles.sheetOverlay}>
                    <View style={styles.sheetContainer}>
                        <Text style={styles.sheetTitle}>Stop / Pause Work?</Text>
                        <Text style={styles.sheetSub}>What would you like to do?</Text>

                        {isPauseMode === null && (
                            <View style={{ gap: 12, marginTop: 8 }}>
                                <TouchableOpacity style={styles.sheetChoiceCard} onPress={() => setIsPauseMode('reschedule')} activeOpacity={0.85}>
                                    <Text style={{ fontSize: 28 }}>📅</Text>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.sheetChoiceTitle}>Reschedule for Later</Text>
                                        <Text style={styles.sheetChoiceSub}>Can't finish today. Pick a new date/time — customer approves via OTP.</Text>
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.sheetChoiceCard} onPress={() => setIsPauseMode('pause')} activeOpacity={0.85}>
                                    <Text style={{ fontSize: 28 }}>⏸</Text>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.sheetChoiceTitle}>Short Pause</Text>
                                        <Text style={styles.sheetChoiceSub}>Resume today. Max 30 min+2 pauses. Customer approves via OTP.</Text>
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setStopSheetVisible(false)} style={styles.sheetCancel}>
                                    <Text style={styles.sheetCancelTxt}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {isPauseMode === 'pause' && (
                            <View style={{ gap: 12, marginTop: 8 }}>
                                <Text style={styles.formLabel}>REASON FOR PAUSE</Text>
                                <TextInput
                                    style={styles.formInput}
                                    placeholder="e.g. need to fetch a part..."
                                    placeholderTextColor={tTheme?.text?.tertiary || '#666'}
                                    value={pauseReason}
                                    onChangeText={setPauseReason}
                                    multiline
                                />
                                <PremiumButton
                                    title="Request Pause (Customer OTP Required)"
                                    onPress={handleRequestPause}
                                    loading={actionLoading}
                                    disabled={!pauseReason.trim()}
                                />
                                <TouchableOpacity onPress={() => setIsPauseMode(null)} style={styles.sheetCancel}>
                                    <Text style={styles.sheetCancelTxt}>← Back</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {isPauseMode === 'reschedule' && (
                            <View style={{ gap: 12, marginTop: 8 }}>
                                <Text style={styles.formLabel}>RESCHEDULE TO</Text>
                                <TouchableOpacity
                                    style={styles.datePickerBtn}
                                    onPress={handlePickRescheduleDate}
                                    activeOpacity={0.8}
                                >
                                    <Text style={{ fontSize: 20 }}>📅</Text>
                                    <Text style={styles.datePickerTxt}>
                                        {rescheduleDate.toLocaleDateString()} at {rescheduleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                    <Text style={{ fontSize: 12, color: tTheme?.brand?.primary || '#8B5CF6' }}>Change</Text>
                                </TouchableOpacity>
                                <Text style={styles.formLabel}>REASON</Text>
                                <TextInput
                                    style={styles.formInput}
                                    placeholder="e.g. major repair needed, returning tomorrow..."
                                    placeholderTextColor={tTheme?.text?.tertiary || '#666'}
                                    value={rescheduleReason}
                                    onChangeText={setRescheduleReason}
                                    multiline
                                />
                                <PremiumButton
                                    title="Request Reschedule (Customer OTP Required)"
                                    onPress={handleRequestSuspend}
                                    loading={actionLoading}
                                    disabled={!rescheduleReason.trim()}
                                />
                                <TouchableOpacity onPress={() => setIsPauseMode(null)} style={styles.sheetCancel}>
                                    <Text style={styles.sheetCancelTxt}>← Back</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {/* ── Materials Declaration Modal ───────────────────────────────── */}
            <Modal
                visible={materialsVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setMaterialsVisible(false)}
            >
                <View style={styles.sheetOverlay}>
                    <View style={styles.sheetContainer}>
                        <Text style={styles.sheetTitle}>🔩 Materials Used</Text>
                        <Text style={styles.sheetSub}>Declare any materials or parts used. These will be added to the customer's bill.</Text>

                        <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
                            {materials.map((item, i) => (
                                <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                                    <TextInput
                                        style={[styles.formInput, { flex: 2 }]}
                                        placeholder="Item name"
                                        placeholderTextColor={tTheme?.text?.tertiary || '#666'}
                                        value={item.name}
                                        onChangeText={(v) => {
                                            const updated = [...materials];
                                            updated[i] = { ...updated[i], name: v };
                                            setMaterials(updated);
                                        }}
                                    />
                                    <TextInput
                                        style={[styles.formInput, { flex: 1 }]}
                                        placeholder="₹ Amount"
                                        placeholderTextColor={tTheme?.text?.tertiary || '#666'}
                                        keyboardType="numeric"
                                        value={item.amount}
                                        onChangeText={(v) => {
                                            const updated = [...materials];
                                            updated[i] = { ...updated[i], amount: v };
                                            setMaterials(updated);
                                        }}
                                    />
                                </View>
                            ))}
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.sheetCancel}
                            onPress={() => setMaterials([...materials, { name: '', amount: '' }])}
                        >
                            <Text style={[styles.sheetCancelTxt, { color: tTheme?.brand?.primary || '#8B5CF6' }]}>+ Add Another Item</Text>
                        </TouchableOpacity>

                        <View style={{ gap: 10, marginTop: 12 }}>
                            <PremiumButton
                                title="Submit Materials & Continue"
                                onPress={() => handleSubmitMaterials(false)}
                                loading={actionLoading}
                            />
                            <TouchableOpacity onPress={() => handleSubmitMaterials(true)} style={styles.sheetCancel}>
                                <Text style={styles.sheetCancelTxt}>No Materials — Skip</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

        </MainBackground>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1 },
    loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingTxt: { color: t.text.tertiary, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },

    // Header
    header: {
        paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.background.surface, justifyContent: 'center', alignItems: 'center' },
    headerBtnTxt: { color: t.text.primary, fontSize: 20 },
    headerCenter: { alignItems: 'center', gap: 4 },
    headerTitle: { color: t.brand.primary, fontSize: 9, fontWeight: '900', letterSpacing: 3 },
    statusPillWrap: { transform: [{ scale: 0.85 }] },
    chatBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.background.surface, justifyContent: 'center', alignItems: 'center', position: 'relative' },
    badge: { position: 'absolute', top: -4, right: -4, backgroundColor: t.status.error.base, minWidth: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3, borderWidth: 2, borderColor: t.background.app },
    badgeTxt: { color: '#FFF', fontSize: 9, fontWeight: '900' },

    scroll: { paddingBottom: 120 },

    // Client card
    clientCard: {
        marginHorizontal: 16, marginBottom: 12,
        backgroundColor: t.background.surface, borderRadius: 20, padding: 16,
        borderWidth: 1, borderColor: t.border.default + '22',
        gap: 12,
        ...t.shadows?.premium,
    },
    clientRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    clientAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: t.brand.primary + '15', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: t.brand.primary + '22' },
    avatarTxt: { color: t.brand.primary, fontSize: 22, fontWeight: '900' },
    clientLabel: { color: t.text.tertiary, fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 2 },
    clientName: { color: t.text.primary, fontSize: 16, fontWeight: '900' },
    clientCat: { color: t.text.secondary, fontSize: 11, marginTop: 1, textTransform: 'capitalize' },
    callChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: t.background.surfaceRaised, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: t.border.default + '22' },
    callChipTxt: { color: t.text.secondary, fontSize: 11, fontWeight: '700' },
    addrRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.background.app, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: t.border.default + '15' },
    addrTxt: { color: t.text.secondary, fontSize: 13, flex: 1, lineHeight: 18 },
    navChip: { color: t.brand.primary, fontSize: 11, fontWeight: '700', marginLeft: 8, backgroundColor: t.brand.primary + '11', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },

    // Phase cards
    phaseCard: {
        marginHorizontal: 16, marginBottom: 12,
        backgroundColor: t.background.surface, borderRadius: 20, padding: 20,
        borderWidth: 1, borderColor: t.border.default + '22',
        ...t.shadows?.premium,
    },
    phaseHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    phaseIconBox: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
    phaseMeta: { color: t.text.tertiary, fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 2 },
    phaseTitle: { color: t.text.primary, fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
    phaseSub: { color: t.text.secondary, fontSize: 13, lineHeight: 18 },

    // instruc banner
    instructBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 14 },
    instructIcon: { fontSize: 18, marginTop: 1 },
    instructTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 2 },
    instructSub: { color: t.text.tertiary, fontSize: 11, lineHeight: 16 },

    // OTP input area
    otpInputLabel: { color: t.text.tertiary, fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 8, textAlign: 'center' },

    // countdown
    countdownBox: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1.5 },
    countdownVal: { fontSize: 18, fontWeight: '900' },
    countdownLbl: { fontSize: 8, fontWeight: '900', letterSpacing: 1.5, color: t.text.muted },

    // timer badge (small)
    timerBadge: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5 },
    timerTxt: { fontSize: 16, fontWeight: '900', letterSpacing: 1 },
    timerLbl: { fontSize: 8, fontWeight: '800', letterSpacing: 1.5, marginTop: 1 },

    // big timer (in_progress)
    bigTimerWrap: { alignItems: 'center', marginVertical: 20, gap: 10 },
    bigTimerVal: { fontSize: 62, fontWeight: '900', letterSpacing: 2, fontVariant: ['tabular-nums'] },

    // cost row
    costRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
    costLabel: { color: t.text.tertiary, fontSize: 12, fontWeight: '700' },
    costVal: { color: t.text.primary, fontSize: 14, fontWeight: '900' },
    costSep: { color: t.text.tertiary, fontSize: 16 },

    // estimate form
    formGroup: { marginBottom: 14 },
    formLabel: { color: t.text.tertiary, fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 6 },
    formInputRow: { flexDirection: 'row', gap: 8 },
    formInput: { backgroundColor: t.background.app, color: t.text.primary, borderRadius: 12, borderWidth: 1, borderColor: t.border.default + '44', paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontWeight: '700' },
    unitBox: { backgroundColor: t.brand.primary + '15', paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center', borderWidth: 1, borderColor: t.brand.primary + '22' },
    unitTxt: { color: t.brand.primary, fontWeight: '900', fontSize: 12, letterSpacing: 1 },
    formTextArea: { backgroundColor: t.background.app, color: t.text.primary, borderRadius: 12, borderWidth: 1, borderColor: t.border.default + '44', paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, minHeight: 100, textAlignVertical: 'top', lineHeight: 20 },

    // divider
    dividerLine: { height: 1, backgroundColor: t.border.default + '22' },

    // live badge
    liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    liveDot: { width: 6, height: 6, borderRadius: 3 },
    liveTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },

    // action row (assigned phase)
    actionRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
    iconActionBtn: { flex: 1, alignItems: 'center', gap: 6, backgroundColor: t.background.surfaceRaised, borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: t.border.default + '22' },
    iconActionTxt: { color: t.text.secondary, fontSize: 11, fontWeight: '700' },

    // address box
    addressBox: { backgroundColor: t.background.app, borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: t.border.default + '15' },
    addressLabel: { color: t.text.tertiary, fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
    addressText: { color: t.text.primary, fontSize: 14, fontWeight: '600', lineHeight: 20 },

    // earnings
    earningsBox: { alignItems: 'center', backgroundColor: t.background.surfaceRaised, borderRadius: 16, paddingHorizontal: 32, paddingVertical: 20, borderWidth: 1.5, marginVertical: 8 },
    earningsLabel: { color: t.text.tertiary, fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
    earningsAmount: { fontSize: 48, fontWeight: '900', letterSpacing: 1 },

    // Stop / Pause button (in_progress row)
    stopBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EF444415', borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: '#EF444444' },
    stopBtnTxt: { color: '#EF4444', fontWeight: '800', fontSize: 13 },

    // Modal sheet
    sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
    sheetContainer: { backgroundColor: t.background.surfaceRaised, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44 },
    sheetTitle: { color: t.text.primary, fontSize: 20, fontWeight: '900', marginBottom: 4 },
    sheetSub: { color: t.text.tertiary, fontSize: 12, marginBottom: 16, lineHeight: 18 },
    sheetChoiceCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: t.background.app, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: t.border.default + '33' },
    sheetChoiceTitle: { color: t.text.primary, fontSize: 15, fontWeight: '800', marginBottom: 3 },
    sheetChoiceSub: { color: t.text.tertiary, fontSize: 12, lineHeight: 17 },
    sheetCancel: { alignItems: 'center', paddingVertical: 12 },
    sheetCancelTxt: { color: t.text.tertiary, fontSize: 13, fontWeight: '700' },

    // Date picker button
    datePickerBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.background.app, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: t.border.default + '44' },
    datePickerTxt: { flex: 1, color: t.text.primary, fontSize: 14, fontWeight: '700' },
});
