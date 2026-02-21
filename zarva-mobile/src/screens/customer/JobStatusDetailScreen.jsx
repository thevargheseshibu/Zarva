import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, BackHandler, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { colors, spacing, radius } from '../../design-system/tokens';
import Card from '../../components/Card';
import OTPInput from '../../components/OTPInput';
import GoldButton from '../../components/GoldButton';
import { useJobStore } from '../../stores/jobStore';
import apiClient from '../../services/api/client';

export default function JobStatusDetailScreen({ route, navigation }) {
    const { jobId } = route.params || { jobId: 'mock-123' };

    const { searchPhase, assignedWorker, clearActiveJob } = useJobStore();

    const status = searchPhase || 'assigned';
    const mockWorker = assignedWorker || {
        name: 'Rahul R', rating: 4.8, category: 'Plumber', phone: '+91 9876543210',
        photo: 'https://i.pravatar.cc/150?img=11'
    };

    const [startOtp, setStartOtp] = useState(null);
    const [verifyingEndOtp, setVerifyingEndOtp] = useState(false);
    const [workStartedAt, setWorkStartedAt] = useState(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [scheduledFor, setScheduledFor] = useState(null);
    const [isEmergency, setIsEmergency] = useState(false);
    const [autoEscalateAt, setAutoEscalateAt] = useState(null);

    // ── Auto-navigate on terminal states (Issue #8) ──────────────────────────
    useEffect(() => {
        if (status === 'completed') {
            clearActiveJob();
            navigation.replace('Rating', { jobId });
        } else if (status === 'cancelled' || status === 'no_worker_found') {
            clearActiveJob();
            navigation.replace('CustomerTabs');
        }
    }, [status, navigation, jobId, clearActiveJob]);

    // ── Fetch Details (Issue #25, #51, #62) ─────────────────────────────────
    useEffect(() => {
        apiClient.get(`/api/jobs/${jobId}`)
            .then(res => {
                const job = res.data?.job;
                if (job) {
                    if (job.start_otp) setStartOtp(job.start_otp);
                    if (job.work_started_at) setWorkStartedAt(job.work_started_at);
                    if (job.scheduled_for) setScheduledFor(job.scheduled_for);
                    if (job.is_emergency) setIsEmergency(true);
                    if (job.auto_escalate_at) setAutoEscalateAt(job.auto_escalate_at);
                }
            })
            .catch(err => console.error('Failed to fetch job data', err));
    }, [jobId]);

    // ── Live Timer (Issue #51) ───────────────────────────────────────────────
    useEffect(() => {
        let int;
        if (status === 'in_progress' && workStartedAt) {
            const startMs = new Date(workStartedAt).getTime();
            const updateTimer = () => {
                setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
            };
            updateTimer();
            int = setInterval(updateTimer, 1000);
        }
        return () => clearInterval(int);
    }, [status, workStartedAt]);

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return h === '00' ? `${m}:${s}` : `${h}:${m}:${s}`;
    };

    // ── Back button guard during active job (Issue #7) ───────────────────────
    useFocusEffect(
        useCallback(() => {
            const activeStatuses = ['in_progress', 'pending_completion', 'worker_arrived'];
            const onBackPress = () => {
                if (activeStatuses.includes(status)) {
                    Alert.alert(
                        'Job in Progress',
                        'You cannot go back while a job is active. Please wait for it to complete.',
                        [{ text: 'OK' }]
                    );
                    return true; // block back
                }
                return false; // allow back for non-active states
            };
            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [status])
    );

    // Timeline logic
    const STAGES = ['searching', 'assigned', 'worker_arrived', 'in_progress', 'pending_completion'];
    const currentIdx = STAGES.indexOf(status) === -1 ? STAGES.length : STAGES.indexOf(status);

    const renderTick = (label, index) => {
        const isPast = index < currentIdx;
        const isCurrent = index === currentIdx;

        let dotColor = colors.bg.surface;
        if (isPast) dotColor = colors.success;
        if (isCurrent) dotColor = colors.gold.primary;

        return (
            <View key={label} style={styles.tickRow}>
                <View style={styles.tickCol}>
                    <View style={[styles.dot, { backgroundColor: dotColor }]} />
                    {index < STAGES.length - 1 && (
                        <View style={[styles.line, { backgroundColor: isPast ? colors.success : colors.bg.surface }]} />
                    )}
                </View>
                <Text style={[
                    styles.tickLabel,
                    isPast && styles.tickLabelPast,
                    isCurrent && styles.tickLabelCurrent
                ]}>
                    {label.replace(/_/g, ' ').toUpperCase()}
                </Text>
            </View>
        );
    };

    return (
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backTxt}>←</Text>
                </TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                    <Text style={styles.title}>Job #{String(jobId).substring(0, 6).toUpperCase()}</Text>
                    {isEmergency && <Text style={styles.emergencyBadge}>EMERGENCY</Text>}
                    {scheduledFor && <Text style={styles.scheduleBadge}>Scheduled: {new Date(scheduledFor).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</Text>}
                </View>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Timeline */}
                <Card style={styles.timelineCard}>
                    {STAGES.map((s, i) => renderTick(s, i))}
                </Card>

                {/* Worker Info Card */}
                {currentIdx >= 1 && status !== 'no_worker_found' && (
                    <Card style={styles.workerCard}>
                        <Image source={{ uri: mockWorker.photo }} style={styles.wPhoto} />
                        <View style={styles.wInfo}>
                            <Text style={styles.wName}>{mockWorker.name}</Text>
                            <Text style={styles.wMeta}>⭐ {mockWorker.rating} • {mockWorker.category}</Text>
                        </View>
                        <TouchableOpacity style={styles.callBtn}>
                            <Text style={styles.callIcon}>📞</Text>
                        </TouchableOpacity>
                    </Card>
                )}

                {/* Dynamic Action Area based on Status */}
                {status === 'worker_arrived' && (
                    <Card glow style={styles.actionCard}>
                        <Text style={styles.actionTitle}>Share Start Code</Text>
                        <Text style={styles.actionSub}>Give this 4-digit code to {mockWorker.name} to begin the work timer.</Text>
                        {startOtp ? (
                            <View style={[styles.readOnlyOtpWrap, { marginTop: spacing.md }]}>
                                <Text style={styles.readOnlyOtpTxt}>{startOtp}</Text>
                            </View>
                        ) : (
                            <Text style={styles.placeholderNote}>⏳ Loading start code from server...</Text>
                        )}
                    </Card>
                )}

                {status === 'pending_completion' && (
                    <Card glow style={styles.actionCard}>
                        <Text style={styles.actionTitle}>Verify Completion</Text>
                        <Text style={styles.actionSub}>Ask {mockWorker.name} for the End OTP to confirm the work is done and stop the timer.</Text>
                        <View style={{ marginTop: spacing.md }}>
                            <OTPInput
                                disabled={verifyingEndOtp}
                                onComplete={async (code) => {
                                    setVerifyingEndOtp(true);
                                    try {
                                        await apiClient.post(`/api/jobs/${jobId}/verify-end-otp`, { code });
                                        navigation.replace('Payment', { jobId });
                                    } catch (err) {
                                        Alert.alert('Invalid OTP', err.response?.data?.message || 'Verification failed. Try again.');
                                    } finally {
                                        setVerifyingEndOtp(false);
                                    }
                                }}
                            />
                        </View>
                    </Card>
                )}

                {status === 'disputed' && (
                    <Card glow style={[styles.actionCard, { borderColor: colors.error }]}>
                        <Text style={[styles.actionTitle, { color: colors.error }]}>⚠️ Dispute Review</Text>
                        <Text style={styles.actionSub}>This job is locked pending an admin review.</Text>
                        {autoEscalateAt && (
                            <Text style={styles.actionSub}>Auto-escalation will occur at: {new Date(autoEscalateAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</Text>
                        )}
                        <Text style={styles.placeholderNote}>Our team will contact you shortly.</Text>
                    </Card>
                )}

                {status === 'in_progress' && (
                    <View style={styles.inProgressWrap}>
                        <Card glow style={styles.ipCard}>
                            <Text style={styles.ipTitle}>Work in Progress</Text>
                            <Text style={styles.ipTimer}>⏱ {workStartedAt ? formatTime(elapsedSeconds) : 'Starting...'}</Text>
                            <Text style={styles.ipSub}>Timer is currently running</Text>
                        </Card>
                        <TouchableOpacity style={styles.reportBtn}>
                            <Text style={styles.reportTxt}>⚠️ Report Issue</Text>
                        </TouchableOpacity>
                    </View>
                )}

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
    title: { color: colors.text.primary, fontSize: 18, fontWeight: '700', letterSpacing: 1 },
    emergencyBadge: { backgroundColor: colors.error + '33', color: colors.error, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, fontSize: 10, fontWeight: '800', overflow: 'hidden', marginTop: 4 },
    scheduleBadge: { backgroundColor: colors.gold.primary + '33', color: colors.gold.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, fontSize: 10, fontWeight: '700', overflow: 'hidden', marginTop: 4 },

    content: { padding: spacing.lg, gap: spacing.lg },

    timelineCard: { padding: spacing.xl },
    tickRow: { flexDirection: 'row', gap: spacing.md, minHeight: 40 },
    tickCol: { alignItems: 'center', width: 20 },
    dot: { width: 12, height: 12, borderRadius: 6, zIndex: 2 },
    line: { width: 2, flex: 1, marginVertical: -4, zIndex: 1 },
    tickLabel: { color: colors.text.muted, fontSize: 14, fontWeight: '500', marginTop: -2 },
    tickLabelPast: { color: colors.text.primary },
    tickLabelCurrent: { color: colors.gold.primary, fontWeight: '700' },

    workerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
    wPhoto: { width: 50, height: 50, borderRadius: 25 },
    wInfo: { flex: 1 },
    wName: { color: colors.text.primary, fontSize: 18, fontWeight: '700' },
    wMeta: { color: colors.text.secondary, fontSize: 13, marginTop: 2 },
    callBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: colors.bg.surface, justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: colors.gold.primary + '44'
    },
    callIcon: { fontSize: 20 },

    actionCard: { padding: spacing.xl, borderColor: colors.gold.primary, borderWidth: 1, alignItems: 'center' },
    actionTitle: { color: colors.gold.primary, fontSize: 20, fontWeight: '800' },
    actionSub: { color: colors.text.secondary, fontSize: 13, textAlign: 'center', marginTop: spacing.sm },
    placeholderNote: { color: colors.text.muted, fontSize: 13, marginTop: spacing.md, fontStyle: 'italic' },

    inProgressWrap: { gap: spacing.md },
    ipCard: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.bg.surface },
    ipTitle: { color: colors.text.primary, fontSize: 18, fontWeight: '700' },
    ipTimer: { color: colors.gold.primary, fontSize: 28, fontWeight: '800' },
    ipSub: { color: colors.text.muted, fontSize: 13 },
    reportBtn: { alignSelf: 'center', padding: spacing.md },
    reportTxt: { color: colors.error, fontWeight: '600' }
});
