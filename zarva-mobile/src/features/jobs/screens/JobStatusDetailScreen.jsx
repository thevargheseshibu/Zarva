import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTokens } from '@shared/design-system';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Image, BackHandler, Alert, Animated, Linking, Platform
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import dayjs from 'dayjs';
import { useT } from '@shared/i18n/useTranslation';
import { ref, onValue, off } from 'firebase/database';
import { db } from '@infra/firebase/app';
import { useJobStore } from '@jobs/store';
import apiClient from '@infra/api/client';
import { parseJobDescription } from '@shared/utils/jobParser';
import FadeInView from '@shared/ui/FadeInView';
import StatusPill from '@shared/ui/StatusPill';
import OTPInput from '@shared/ui/OTPInput';
import PremiumButton from '@shared/ui/PremiumButton';
import Card from '@shared/ui/ZCard';
import PressableAnimated from '@shared/design-system/components/PressableAnimated';
import MainBackground from '@shared/ui/MainBackground';

// ── Stage pipeline ──────────────────────────────────────────────────────────
const STAGES = [
    { key: 'searching', icon: '🔍', label: 'Finding' },
    { key: 'assigned', icon: '✅', label: 'Matched' },
    { key: 'worker_en_route', icon: '🛵', label: 'En Route' },
    { key: 'worker_arrived', icon: '📍', label: 'Arrived' },
    { key: 'estimate_submitted', icon: '📋', label: 'Estimate' },
    { key: 'in_progress', icon: '🔧', label: 'Working' },
    { key: 'pending_completion', icon: '✔️', label: 'Verify' },
    { key: 'completed', icon: '⭐', label: 'Done' },
];

// ── Live Map HTML (Leaflet) — accepts worker position via postMessage ────────
const buildMapHTML = (jobLat, jobLng, workerLat, workerLng) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html,body{padding:0;margin:0;background:#0A0A0B;height:100%;width:100%}
    #map{height:100vh;width:100vw}
    .leaflet-bar{border:none!important;box-shadow:none!important}
    .leaflet-control-attribution{display:none}
    .pulse{animation:pulse 2s infinite}
    @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.4)}}
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var jobLat=${jobLat || 10.0}, jobLng=${jobLng || 76.0};
  var workerLat=${workerLat || null}, workerLng=${workerLng || null};

  var map = L.map('map',{zoomControl:false,attributionControl:false})
    .setView([jobLat,jobLng],15);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(map);

  // Job pin
  var jobIcon = L.divIcon({
    className:'',
    html:'<div style="background:#BD00FF;width:14px;height:14px;border-radius:7px;border:2px solid #fff;box-shadow:0 0 12px #BD00FF88;"></div>',
    iconSize:[14,14],iconAnchor:[7,7]
  });
  var jobMarker = L.marker([jobLat,jobLng],{icon:jobIcon}).addTo(map);

  // Worker marker
  var workerMarker = null;
  var workerIcon = L.divIcon({
    className:'',
    html:'<div class="pulse" style="background:#00E0FF;width:18px;height:18px;border-radius:9px;border:2.5px solid #fff;box-shadow:0 0 18px #00E0FFAA;"></div>',
    iconSize:[18,18],iconAnchor:[9,9]
  });

  function placeWorker(lat,lng){
    if(!lat||!lng)return;
    if(workerMarker){workerMarker.setLatLng([lat,lng]);}
    else{workerMarker=L.marker([lat,lng],{icon:workerIcon}).addTo(map);}
    var bounds=L.latLngBounds([[jobLat,jobLng],[lat,lng]]);
    map.fitBounds(bounds,{padding:[48,48]});
  }

  if(workerLat&&workerLng) placeWorker(workerLat,workerLng);

  // React Native → WebView postMessage handler
  document.addEventListener('message',function(e){
    try{
      var d=JSON.parse(e.data);
      if(d.type==='UPDATE_WORKER'&&d.lat&&d.lng) placeWorker(d.lat,d.lng);
    }catch(err){}
  });
  window.addEventListener('message',function(e){
    try{
      var d=JSON.parse(e.data);
      if(d.type==='UPDATE_WORKER'&&d.lat&&d.lng) placeWorker(d.lat,d.lng);
    }catch(err){}
  });
</script>
</body>
</html>`;

// ── OTP Digit Display (read-only, ultra-premium) ─────────────────────────────
function OtpDisplay({ code, color }) {
    const tTheme = useTokens();
    const isPlaceholder = !code || code === '----';
    const cleanCode = isPlaceholder ? '----' : String(code);
    const digits = cleanCode.split('').slice(0, 4);
    // Ensure we always have 4 digits for rendering
    while (digits.length < 4) digits.push('-');
    return (
        <View style={{ alignItems: 'center', marginVertical: 8 }}>
            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center', marginVertical: 12 }}>
                {digits.map((d, i) => (
                    <View key={i} style={{
                        width: 64,
                        height: 76,
                        borderRadius: 16,
                        backgroundColor: (color || tTheme.brand.primary) + '0D',
                        borderWidth: isPlaceholder ? 1 : 2,
                        borderColor: isPlaceholder ? (color || tTheme.brand.primary) + '22' : (color || tTheme.brand.primary) + '99',
                        justifyContent: 'center',
                        alignItems: 'center',
                        shadowColor: color || tTheme.brand.primary,
                        shadowOpacity: isPlaceholder ? 0 : 0.4,
                        shadowRadius: 12,
                        elevation: isPlaceholder ? 0 : 6,
                    }}>
                        <Text style={{
                            color: isPlaceholder ? (color || tTheme.brand.primary) + '33' : (color || tTheme.brand.primary),
                            fontSize: 34,
                            fontWeight: '900',
                            letterSpacing: 1,
                            fontVariant: ['tabular-nums'],
                        }}>{d}</Text>
                    </View>
                ))}
            </View>
            {isPlaceholder && (
                <Text style={{ color: tTheme.text.tertiary, fontSize: 11, fontStyle: 'italic' }}>Loading code…</Text>
            )}
        </View>
    );
}

// ── Main Screen ─────────────────────────────────────────────────────────────
export default function JobStatusDetailScreen({ route, navigation }) {
    const tTheme = useTokens();
    const styles = useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const { jobId } = route.params || {};
    const { searchPhase, assignedWorker, clearActiveJob, startListening, stopListening } = useJobStore();
    const mapRef = useRef(null);
    const endOtpRef = useRef(null); // ref to clear OTP boxes on failed verification

    const [job, setJob] = useState(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [inspectionExpirySeconds, setInspectionExpirySeconds] = useState(null);
    const [verifyingEndOtp, setVerifyingEndOtp] = useState(false);
    const [typedEndOtp, setTypedEndOtp] = useState('');
    const [chatUnread, setChatUnread] = useState(0);
    const [workerLocation, setWorkerLocation] = useState(null); // { lat, lng }
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Prefer latest API job.status over store searchPhase to avoid stale phase/timer UI after transitions.
    const status = job?.status || searchPhase || 'searching';
    const currentStageIdx = STAGES.findIndex(s => s.key === status);
    const isMapStatus = ['assigned', 'worker_en_route', 'worker_arrived'].includes(status);

    // ── Pulse animation for searching ─────────────────────────────────
    useEffect(() => {
        if (status === 'searching') {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.15, duration: 900, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [status]);

    // ── Initial data load + Firebase listeners ─────────────────────────
    useEffect(() => {
        if (!jobId) return;
        fetchJobDetails();
        startListening(jobId);

        // Chat unread badge
        const chatRef = ref(db, `active_jobs/${jobId}/chat_unread/customer`);
        const chatListener = onValue(chatRef, snap => setChatUnread(snap.val() || 0));

        // Live worker GPS: listen to active_jobs/{jobId} root for worker_lat/worker_lng
        // The server also writes to worker_presence/{workerId} when the worker moves
        const jobRootRef = ref(db, `active_jobs/${jobId}`);
        const jobRootListener = onValue(jobRootRef, snap => {
            const data = snap.val();
            if (!data) return;
            const lat = data.worker_lat;
            const lng = data.worker_lng;
            if (lat && lng) {
                setWorkerLocation({ lat, lng });
                mapRef.current?.injectJavaScript(
                    `(function(){ var e=new MessageEvent('message',{data:JSON.stringify({type:'UPDATE_WORKER',lat:${lat},lng:${lng}})}); document.dispatchEvent(e); window.dispatchEvent(e); })(); true;`
                );
            }

            // Force refresh when inspection extension is requested so customer sees OTP approval card promptly.
            if (data.inspection_ext_pending === true) {
                fetchJobDetails();
            }

            // RE-FETCH ON STATUS CHANGE: Ensure we have latest OTPs and timestamps
            if (data.status) {
                fetchJobDetails();
            }
        });

        return () => {
            stopListening();
            off(chatRef, 'value', chatListener);
            off(jobRootRef, 'value', jobRootListener);
        };
    }, [jobId]);

    const isFetchingRef = useRef(false);
    const fetchJobDetails = async () => {
        if (isFetchingRef.current) return; // Prevent concurrent fetches overwriting state with stale data
        isFetchingRef.current = true;
        try {
            const res = await apiClient.get(`/api/jobs/${jobId}`);
            if (res.data?.job) setJob(res.data.job);
        } catch (err) {
            console.error('[JobStatus] fetch failed', err);
        } finally {
            isFetchingRef.current = false;
        }
    };

    // Re-fetch on key status changes to get OTP fields
    useEffect(() => {
        if ([
            'worker_arrived', 'estimate_submitted', 'in_progress',
            'pending_completion', 'pause_requested', 'work_paused',
            'resume_requested', 'suspend_requested', 'customer_stopping',
            'inspection_extension_requested',
        ].includes(status)) {
            fetchJobDetails();
        }
    }, [status]);



    // ── Elapsed timer ──────────────────────────────────────────────────
    useEffect(() => {
        let int;
        const tick = () => {
            if (!job) return;
            let total = 0;
            if (job.inspection_started_at) {
                const start = new Date(job.inspection_started_at).getTime();
                const end = job.inspection_ended_at ? new Date(job.inspection_ended_at).getTime() : Date.now();
                if (status === 'inspection_active' || job.inspection_ended_at)
                    total += Math.max(0, Math.floor((end - start) / 1000));
            }
            if (job.job_started_at) {
                const start = new Date(job.job_started_at).getTime();
                const end = job.job_ended_at ? new Date(job.job_ended_at).getTime() : Date.now();
                if (status === 'in_progress' || job.job_ended_at)
                    total += Math.max(0, Math.floor((end - start) / 1000));
            }
            setElapsedSeconds(total);
        };
        if (['inspection_active', 'in_progress'].includes(status) || job?.job_started_at) {
            tick(); int = setInterval(tick, 1000);
        }
        return () => clearInterval(int);
    }, [status, job]);

    // ── Inspection window countdown (including extended time) ─────────
    useEffect(() => {
        let int;
        const expiry = job?.inspection_extended_until || job?.inspection_expires_at;
        if (status === 'worker_arrived' && expiry) {
            const expiryMs = new Date(expiry).getTime();
            const tick = () => setInspectionExpirySeconds(Math.max(0, Math.floor((expiryMs - Date.now()) / 1000)));
            tick(); int = setInterval(tick, 1000);
        }
        return () => clearInterval(int);
    }, [status, job?.inspection_expires_at, job?.inspection_extended_until]);


    const formatTime = s => {
        const h = Math.floor(s / 3600).toString().padStart(2, '0');
        const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
        const ss = (s % 60).toString().padStart(2, '0');
        return h === '00' ? `${m}:${ss}` : `${h}:${m}:${ss}`;
    };

    // OTP input for extension/pause/resume/suspend approvals
    // We track the current OTP code in a single string for simplicity
    const [otpCode, setOtpCode] = useState('');
    const [otpActionLoading, setOtpActionLoading] = useState(false);
    const [billPreview, setBillPreview] = useState(null);
    const [billLoading, setBillLoading] = useState(false);

    const handleActionApproval = async (action, code) => {
        const finalCode = code || otpCode;
        if (action !== 'suspend' && finalCode.length < 4) {
            return Alert.alert('Enter Full OTP', 'Please enter all 4 digits.');
        }
        setOtpActionLoading(true);
        try {
            let endpoint;
            if (action === 'pause') endpoint = `/api/jobs/${jobId}/approve-pause`;
            else if (action === 'resume') endpoint = `/api/jobs/${jobId}/approve-resume`;
            else if (action === 'suspend') endpoint = `/api/jobs/${jobId}/approve-suspend`;
            else throw new Error('Unknown action');
            
            await apiClient.post(endpoint, action === 'suspend' ? {} : { otp: finalCode }, { useLoader: false });
            setOtpCode('');
            await fetchJobDetails();
            Alert.alert('✅ Approved', 'Your approval has been recorded.');
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Action failed. Try again.');
            setOtpCode('');
        } finally {
            setOtpActionLoading(false);
        }
    };


    const handleApproveEstimate = async () => {
        setOtpActionLoading(true);
        try {
            await apiClient.post(`/api/jobs/${jobId}/start`);
            await fetchJobDetails();
            Alert.alert('✅ Started', 'The job has officially started. The professional will begin work now.');
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to start job.');
        } finally {
            setOtpActionLoading(false);
        }
    };

    const handleVerifyCompletion = async (code) => {
        if (!code || code.length < 4 || verifyingEndOtp) return;
        setVerifyingEndOtp(true);
        let navigated = false;
        try {
            await apiClient.post(
                `/api/jobs/${jobId}/verify-end-otp`,
                { otp: code },
                { useLoader: false, _retry: true }
            );
            navigated = true;
            navigation.replace('Payment', { jobId });
        } catch (err) {
            if (!navigated) {
                const errData = err.response?.data;
                const title = errData?.code === 'INVALID_OTP' ? 'Invalid Code' : 'Error';
                const message = errData?.message || t('invalid_code') || 'The code entered is incorrect. Please try again.';
                Alert.alert(title, message);
                endOtpRef.current?.reset();
                setTypedEndOtp('');
            }
        } finally {
            setVerifyingEndOtp(false);
        }
    };

    const handleRejectEstimate = async () => {
        Alert.alert(
            'Reject Estimate?',
            'You will be charged only the inspection fee. The job will be cancelled.',
            [
                { text: 'Keep', style: 'cancel' },
                {
                    text: 'Reject', style: 'destructive', onPress: async () => {
                        try {
                            await apiClient.post(`/api/jobs/${jobId}/reject-estimate`);
                            await fetchJobDetails();
                        } catch (err) {
                            Alert.alert('Error', err.response?.data?.message || 'Failed.');
                        }
                    }
                }
            ]
        );
    };

    const handleCustomerStop = async () => {
        Alert.alert(
            'Stop Work?',
            'This will freeze the timer. You will be billed for actual time worked.',
            [
                { text: 'Keep Going', style: 'cancel' },
                {
                    text: 'Stop Now', style: 'destructive', onPress: async () => {
                        try {
                            await apiClient.post(`/api/jobs/${jobId}/customer-stop`);
                            await fetchJobDetails();
                        } catch (err) {
                            Alert.alert('Error', err.response?.data?.message || 'Failed.');
                        }
                    }
                }
            ]
        );
    };

    const handleFetchBillPreview = async () => {
        setBillLoading(true);
        try {
            const res = await apiClient.get(`/api/jobs/${jobId}/bill-preview`);
            setBillPreview(res.data?.preview);
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Could not load bill preview.');
        } finally {
            setBillLoading(false);
        }
    };

    const handleDisputeBill = () => {
        Alert.alert(
            'Dispute Bill',
            'Please provide a reason for disputing this bill. The job will be paused and our support team will review it.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Submit Dispute', style: 'destructive', onPress: () => {
                        Alert.prompt
                            ? Alert.prompt('Dispute Reason', 'Describe the issue:', async (reason) => {
                                if (!reason || !reason.trim()) return Alert.alert('Required', 'A reason is required to dispute the bill.');
                                try {
                                    await apiClient.post(`/api/jobs/${jobId}/dispute`, { reason });
                                    await fetchJobDetails();
                                    Alert.alert('Dispute Raised', 'A support ticket has been created. Our team will contact you shortly.');
                                } catch (err) {
                                    Alert.alert('Error', err.response?.data?.message || 'Failed to raise dispute.');
                                }
                            })
                            : (async () => {
                                // Android fallback — Alert.prompt is iOS only
                                try {
                                    await apiClient.post(`/api/jobs/${jobId}/dispute`, { reason: 'Customer disputes the bill (submitted via quick action)' });
                                    await fetchJobDetails();
                                    Alert.alert('Dispute Raised', 'A support ticket has been created. Our team will contact you shortly.');
                                } catch (err) {
                                    Alert.alert('Error', err.response?.data?.message || 'Failed to raise dispute.');
                                }
                            })()
                    }
                }
            ]
        );
    };


    // ── Hardware back guard ────────────────────────────────────────────
    useFocusEffect(useCallback(() => {
        const onBack = () => {
            if (!['completed', 'cancelled', 'no_worker_found'].includes(status)) {
                Alert.alert(t('active_request_title'), t('active_request_msg'), [
                    { text: t('stay'), style: 'cancel' },
                    { text: t('go_home'), onPress: () => navigation.replace('CustomerTabs') }
                ]);
                return true;
            }
            return false;
        };
        const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
        return () => sub.remove();
    }, [status]));

    const workerLat = workerLocation?.lat || assignedWorker?.lat || job?.worker?.lat;
    const workerLng = workerLocation?.lng || assignedWorker?.lng || job?.worker?.lng;
    const jobLat = job?.lat;
    const jobLng = job?.lng;

    // ── Status config ──────────────────────────────────────────────────
    const statusConfig = {
        searching:          { color: tTheme.brand.primary,       icon: '🔍', title: 'Finding Your Professional',  sub: 'Our algorithm is scanning nearby experts for you.' },
        assigned:           { color: '#00E0FF',                   icon: '✅', title: 'Professional Matched!',       sub: 'A verified expert is heading your way.' },
        worker_en_route:    { color: '#00E0FF',                   icon: '🛵', title: 'On the Way',                 sub: 'Your professional is navigating to your location.' },
        worker_arrived:     { color: tTheme.brand.primary,       icon: '📍', title: 'Professional Arrived',        sub: 'Share the Inspection Code below to begin the assessment.' },
        inspection_active:  { color: '#00E0FF',                   icon: '🔍', title: 'Inspection Underway',         sub: 'Your professional is assessing the issue and preparing an estimate.' },
        estimate_submitted: { color: tTheme.status.warning.base, icon: '📋', title: 'Review Estimate',             sub: 'The pro has sent their assessment. Share the Start Code to begin work.' },
        in_progress:        { color: tTheme.status.success.base, icon: '🔧', title: 'Work in Progress',            sub: 'Sit back — your expert is working on the job.' },
        pause_requested:    { color: tTheme.status.warning.base, icon: '⏸️', title: 'Pause Requested',             sub: 'The professional has requested a short break. Your approval is needed.' },
        work_paused:        { color: tTheme.status.warning.base, icon: '⏸️', title: 'Work Paused',                 sub: 'The job is paused. Approve the resume request to continue.' },
        resume_requested:   { color: '#00E0FF',                   icon: '▶️', title: 'Resume Requested',            sub: 'The professional is ready to resume. Your approval is needed.' },
        suspend_requested:  { color: '#8B5CF6',                   icon: '📅', title: 'Reschedule Requested',        sub: 'The professional has proposed a new time. Your approval is needed.' },
        suspended:          { color: tTheme.status.success.base, icon: '📅', title: 'Job Rescheduled',             sub: 'Today\'s session is closed. Your follow-up appointment is booked.' },
        customer_stopping:  { color: tTheme.status.warning.base, icon: '⏸️', title: 'Work Stopped',                sub: 'You have stopped the job. Waiting for the professional to confirm.' },
        pending_completion: { color: tTheme.status.warning.base, icon: '✔️', title: 'Awaiting Your Approval',      sub: 'Enter the completion code to finalize and proceed to payment.' },
        completed:          { color: tTheme.status.success.base, icon: '⭐', title: 'Job Completed!',              sub: 'Excellent! Your service has been successfully completed.' },
        cancelled:          { color: tTheme.status.error.base,   icon: '✗',  title: 'Job Cancelled',               sub: 'This job has been cancelled.' },
        no_worker_found:    { color: tTheme.status.error.base,   icon: '😔', title: 'No Worker Found',             sub: 'We could not find a professional nearby. Please try again.' },
    };
    const cfg = statusConfig[status] || statusConfig.searching;

    const handleHeaderBack = () => {
        // Guard against GO_BACK warning when this screen is opened as stack root (no history entry).
        if (navigation.canGoBack()) {
            navigation.goBack();
            return;
        }
        // Safe fallback: send customer to the main tabs when there is no back stack.
        navigation.replace('CustomerTabs');
    };

    return (
        <MainBackground>
            {/* ── Compact Header ── */}
            <View style={styles.header}>
                <PressableAnimated onPress={handleHeaderBack} style={styles.headerBtn}>
                    <Text style={styles.headerBtnTxt}>←</Text>
                </PressableAnimated>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerLabel}>JOB STATUS</Text>
                    <Text style={styles.headerSub} numberOfLines={1}>{job ? `#${jobId.slice(-6).toUpperCase()}` : '...'}</Text>
                </View>
                {assignedWorker && job ? (
                    <PressableAnimated
                        style={styles.chatBtn}
                        onPress={() => navigation.navigate('Chat', { jobId, userRole: 'customer', otherUserId: job.worker_id })}
                    >
                        <Text style={{ fontSize: 20 }}>💬</Text>
                        {chatUnread > 0 && (
                            <View style={styles.badge}><Text style={styles.badgeTxt}>{chatUnread}</Text></View>
                        )}
                    </PressableAnimated>
                ) : <View style={{ width: 44 }} />}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

                {/* ── Live Map ── */}
                {isMapStatus && jobLat && jobLng ? (
                    <FadeInView delay={0} style={styles.mapWrap}>
                        <WebView
                            ref={mapRef}
                            source={{ html: buildMapHTML(jobLat, jobLng, workerLat, workerLng) }}
                            style={styles.map}
                            scrollEnabled={false}
                            originWhitelist={['*']}
                            javaScriptEnabled
                            mixedContentMode="always"
                            allowFileAccess
                            domStorageEnabled
                            startInLoadingState
                            onError={(e) => console.warn('[Map] WebView error', e.nativeEvent?.description)}
                        />
                        {/* Floating status chip over map */}
                        <View style={styles.mapChip}>
                            <View style={[styles.mapChipDot, { backgroundColor: cfg.color }]} />
                            <Text style={[styles.mapChipTxt, { color: cfg.color }]}>{cfg.title}</Text>
                        </View>
                        {/* Worker location label */}
                        {workerLat && (
                            <View style={styles.gpsChip}>
                                <Text style={styles.gpsIcon}>📡</Text>
                                <Text style={styles.gpsTxt}>Live Location</Text>
                            </View>
                        )}
                    </FadeInView>
                ) : null}

                {/* ── Status Hero Card ── */}
                <FadeInView delay={50} style={styles.heroCard}>
                    {/* Progress Rail */}
                    <View style={styles.rail}>
                        {STAGES.map((s, i) => {
                            const isActive = i <= currentStageIdx;
                            const isCurrent = i === currentStageIdx;
                            return (
                                <React.Fragment key={s.key}>
                                    <View style={[
                                        styles.railDot,
                                        isActive && { backgroundColor: cfg.color },
                                        isCurrent && { transform: [{ scale: 1.5 }], shadowColor: cfg.color, shadowOpacity: 0.8, shadowRadius: 6, elevation: 6 }
                                    ]}>
                                        {isCurrent && <Text style={{ fontSize: 8 }}>{s.icon}</Text>}
                                    </View>
                                    {i < STAGES.length - 1 && (
                                        <View style={[styles.railLine, isActive && i < currentStageIdx && { backgroundColor: cfg.color }]} />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </View>

                    {/* Status text */}
                    <View style={styles.statusBody}>
                        <View style={[styles.statusIconBox, { backgroundColor: cfg.color + '15' }]}>
                            <Text style={{ fontSize: 28 }}>{cfg.icon}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.statusTitle, { color: cfg.color }]}>{cfg.title}</Text>
                            <Text style={styles.statusSub}>{cfg.sub}</Text>
                        </View>
                        {status === 'in_progress' && (
                            <View style={{ alignItems: 'flex-end' }}>
                                <View style={[styles.timerBadge, { borderColor: cfg.color + '55', paddingVertical: 6, marginBottom: 4 }]}>
                                    <Text style={[styles.timerTxt, { color: cfg.color }]}>
                                        {formatTime(Math.max(0, ((job?.billing_cap_minutes || job?.estimated_duration_minutes || 0) * 60) - elapsedSeconds))}
                                    </Text>
                                    <Text style={[styles.timerLabel, { color: cfg.color }]}>REMAINING</Text>
                                </View>
                                <Text style={{ fontSize: 10, color: cfg.color, fontWeight: '700', paddingRight: 4 }}>
                                    ELAPSED: {formatTime(elapsedSeconds)}
                                </Text>
                            </View>
                        )}
                    </View>
                </FadeInView>

                {/* ── Phase Action Cards ── */}

                {/* SEARCHING — animated pulsing */}
                {status === 'searching' && (
                    <FadeInView delay={100}>
                        <View style={styles.phaseCard}>
                            <Animated.View style={[styles.searchPulse, { transform: [{ scale: pulseAnim }], borderColor: tTheme.brand.primary + '44' }]} />
                            <Text style={styles.phaseTitle}>🔍 Matching Professionals</Text>
                            <Text style={styles.phaseSub}>Our algorithm is scanning your area for verified experts. This usually takes under 2 minutes.</Text>
                            <View style={styles.waveRow}>
                                {[1, 2, 3].map(w => (
                                    <View key={w} style={[styles.waveDot, { opacity: w === 1 ? 1 : 0.4, backgroundColor: tTheme.brand.primary }]} />
                                ))}
                            </View>
                        </View>
                    </FadeInView>
                )}

                {/* WORKER ARRIVED — Inspection Code */}
                {status === 'worker_arrived' && (
                    <FadeInView delay={100}>
                        <View style={[styles.phaseCard, { borderColor: tTheme.brand.primary + '44' }]}>
                            <View style={styles.phaseHeader}>
                                <View style={[styles.phaseIconBox, { backgroundColor: tTheme.brand.primary + '15' }]}>
                                    <Text style={{ fontSize: 22 }}>🔐</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.phaseMeta}>VERIFICATION PHASE</Text>
                                    <Text style={styles.phaseTitle}>Share Inspection Code</Text>
                                </View>
                                {inspectionExpirySeconds !== null && (
                                    <View style={[styles.countdownBox, { borderColor: tTheme.brand.primary + '44' }]}>
                                        <Text style={[styles.countdownVal, { color: tTheme.brand.primary }]}>{formatTime(inspectionExpirySeconds)}</Text>
                                        <Text style={styles.countdownLbl}>LEFT</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.phaseSub}>The professional has arrived at your door. Show them this code to begin the assessment:</Text>
                            <OtpDisplay code={job?.inspection_otp} color={tTheme.brand.primary} />
                            <View style={styles.codeHint}>
                                <Text style={styles.codeHintTxt}>📱 Only share with the verified professional at your door</Text>
                            </View>
                        </View>
                    </FadeInView>
                )}

                {/* INSPECTION ACTIVE — Worker is assessing */}
                {status === 'inspection_active' && (
                    <FadeInView delay={100}>
                        <View style={[styles.phaseCard, { borderColor: '#00E0FF44' }]}>
                            <View style={styles.phaseHeader}>
                                <View style={[styles.phaseIconBox, { backgroundColor: '#00E0FF15' }]}>
                                    <Text style={{ fontSize: 22 }}>🔍</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.phaseMeta}>INSPECTION IN PROGRESS</Text>
                                    <Text style={styles.phaseTitle}>Worker is Assessing</Text>
                                </View>
                                <View style={[styles.timerBadge, { borderColor: '#00E0FF55' }]}>
                                    <Text style={[styles.timerTxt, { color: '#00E0FF' }]}>{formatTime(elapsedSeconds)}</Text>
                                    <Text style={[styles.timerLabel, { color: '#00E0FF' }]}>ELAPSED</Text>
                                </View>
                            </View>
                            <Text style={styles.phaseSub}>
                                Your professional is currently inspecting the issue and preparing a cost and time estimate for your service.
                            </Text>
                            <View style={[styles.liveIndicator, { backgroundColor: '#00E0FF11', marginTop: 12 }]}>
                                <View style={[styles.liveDot, { backgroundColor: '#00E0FF' }]} />
                                <Text style={[styles.liveTxt, { color: '#00E0FF' }]}>Assessment in progress — estimate coming soon</Text>
                            </View>
                        </View>
                    </FadeInView>
                )}

                {/* ESTIMATE SUBMITTED — Review + Start Code */}
                {status === 'estimate_submitted' && (
                    <FadeInView delay={100}>
                        <View style={[styles.phaseCard, { borderColor: tTheme.status.warning.base + '44' }]}>
                            <View style={styles.phaseHeader}>
                                <View style={[styles.phaseIconBox, { backgroundColor: tTheme.status.warning.base + '15' }]}>
                                    <Text style={{ fontSize: 22 }}>📋</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.phaseMeta}>{job?.metadata?.is_followup ? 'READY TO RESUME' : 'ASSESSMENT COMPLETE'}</Text>
                                    <Text style={styles.phaseTitle}>{job?.metadata?.is_followup ? 'Start Follow-up Session' : 'Review Estimate'}</Text>
                                </View>
                            </View>

                            {/* Estimate details - skip if follow-up */}
                            {!job?.metadata?.is_followup && (
                                <>
                                    <View style={styles.estimateGrid}>
                                        <View style={styles.estimateItem}>
                                            <Text style={styles.estimateIcon}>⏱️</Text>
                                            <Text style={styles.estimateLbl}>Est. Time</Text>
                                            <Text style={styles.estimateVal}>{job?.estimated_duration_minutes || '–'} min</Text>
                                        </View>
                                        {job?.estimated_cost && (
                                            <View style={styles.estimateItem}>
                                                <Text style={styles.estimateIcon}>💰</Text>
                                                <Text style={styles.estimateLbl}>Est. Cost</Text>
                                                <Text style={styles.estimateVal}>₹{job.estimated_cost}</Text>
                                            </View>
                                        )}
                                    </View>

                                    {job?.issue_notes && (
                                        <View style={styles.notesBox}>
                                            <Text style={styles.notesLabel}>📝 PRO NOTES</Text>
                                            <Text style={styles.notesTxt}>{job.issue_notes}</Text>
                                        </View>
                                    )}

                                    <View style={[styles.dividerLine, { marginVertical: 16 }]} />
                                </>
                            )}
                            <View style={styles.estimateActions}>
                                <PremiumButton
                                    title={job?.metadata?.is_followup ? "Start Session →" : "Accept Estimate & Start →"}
                                    onPress={handleApproveEstimate}
                                    loading={otpActionLoading}
                                    style={{ flex: 2, marginRight: 8 }}
                                />
                                <TouchableOpacity 
                                    style={styles.slimRejectBtn} 
                                    onPress={handleRejectEstimate}
                                    disabled={otpActionLoading}
                                >
                                    <Text style={styles.slimRejectTxt}>Reject</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={[styles.codeHint, { borderColor: tTheme.status.success.base + '33', backgroundColor: tTheme.status.success.base + '08', marginTop: 16 }]}>
                                <Text style={[styles.codeHintTxt, { color: tTheme.status.success.base }]}>✓ Approving this starts the billable timer</Text>
                            </View>
                        </View>
                    </FadeInView>
                )}

                {/* IN PROGRESS — live timer */}
                {status === 'in_progress' && (
                    <FadeInView delay={100}>
                        <View style={[styles.phaseCard, { borderColor: tTheme.status.success.base + '33' }]}>
                            <View style={styles.phaseHeader}>
                                <View style={[styles.phaseIconBox, { backgroundColor: tTheme.status.success.base + '15' }]}>
                                    <Text style={{ fontSize: 22 }}>🔧</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.phaseMeta}>SERVICE IN PROGRESS</Text>
                                    <Text style={styles.phaseTitle}>Work Underway</Text>
                                </View>
                                <View style={[styles.timerBadge, { borderColor: tTheme.status.success.base + '55' }]}>
                                    <Text style={[styles.timerTxt, { color: tTheme.status.success.base }]}>{formatTime(elapsedSeconds)}</Text>
                                    <Text style={[styles.timerLabel, { color: tTheme.status.success.base }]}>ELAPSED</Text>
                                </View>
                            </View>
                            <Text style={styles.phaseSub}>Your professional is working. You'll be notified when work is complete and ready for your review.</Text>
                            <View style={[styles.liveIndicator, { backgroundColor: tTheme.status.success.base + '11' }]}>
                                <View style={[styles.liveDot, { backgroundColor: tTheme.status.success.base }]} />
                                <Text style={[styles.liveTxt, { color: tTheme.status.success.base }]}>Billable session active</Text>
                            </View>
                        </View>
                    </FadeInView>
                )}

                {/* PENDING COMPLETION — Route to BillReviewScreen */}
                {status === 'pending_completion' && (
                    <FadeInView delay={100}>
                        <View style={[styles.phaseCard, { borderColor: tTheme.status.warning.base + '44' }]}>
                            <View style={styles.phaseHeader}>
                                <View style={[styles.phaseIconBox, { backgroundColor: tTheme.status.warning.base + '15' }]}>
                                    <Text style={{ fontSize: 22 }}>🧾</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.phaseMeta}>AWAITING YOUR APPROVAL</Text>
                                    <Text style={styles.phaseTitle}>Review Final Bill</Text>
                                </View>
                            </View>
                            <Text style={styles.phaseSub}>
                                The professional has finalized the bill. Please review the itemized breakdown and enter the completion code to finish the job.
                            </Text>

                            <PremiumButton
                                title="Review Bill & Enter OTP"
                                onPress={() => navigation.navigate('BillReview', { jobId })}
                                style={{ marginTop: 20 }}
                            />
                            
                            <TouchableOpacity onPress={handleDisputeBill} style={{ marginTop: 24, paddingVertical: 8 }}>
                                <Text style={{ color: tTheme.status.error.base, fontSize: 13, fontWeight: '700', textAlign: 'center' }}>
                                    Disagree with this bill? Raise a Dispute
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </FadeInView>
                )}

                {/* COMPLETED */}
                {status === 'completed' && (
                    <FadeInView delay={100}>
                        <View style={[styles.phaseCard, { borderColor: tTheme.status.success.base + '55', alignItems: 'center' }]}>
                            <Text style={{ fontSize: 54 }}>⭐</Text>
                            <Text style={[styles.phaseTitle, { textAlign: 'center', color: tTheme.status.success.base, marginTop: 8 }]}>Job Completed!</Text>
                            <Text style={[styles.phaseSub, { textAlign: 'center', marginBottom: 16 }]}>Your service is complete. Please review the final bill and proceed to payment.</Text>
                            
                            <PremiumButton
                                title="View Bill & Pay"
                                onPress={() => navigation.replace('Payment', { jobId })}
                                style={{ width: '100%', marginBottom: 12 }}
                            />

                            <PremiumButton
                                variant="secondary"
                                title="Leave a Review"
                                onPress={() => navigation.navigate('Rating', { jobId })}
                                style={{ width: '100%' }}
                            />
                        </View>
                    </FadeInView>
                )}

                {/* SUSPENDED / RESCHEDULED */}
                {status === 'suspended' && (
                    <FadeInView delay={100}>
                        <View style={[styles.phaseCard, { borderColor: tTheme.status.success.base + '55', alignItems: 'center' }]}>
                            <Text style={{ fontSize: 54 }}>📅</Text>
                            <Text style={[styles.phaseTitle, { textAlign: 'center', color: tTheme.status.success.base, marginTop: 8 }]}>Session Rescheduled!</Text>
                            <Text style={[styles.phaseSub, { textAlign: 'center', marginBottom: 16 }]}>Today's work is complete. Please pay the bill for today's session below.</Text>
                            
                            <PremiumButton
                                title="View Bill / Pay Now"
                                onPress={() => navigation.replace('Payment', { jobId })}
                                style={{ width: '100%', marginBottom: 12 }}
                            />
                            
                            {job?.followup_job_id && (
                                <PremiumButton
                                    variant="secondary"
                                    title="View Follow-up Booking"
                                    onPress={() => navigation.replace('JobStatusDetail', { jobId: job.followup_job_id })}
                                    style={{ width: '100%' }}
                                />
                            )}
                        </View>
                    </FadeInView>
                )}

                {/* CANCELLED / NO WORKER */}
                {['cancelled', 'no_worker_found'].includes(status) && (
                    <FadeInView delay={100}>
                        <View style={[styles.phaseCard, { borderColor: tTheme.status.error.base + '44', alignItems: 'center' }]}>
                            <Text style={{ fontSize: 40 }}>{status === 'cancelled' ? '✗' : '😔'}</Text>
                            <Text style={[styles.phaseTitle, { color: tTheme.status.error.base, textAlign: 'center', marginTop: 8 }]}>
                                {status === 'cancelled' ? 'Job Cancelled' : 'No Professional Found'}
                            </Text>
                            <Text style={[styles.phaseSub, { textAlign: 'center' }]}>
                                {status === 'cancelled' ? 'This service request has been cancelled.' : 'We could not locate an available professional nearby. Please try again.'}
                            </Text>
                            <PremiumButton
                                title="Post a New Request"
                                onPress={() => navigation.replace('CustomerTabs')}
                                style={{ marginTop: 16 }}
                            />
                        </View>
                    </FadeInView>
                )}

                {/* CUSTOMER STOPPING — waiting for worker to confirm job end */}
                {status === 'customer_stopping' && (
                    <FadeInView delay={100}>
                        <View style={[styles.phaseCard, { borderColor: tTheme.status.warning.base + '44', alignItems: 'center' }]}>
                            <Text style={{ fontSize: 40 }}>⏸</Text>
                            <Text style={[styles.phaseTitle, { color: tTheme.status.warning.base, textAlign: 'center', marginTop: 8 }]}>Work Stopped</Text>
                            <Text style={[styles.phaseSub, { textAlign: 'center' }]}>
                                You have requested to stop. The professional will confirm and you will receive the final completion code to finish the job.
                            </Text>
                            <View style={[styles.liveIndicator, { backgroundColor: tTheme.status.warning.base + '11', marginTop: 12 }]}>
                                <View style={[styles.liveDot, { backgroundColor: tTheme.status.warning.base }]} />
                                <Text style={[styles.liveTxt, { color: tTheme.status.warning.base }]}>Waiting for professional to wrap up…</Text>
                            </View>
                        </View>
                    </FadeInView>
                )}

                {/* ── Assigned Worker Card — shows from assignedWorker store OR job.worker API data ── */}
                {(assignedWorker || job?.worker) && !['searching', 'open'].includes(status) && (() => {
                    const w = assignedWorker || job?.worker;
                    return (
                        <FadeInView delay={150}>
                            <PressableAnimated
                                style={styles.workerCard}
                                onPress={() => navigation.navigate('WorkerReputation', { workerId: w.id })}
                            >
                                <Image
                                    source={{ uri: w.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(w.name || 'P')}&background=101014&color=BD00FF` }}
                                    style={styles.workerPhoto}
                                />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.workerLabel}>YOUR PROFESSIONAL</Text>
                                    <Text style={styles.workerName}>{w.name}</Text>
                                    <View style={styles.workerMeta}>
                                        <Text style={styles.workerRating}>⭐ {w.rating ? Number(w.rating).toFixed(1) : 'New'}</Text>
                                        <View style={styles.metaDot} />
                                        <Text style={styles.workerJobs}>{w.completed_jobs || 0} jobs</Text>
                                        {w.is_verified && <Text style={{ color: '#00E0FF', fontSize: 11, fontWeight: '700' }}>✓ Verified</Text>}
                                    </View>
                                </View>
                                {(w.phone || job?.customer_phone) && (
                                    <TouchableOpacity
                                        style={styles.callBtn}
                                        onPress={() => Linking.openURL(`tel:${w.phone || job?.customer_phone}`)}
                                    >
                                        <Text style={{ fontSize: 18 }}>📞</Text>
                                    </TouchableOpacity>
                                )}
                            </PressableAnimated>
                        </FadeInView>
                    );
                })()}

                {/* ── Job Details ── */}
                {job && (
                    <FadeInView delay={200}>
                        <View style={styles.detailsCard}>
                            <Text style={styles.sectionLabel}>REQUEST DETAILS</Text>
                            <View style={styles.detailGrid}>
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailIcon}>🔧</Text>
                                    <Text style={styles.detailLbl}>Service</Text>
                                    <Text style={styles.detailVal}>{t(`cat_${job.category}`) || job.category}</Text>
                                </View>
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailIcon}>📍</Text>
                                    <Text style={styles.detailLbl}>Location</Text>
                                    <Text style={styles.detailVal} numberOfLines={2}>{job.address || '—'}</Text>
                                </View>
                                {job.scheduled_for && (
                                    <View style={styles.detailItem}>
                                        <Text style={styles.detailIcon}>🗓️</Text>
                                        <Text style={styles.detailLbl}>Scheduled</Text>
                                        <Text style={styles.detailVal}>{dayjs(job.scheduled_for).format('MMM D · h:mm A')}</Text>
                                    </View>
                                )}
                                {job.description && (
                                    <View style={[styles.detailItem, { flex: 2 }]}>
                                        <Text style={styles.detailIcon}>📝</Text>
                                        <Text style={styles.detailLbl}>Description</Text>
                                        <Text style={styles.detailVal}>{parseJobDescription(job.description).text}</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </FadeInView>
                )}




                {/* ── Reject Estimate Option ── */}
                {status === 'estimate_submitted' && (
                    <FadeInView delay={225}>
                        <TouchableOpacity style={styles.rejectEstimateBtn} onPress={handleRejectEstimate} activeOpacity={0.8}>
                            <Text style={styles.rejectEstimateTxt}>✕ Reject Estimate (Inspection Fee Only)</Text>
                        </TouchableOpacity>
                    </FadeInView>
                )}

                {/* ── Pause Approval ── */}
                {status === 'pause_requested' && (
                    <FadeInView delay={200}>
                        <View style={[styles.actionCard, { borderColor: '#F59E0B44' }]}>
                            <Text style={styles.actionCardTitle}>⏸ Worker Wants to Pause</Text>
                            <Text style={styles.actionCardSub}>
                                Reason: <Text style={{ color: tTheme.text.primary, fontWeight: '700' }}>{job?.pause_reason || '—'}</Text>
                            </Text>
                            <Text style={[styles.actionCardSub, { marginTop: 4, fontSize: 11 }]}>
                                Max 2 pauses / 30 min total per job. Timer still running until approved.
                            </Text>
                            <OTPInput
                                onComplete={(code) => handleActionApproval('pause', code)}
                                disabled={otpActionLoading}
                            />
                            {otpActionLoading && <Text style={styles.verifyingTxt}>Verifying…</Text>}
                        </View>
                    </FadeInView>
                )}


                {/* ── Resume Approval ── */}
                {status === 'resume_requested' && (
                    <FadeInView delay={200}>
                        <View style={[styles.actionCard, { borderColor: '#22c55e44' }]}>
                            <Text style={styles.actionCardTitle}>▶ Worker Wants to Resume</Text>
                            <Text style={styles.actionCardSub}>Approve to restart the timer and continue the job.</Text>
                            <OTPInput
                                onComplete={(code) => handleActionApproval('resume', code)}
                                disabled={otpActionLoading}
                            />
                            {otpActionLoading && <Text style={styles.verifyingTxt}>Verifying…</Text>}
                        </View>
                    </FadeInView>
                )}

                {/* ── Suspend / Reschedule Approval ── */}
                {status === 'suspend_requested' && (
                    <FadeInView delay={200}>
                        <View style={[styles.actionCard, { borderColor: '#8B5CF644' }]}>
                            <Text style={styles.actionCardTitle}>📅 Worker Wants to Reschedule</Text>
                            <Text style={styles.actionCardSub}>
                                Proposed new time:{' '}
                                <Text style={{ color: tTheme.text.primary, fontWeight: '800' }}>
                                    {job?.suspend_reschedule_at ? new Date(job.suspend_reschedule_at).toLocaleString() : '—'}
                                </Text>
                            </Text>
                            <Text style={[styles.actionCardSub, { marginTop: 4, fontSize: 11 }]}>
                                Reason: {job?.suspend_reason || '—'}
                            </Text>
                            <Text style={[styles.actionCardSub, { marginTop: 4, fontSize: 11, color: '#F59E0B' }]}>
                                Approving will bill today's work and create a follow-up job for the new time.
                            </Text>
                            <PremiumButton
                                title="Approve Reschedule"
                                onPress={() => handleActionApproval('suspend')}
                                loading={otpActionLoading}
                                style={{ marginTop: 12 }}
                            />
                            {otpActionLoading && <Text style={styles.verifyingTxt}>Updating Status…</Text>}
                        </View>
                    </FadeInView>
                )}


                {/* ── Customer Stop-Early Button (in_progress | work_paused) ── */}
                {['in_progress', 'work_paused'].includes(status) && (
                    <FadeInView delay={230}>
                        <TouchableOpacity style={styles.stopWorkBtn} onPress={handleCustomerStop} activeOpacity={0.8}>
                            <Text style={{ fontSize: 18 }}>⛔</Text>
                            <Text style={styles.stopWorkTxt}>Stop Work Early</Text>
                        </TouchableOpacity>
                    </FadeInView>
                )}


                {/* ── Cancel / Edit ── */}
                {['open', 'searching', 'no_worker_found', 'assigned', 'worker_en_route'].includes(status) && (

                    <FadeInView delay={250}>
                        <View style={styles.footerActions}>
                            <PremiumButton
                                variant="secondary"
                                title={t('status_cancel') || 'Cancel Request'}
                                onPress={() => Alert.alert(
                                    'Cancel Job',
                                    'Are you sure you want to cancel this request?',
                                    [
                                        { text: 'Keep', style: 'cancel' },
                                        {
                                            text: 'Cancel Job', style: 'destructive',
                                            onPress: async () => {
                                                try {
                                                    await apiClient.post(`/api/jobs/${jobId}/cancel`);
                                                    navigation.replace('CustomerTabs');
                                                } catch { }
                                            }
                                        }
                                    ]
                                )}
                            />
                        </View>
                    </FadeInView>
                )}

            </ScrollView>
        </MainBackground>
    );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const createStyles = (t) => StyleSheet.create({
    header: {
        paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.background.surface, justifyContent: 'center', alignItems: 'center' },
    headerBtnTxt: { color: t.text.primary, fontSize: 20 },
    headerCenter: { alignItems: 'center' },
    headerLabel: { color: t.brand.primary, fontSize: 9, fontWeight: '900', letterSpacing: 3 },
    headerSub: { color: t.text.tertiary, fontSize: 11, fontWeight: '700', marginTop: 2 },
    chatBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.background.surface, justifyContent: 'center', alignItems: 'center', position: 'relative' },
    badge: { position: 'absolute', top: -4, right: -4, backgroundColor: t.status.error.base, minWidth: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3, borderWidth: 2, borderColor: t.background.app },
    badgeTxt: { color: '#FFF', fontSize: 9, fontWeight: '900' },

    scroll: { paddingBottom: 120 },

    // ── Map ──
    mapWrap: { height: 240, position: 'relative', overflow: 'hidden' },
    map: { flex: 1 },
    mapChip: { position: 'absolute', bottom: 12, left: 16, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(10,10,11,0.85)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    mapChipDot: { width: 8, height: 8, borderRadius: 4 },
    mapChipTxt: { fontSize: 12, fontWeight: '700' },
    gpsChip: { position: 'absolute', top: 12, right: 16, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,224,255,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: '#00E0FF33' },
    gpsIcon: { fontSize: 10 },
    gpsTxt: { color: '#00E0FF', fontSize: 10, fontWeight: '700' },

    // ── Status Hero ──
    heroCard: { margin: 16, backgroundColor: t.background.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 20, borderWidth: 1, borderColor: t.border.default + '22', ...t.shadows.premium },
    rail: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    railDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.background.surfaceRaised },
    railLine: { flex: 1, height: 2, backgroundColor: t.background.surfaceRaised },
    statusBody: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    statusIconBox: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
    statusTitle: { fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
    statusSub: { color: t.text.secondary, fontSize: 12, marginTop: 3, lineHeight: 17 },
    timerBadge: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5 },
    timerTxt: { fontSize: 16, fontWeight: '900', letterSpacing: 1 },
    timerLabel: { color: t.text.muted, fontSize: 8, fontWeight: '800', letterSpacing: 1.5, marginTop: 2 },

    // ── Phase Cards ──
    phaseCard: {
        marginHorizontal: 16, marginBottom: 12,
        backgroundColor: t.background.surface,
        borderRadius: 20, padding: 20,
        borderWidth: 1, borderColor: t.border.default + '22',
        ...t.shadows.premium,
    },
    phaseHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
    phaseIconBox: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    phaseMeta: { color: t.text.tertiary, fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 2 },
    phaseTitle: { color: t.text.primary, fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
    phaseSub: { color: t.text.secondary, fontSize: 13, lineHeight: 18, marginBottom: 4 },

    // searching
    searchPulse: { position: 'absolute', top: -20, right: -20, width: 140, height: 140, borderRadius: 70, borderWidth: 1 },
    waveRow: { flexDirection: 'row', gap: 6, marginTop: 16 },
    waveDot: { width: 8, height: 8, borderRadius: 4 },

    // countdown
    countdownBox: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1.5 },
    countdownVal: { fontSize: 18, fontWeight: '900' },
    countdownLbl: { fontSize: 8, fontWeight: '900', letterSpacing: 1.5, color: t.text.muted },

    // code hint
    codeHint: { backgroundColor: t.brand.primary + '08', borderRadius: 10, borderWidth: 1, borderColor: t.brand.primary + '22', paddingHorizontal: 14, paddingVertical: 10 },
    codeHintTxt: { color: t.brand.primary, fontSize: 11, fontWeight: '700', textAlign: 'center' },

    // estimate
    estimateGrid: { flexDirection: 'row', gap: 10, marginVertical: 14 },
    estimateItem: { flex: 1, alignItems: 'center', backgroundColor: t.background.surfaceRaised, borderRadius: 14, padding: 14, gap: 4 },
    estimateIcon: { fontSize: 20 },
    estimateLbl: { color: t.text.tertiary, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
    estimateVal: { color: t.text.primary, fontSize: 16, fontWeight: '900' },
    notesBox: { backgroundColor: t.background.app, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: t.border.default + '22' },
    notesLabel: { color: t.text.tertiary, fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 6 },
    notesTxt: { color: t.text.secondary, fontSize: 13, lineHeight: 19 },
    dividerLine: { height: 1, backgroundColor: t.border.default + '22' },
    estimateActions: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
    slimRejectBtn: { 
        paddingHorizontal: 16, paddingVertical: 12, 
        borderRadius: 12, borderWidth: 1, borderColor: '#EF444433', 
        backgroundColor: '#EF444408', justifyContent: 'center', alignItems: 'center' 
    },
    slimRejectTxt: { color: '#EF4444', fontSize: 13, fontWeight: '800' },

    // in progress
    liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginTop: 12 },
    liveDot: { width: 8, height: 8, borderRadius: 4 },
    liveTxt: { fontSize: 12, fontWeight: '700' },

    // pending
    verifyingTxt: { color: t.text.secondary, fontSize: 12, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },

    // ── Worker Card ──
    workerCard: {
        marginHorizontal: 16, marginBottom: 12,
        backgroundColor: t.background.surface,
        borderRadius: 20, padding: 16,
        flexDirection: 'row', alignItems: 'center', gap: 14,
        borderWidth: 1, borderColor: t.border.default + '22',
        ...t.shadows.premium,
    },
    workerPhoto: { width: 54, height: 54, borderRadius: 27, backgroundColor: t.background.surfaceRaised },
    workerLabel: { color: t.text.tertiary, fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 2 },
    workerName: { color: t.text.primary, fontSize: 16, fontWeight: '900' },
    workerMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    workerRating: { color: t.brand.primary, fontSize: 11, fontWeight: '700' },
    metaDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: t.text.tertiary },
    workerJobs: { color: t.text.secondary, fontSize: 11 },
    callBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.background.surfaceRaised, justifyContent: 'center', alignItems: 'center' },

    // ── Details Card ──
    detailsCard: {
        marginHorizontal: 16, marginBottom: 12,
        backgroundColor: t.background.surface,
        borderRadius: 20, padding: 20,
        borderWidth: 1, borderColor: t.border.default + '22',
        ...t.shadows.medium,
    },
    sectionLabel: { color: t.text.tertiary, fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 14 },
    detailGrid: { gap: 14 },
    detailItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    detailIcon: { fontSize: 16, marginTop: 2 },
    detailLbl: { color: t.text.tertiary, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
    detailVal: { color: t.text.primary, fontSize: 14, fontWeight: '600', flex: 1, flexWrap: 'wrap' },

    footerActions: { marginHorizontal: 16, marginBottom: 16 },

    // ── New lifecycle action cards ──
    actionCard: {
        marginHorizontal: 16, marginBottom: 12,
        backgroundColor: t.background.surface,
        borderRadius: 20, padding: 20,
        borderWidth: 1.5,
        ...t.shadows.medium,
    },
    actionCardTitle: { color: t.text.primary, fontSize: 16, fontWeight: '900', marginBottom: 6 },
    actionCardSub: { color: t.text.secondary, fontSize: 13, lineHeight: 18 },

    rejectEstimateBtn: {
        marginHorizontal: 16, marginBottom: 8,
        padding: 14, borderRadius: 14,
        backgroundColor: '#EF444412', borderWidth: 1.5, borderColor: '#EF444433',
        alignItems: 'center',
    },
    rejectEstimateTxt: { color: '#EF4444', fontWeight: '800', fontSize: 13 },

    stopWorkBtn: {
        marginHorizontal: 16, marginBottom: 12,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        padding: 16, borderRadius: 16,
        backgroundColor: '#EF444412', borderWidth: 1.5, borderColor: '#EF444433',
    },
    stopWorkTxt: { color: '#EF4444', fontWeight: '800', fontSize: 15 },

    // Bill preview rows
    billRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    billLabel: { color: t.text.secondary, fontSize: 13, fontWeight: '700', flex: 1 },
    billValue: { color: t.text.primary, fontSize: 14, fontWeight: '900', textAlign: 'right' },
});
