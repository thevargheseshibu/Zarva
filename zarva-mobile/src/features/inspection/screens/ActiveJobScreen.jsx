import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTokens } from '@shared/design-system';
import {
    View, Text, ScrollView, Alert, Animated, Platform, Linking, ActivityIndicator
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { ref, onValue, off } from 'firebase/database';
import { useT } from '@shared/i18n/useTranslation';
import apiClient from '@infra/api/client';
import { useWorkerStore } from '@worker/store';
import { db } from '@infra/firebase/app';
import MainBackground from '@shared/ui/MainBackground';
import * as Location from 'expo-location';

// Modular Components
import { createActiveJobScreenStyles } from './ActiveJobScreenStyles';
import { FadeInView, EndOtpDigits } from '../components/ActiveJob/SharedUI';
import { ActiveJobHeader } from '../components/ActiveJob/ActiveJobHeader';
import { ClientInfoCard } from '../components/ActiveJob/ClientInfoCard';
import { ActiveJobModals } from '../components/ActiveJob/ActiveJobModals';
import { PhaseContent } from '../components/ActiveJob/PhaseContent';



// ── Main ─────────────────────────────────────────────────────────────────────
export default function ActiveJobScreen({ route, navigation }) {
    const tTheme = useTokens();
    const styles = useMemo(() => createActiveJobScreenStyles(tTheme), [tTheme]);
    const t = useT();
    const { jobId } = route.params || {};
    const [status, setStatus] = useState('assigned');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [job, setJob] = useState(null);
    const [inspectionOtp, setInspectionOtp] = useState(['', '', '', '']);
    const [estimateData, setEstimateData] = useState({ minutes: '', notes: '' });
    const [timeElapsed, setTimeElapsed] = useState(0);
    const [endOtp, setEndOtp] = useState(null); // null until server provides the real code
    const [inspectionExpirySeconds, setInspectionExpirySeconds] = useState(null);
    const [chatUnread, setChatUnread] = useState(0);
    const [actionOtp, setActionOtp] = useState(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // ── New lifecycle state ───────────────────────────────────────────────────
    const [stopSheetVisible, setStopSheetVisible] = useState(false);
    const [pauseReason, setPauseReason] = useState('');
    const [isPauseMode, setIsPauseMode] = useState(null); // 'pause' | 'reschedule'
    const [rescheduleDate, setRescheduleDate] = useState(new Date(Date.now() + 86400000));
    const [rescheduleReason, setRescheduleReason] = useState('');
    const [materialsVisible, setMaterialsVisible] = useState(false);
    const [materials, setMaterials] = useState([{ name: '', amount: '' }]);


    // Firebase listeners
    useEffect(() => {
        if (!jobId) return;
        let lastSeenStatus = null;
        let initialFetchDone = false;
        
        const jobRef = ref(db, `active_jobs/${jobId}`);
        const listener = onValue(jobRef, (snapshot) => {
            const data = snapshot.val();

            if (data) {
                // Determine status changes
                if (data.status) setStatus(data.status);
                
                // Reset actionOtp if status has moved past the request phase
                if (data.status && !['pause_requested', 'resume_requested', 'suspend_requested'].includes(data.status)) {
                    setActionOtp(null);
                }

                // Update local job state
                setJob(prev => ({ ...prev, ...data }));

                // Sync with store safely (not inside setJob updater to avoid react-warning/crashes)
                const currentJob = useWorkerStore.getState().activeJob;
                if (currentJob && currentJob.id == jobId) {
                    useWorkerStore.getState().setActiveJob({ ...currentJob, ...data });
                }

                // RE-FETCH FULL JOB ONLY IF STATUS CHANGED: 
                // Prevents infinite loops when ChatScreen pushes typing indicators to this same job node.
                if (!initialFetchDone || data.status !== lastSeenStatus) {
                    initialFetchDone = true;
                    lastSeenStatus = data.status;
                    fetchJob(true);
                }
            }
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

                // ⭐ NEW: Freeze timer at the estimated cap
                const capMinutes = job.billing_cap_minutes || job.estimated_duration_minutes;
                if (capMinutes > 0) {
                    const capSeconds = capMinutes * 60;
                    if (elapsed > capSeconds) {
                        elapsed = capSeconds; // Timer physically stops at the limit
                    }
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

    // Start OTP expiry countdown removed: customer starts job directly


    useEffect(() => {
        if (jobId) {
            console.log(`[ActiveJob] JobID changed to ${jobId}. Resetting states & fetching...`);
            // Reset phase-specific states for clean transition
            setEndOtp(null);
            fetchJob();
        }
    }, [jobId]);

    const fetchJob = async (quiet = false) => {
        try {
            if (!quiet) setLoading(true);
            const res = await apiClient.get(`/api/worker/jobs/${jobId}`);
            const data = res.data?.job;
            setJob(data);
            if (data.status) setStatus(data.status);
            if (data.end_otp) setEndOtp(data.end_otp);
            if (data.status) setStatus(data.status);
            if (data.end_otp) setEndOtp(data.end_otp);
        } catch (err) {
            console.log('[ActiveJob] Fetch error:', err.message);
            if (!quiet) Alert.alert('Error', 'Could not load job details.');
        } finally {
            if (!quiet) setLoading(false);
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

            const res = await apiClient.post(`/api/worker/jobs/${jobId}/arrived`);
            if (res.data?.skipped_inspection) {
                setStatus('estimate_submitted');
            } else {
                setStatus('worker_arrived');
            }
            await fetchJob(); // refresh to get inspection_expires_at or start_otp_generated_at
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

    // handleVerifyStartOtp removed: customer now starts job directly without OTP relay


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
            await fetchJob(true);
            Alert.alert('⏸ Work Paused', 'The timer has been paused successfully.');
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Could not pause.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRequestResume = async () => {
        setActionLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await apiClient.post(`/api/worker/jobs/${jobId}/resume-request`);
            await fetchJob(true);
            Alert.alert('▶ Work Resumed', 'The timer has restarted.');
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Could not resume.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRequestSuspend = async () => {
        if (!rescheduleReason.trim()) return Alert.alert('Required', 'Please provide a reason.');
        setActionLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            const res = await apiClient.post(`/api/worker/jobs/${jobId}/suspend-request`, {
                reason: rescheduleReason,
                reschedule_at: rescheduleDate.toISOString(),
            });
            // REMOVED: setActionOtp for suspend as OTP is no longer required for rescheduling
            setStopSheetVisible(false);
            setIsPauseMode(null);
            setRescheduleReason('');
            await fetchJob(true);
            Alert.alert('📅 Reschedule Requested', 'The customer will be notified to approve your proposal.');
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Could not request reschedule.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleStartTravel = async () => {
        setActionLoading(true);
        try {
            await apiClient.post(`/api/worker/jobs/${jobId}/start-travel`);
            setStatus('worker_en_route');
            await fetchJob();
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to start travel.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleAcknowledgeStop = async () => {
        setActionLoading(true);
        try {
            const res = await apiClient.post(`/api/worker/jobs/${jobId}/acknowledge-stop`);
            setStatus('pending_completion');
            if (res.data?.end_otp) setEndOtp(res.data.end_otp);
            await fetchJob();
            setMaterialsVisible(true);
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Failed.');
        } finally {
            setActionLoading(false);
        }
    };

    const handlePickRescheduleDate = async () => {
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

        // Unified fallback for both iOS and Android to prevent legacy crashes
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
    };

    const handleSubmitMaterials = async (skip = false) => {
        setActionLoading(true);
        try {
            const validItems = skip ? [] : materials.filter(m => m.name.trim() && parseFloat(m.amount) > 0);
            await apiClient.post(`/api/worker/jobs/${jobId}/materials`, { items: validItems });
            setMaterialsVisible(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // ⭐ NEW: If customer stopped the job, finalize it instantly without asking for OTP
            if (status === 'customer_stopping' || job?.customer_stopped_at != null) {
                await apiClient.post(`/api/worker/jobs/${jobId}/finalize-direct`);
                setStatus('completed');
                navigation.navigate('JobCompleteSummary', { 
                    jobId,
                    isCustomerStopped: true
                });
            } else {
                // Normal completion flow (requires customer OTP later)
                navigation.navigate('JobCompleteSummary', { 
                    jobId,
                    isCustomerStopped: false
                });
            }
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Could not save materials.');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return (
        <MainBackground>
            <View style={styles.loadingScreen}>
                <ActivityIndicator size="large" color={tTheme?.brand?.primary || '#8B5CF6'} />
                <Text style={styles.loadingTxt}>INITIALIZING SECURE SESSION…</Text>
            </View>
        </MainBackground>
    );

    return (
        <MainBackground>
            <ActiveJobHeader 
                styles={styles} 
                navigation={navigation} 
                status={status} 
                chatUnread={chatUnread}
                handleChatPress={() => navigation.navigate('Chat', { jobId, userRole: 'worker', otherUserId: job?.customer_id, title: job?.customer_name })}
            />

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <ClientInfoCard 
                    styles={styles} 
                    job={job} 
                    handleCall={handleCall} 
                    handleNavigate={handleNavigate} 
                />

                <PhaseContent 
                    styles={styles}
                    tTheme={tTheme}
                    navigation={navigation}
                    jobId={jobId}
                    job={job}
                    status={status}
                    actionLoading={actionLoading}
                    timeElapsed={timeElapsed}
                    formatTime={formatTime}
                    pulseAnim={pulseAnim}
                    handleNavigate={handleNavigate}
                    handleCall={handleCall}
                    handleArrived={handleArrived}
                    handleVerifyInspectionOtp={handleVerifyInspectionOtp}
                    inspectionOtp={inspectionOtp}
                    setInspectionOtp={setInspectionOtp}
                    inspectionExpirySeconds={inspectionExpirySeconds}
                    estimateData={estimateData}
                    setEstimateData={setEstimateData}
                    handleSubmitEstimate={handleSubmitEstimate}
                    isInProgress={status === 'in_progress'}
                    setStopSheetVisible={setStopSheetVisible}
                    actionOtp={actionOtp}
                    handleRequestResume={handleRequestResume}
                    handleMarkComplete={handleMarkComplete}
                    isPending={status === 'pending_completion'}
                    endOtp={endOtp}
                    isCompleted={['completed', 'cancelled', 'no_worker_found'].includes(status)}
                    useWorkerStore={useWorkerStore}
                    handleStartTravel={handleStartTravel}
                    handleAcknowledgeStop={handleAcknowledgeStop}
                    setMaterialModalVisible={setMaterialsVisible}
                />
            </ScrollView>

            <ActiveJobModals 
                styles={styles}
                tTheme={tTheme}
                stopSheetVisible={stopSheetVisible}
                setStopSheetVisible={setStopSheetVisible}
                isPauseMode={isPauseMode}
                setIsPauseMode={setIsPauseMode}
                pauseReason={pauseReason}
                setPauseReason={setPauseReason}
                rescheduleDate={rescheduleDate}
                setRescheduleDate={setRescheduleDate}
                rescheduleReason={rescheduleReason}
                setRescheduleReason={setRescheduleReason}
                handlePauseSubmit={handleRequestPause}
                handleRescheduleSubmit={handleRequestSuspend}
                materialModalVisible={materialsVisible}
                setMaterialModalVisible={setMaterialsVisible}
                materialData={materials}
                setMaterialData={setMaterials}
                handleSubmitMaterials={handleSubmitMaterials}
                actionLoading={actionLoading}
            />
        </MainBackground>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
