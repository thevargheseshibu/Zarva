import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Linking } from 'react-native';
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
import { colors, radius, spacing, shadows } from '../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../design-system/typography';

export default function ActiveJobScreen({ route, navigation }) {
    const t = useT();
    const { jobId } = route.params || {};
    const [status, setStatus] = useState('assigned');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [job, setJob] = useState(null);
    const [startOtp, setStartOtp] = useState(['', '', '', '']);
    const [timerActive, setTimerActive] = useState(false);
    const [timeElapsed, setTimeElapsed] = useState(0);
    const [endOtp, setEndOtp] = useState('----');
    const [otpExpirySeconds, setOtpExpirySeconds] = useState(null);

    useEffect(() => {
        if (!jobId) return;
        const jobRef = ref(db, `active_jobs/${jobId}`);
        const listener = onValue(jobRef, (snapshot) => {
            const data = snapshot.val();
            if (data?.status) setStatus(data.status);
        });
        return () => off(jobRef, 'value', listener);
    }, [jobId]);

    useEffect(() => {
        let int;
        if (timerActive || status === 'in_progress') {
            int = setInterval(() => setTimeElapsed(p => p + 1), 1000);
        }
        return () => clearInterval(int);
    }, [timerActive, status]);

    useEffect(() => {
        let int;
        if (status === 'worker_arrived' && job?.start_otp_generated_at) {
            const expiryTime = new Date(job.start_otp_generated_at).getTime() + 3600000;
            const updateExpiry = () => {
                const remaining = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
                setOtpExpirySeconds(remaining);
            };
            updateExpiry();
            int = setInterval(updateExpiry, 1000);
        }
        return () => clearInterval(int);
    }, [status, job?.start_otp_generated_at]);

    const fetchJob = async () => {
        try {
            setLoading(true);
            const res = await apiClient.get(`/api/worker/jobs/${jobId}`);
            const data = res.data?.job;
            setJob(data);
            if (data.status) setStatus(data.status);
            if (data.status === 'in_progress') setTimerActive(true);
            if (data.end_otp) setEndOtp(data.end_otp);
        } catch (err) {
            Alert.alert('Error', 'Could not load job details.');
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { if (jobId) fetchJob(); }, [jobId]));

    const handleCall = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (job?.customer_phone) Linking.openURL(`tel:${job.customer_phone}`);
    };

    const handleNavigate = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const query = encodeURIComponent(job?.address || 'Kochi');
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${query}`);
    };

    const handleArrived = async () => {
        setActionLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await apiClient.post(`/api/worker/jobs/${jobId}/arrived`);
            setStatus('worker_arrived');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to update status.');
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
            await apiClient.post(`/api/worker/jobs/${jobId}/verify-start-otp`, { code });
            setStatus('in_progress');
            setTimerActive(true);
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
            setTimerActive(false);
            setStatus('pending_completion');
            if (res.data?.end_otp) setEndOtp(res.data.end_otp);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to complete job.');
        } finally {
            setActionLoading(false);
        }
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const renderActionView = () => {
        const isAssigned = status === 'assigned' || status === 'worker_en_route';
        const isArrived = status === 'worker_arrived';
        const isInProgress = status === 'in_progress';
        const isPending = status === 'pending_completion';

        if (isAssigned) {
            return (
                <FadeInView delay={200} style={styles.actionSection}>
                    <Card style={styles.actionCard}>
                        <Text style={styles.actionLabel}>MISSION STATUS</Text>
                        <Text style={styles.actionTitle}>Navigate to Client</Text>
                        <Text style={styles.actionSub}>Follow the GPS to the specified location. Confirm arrival to request the Start Code.</Text>
                        <PremiumButton
                            title="Confirm Arrival"
                            onPress={handleArrived}
                            loading={actionLoading}
                        />
                    </Card>
                </FadeInView>
            );
        }

        if (isArrived) {
            return (
                <FadeInView delay={200} style={styles.actionSection}>
                    <Card style={styles.actionCard}>
                        <Text style={styles.actionLabel}>AUTHENTICATION</Text>
                        <Text style={styles.actionTitle}>Enter Start Code</Text>
                        <Text style={styles.actionSub}>The client has been provided a 4-digit code. Enter it below to begin the billable session.</Text>
                        <View style={styles.otpWrap}>
                            <OTPInput
                                disabled={actionLoading}
                                onChange={(code) => setStartOtp(code.split('').concat(Array(4).fill('')).slice(0, 4))}
                            />
                        </View>
                        <PremiumButton
                            title="Start Billable Session"
                            onPress={handleVerifyStartOtp}
                            loading={actionLoading}
                            disabled={startOtp.join('').length < 4}
                        />
                        {otpExpirySeconds !== null && (
                            <Text style={styles.expiryTxt}>CODE EXPIRES IN: {formatTime(otpExpirySeconds)}</Text>
                        )}
                    </Card>
                </FadeInView>
            );
        }

        if (isInProgress) {
            return (
                <FadeInView delay={200} style={styles.actionSection}>
                    <Card style={styles.actionCard}>
                        <Text style={styles.actionLabel}>ACTIVE SESSION</Text>
                        <View style={styles.timerBox}>
                            <Text style={styles.timerValue}>{formatTime(timeElapsed)}</Text>
                            <View style={styles.liveBadge}>
                                <View style={styles.liveDot} />
                                <Text style={styles.liveTxt}>LIVE BILLING</Text>
                            </View>
                        </View>
                        <Text style={styles.actionSub}>Perform requested tasks with excellence. Tap below once the job is physically completed.</Text>
                        <PremiumButton
                            title="Terminate & Complete"
                            onPress={handleMarkComplete}
                            loading={actionLoading}
                        />
                    </Card>
                </FadeInView>
            );
        }

        if (isPending) {
            return (
                <FadeInView delay={200} style={styles.actionSection}>
                    <Card style={styles.actionCard}>
                        <Text style={styles.actionLabel}>FINALIZATION</Text>
                        <Text style={styles.actionTitle}>Share Completion Code</Text>
                        <Text style={styles.actionSub}>Provide this code to the client. They must enter it on their device to release payment.</Text>
                        <View style={styles.endOtpBox}>
                            <Text style={styles.endOtpCode}>{endOtp}</Text>
                        </View>
                        <View style={styles.waitingIconBox}>
                            <ActivityIndicator size="small" color={colors.accent.primary} />
                            <Text style={styles.waitingTxt}>Awaiting client confirmation...</Text>
                        </View>
                    </Card>
                </FadeInView>
            );
        }

        return (
            <FadeInView delay={200} style={styles.finishedBox}>
                <Text style={styles.finishStatus}>MISSION COMPLETE</Text>
                <Text style={styles.finishTitle}>Session Archived</Text>
                <PremiumButton
                    variant="ghost"
                    title="Return to Dashboard"
                    onPress={() => navigation.navigate('WorkerTabs')}
                />
            </FadeInView>
        );
    };

    if (loading) return (
        <View style={styles.loadingScreen}>
            <ActivityIndicator size="large" color={colors.accent.primary} />
            <Text style={styles.loadingTxt}>Synchronizing session...</Text>
        </View>
    );

    return (
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <PressableAnimated onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace('WorkerTabs')} style={styles.headerBtn}>
                    <Text style={styles.headerBtnTxt}>←</Text>
                </PressableAnimated>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Live Operations</Text>
                    <View style={styles.statusPillWrap}>
                        <StatusPill status={status} />
                    </View>
                </View>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* Client Profile Card */}
                <FadeInView delay={100}>
                    <Card style={styles.clientCard}>
                        <View style={styles.clientTop}>
                            <View style={styles.clientAvatar}>
                                <Text style={styles.avatarTxt}>{job?.customer_name?.charAt(0) || 'C'}</Text>
                            </View>
                            <View style={styles.clientInfo}>
                                <Text style={styles.clientLabel}>CLIENT</Text>
                                <Text style={styles.clientName}>{job?.customer_name || 'Client'}</Text>
                                <Text style={styles.categoryTxt}>{job?.category}</Text>
                            </View>
                        </View>

                        <View style={styles.jobLocation}>
                            <View style={styles.locLeft}>
                                <Text style={styles.locLabel}>SERVICE ADDRESS</Text>
                                <Text style={styles.locAddress} numberOfLines={2}>{job?.address}</Text>
                            </View>
                            <PressableAnimated style={styles.navBtn} onPress={handleNavigate}>
                                <Text style={styles.navBtnIcon}>🧭</Text>
                            </PressableAnimated>
                        </View>

                        <View style={styles.contactActions}>
                            <TouchableOpacity style={styles.contactBtn} onPress={handleCall}>
                                <Text style={styles.contactIcon}>📞</Text>
                                <Text style={styles.contactTxt}>VOICE CALL</Text>
                            </TouchableOpacity>
                        </View>
                    </Card>
                </FadeInView>

                {renderActionView()}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    loadingScreen: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingTxt: { color: colors.text.muted, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1 },

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
    headerCenter: { alignItems: 'center', gap: 4 },
    headerTitle: { color: colors.text.primary, fontSize: fontSize.body, fontWeight: fontWeight.bold, letterSpacing: tracking.body },
    statusPillWrap: { transform: [{ scale: 0.85 }] },

    scrollContent: { padding: spacing[24], paddingBottom: 120, gap: spacing[24] },

    clientCard: { padding: spacing[24], gap: spacing[20], backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accent.border + '11' },
    clientTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    clientAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent.primary + '11', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.accent.border + '22' },
    avatarTxt: { color: colors.accent.primary, fontSize: 20, fontWeight: '900' },
    clientInfo: { gap: 2 },
    clientLabel: { color: colors.accent.primary, fontSize: 8, fontWeight: fontWeight.bold, letterSpacing: 1.5 },
    clientName: { color: colors.text.primary, fontSize: fontSize.title, fontWeight: fontWeight.bold },
    categoryTxt: { color: colors.text.muted, fontSize: 10, fontWeight: fontWeight.medium },

    jobLocation: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.elevated,
        padding: spacing[16],
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.surface
    },
    locLeft: { flex: 1, gap: 4 },
    locLabel: { color: colors.text.muted, fontSize: 8, fontWeight: fontWeight.bold, letterSpacing: 1 },
    locAddress: { color: colors.text.primary, fontSize: fontSize.caption, fontWeight: fontWeight.medium },
    navBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent.primary + '22', justifyContent: 'center', alignItems: 'center' },
    navBtnIcon: { fontSize: 16 },

    contactActions: { marginTop: 4 },
    contactBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.accent.border + '44'
    },
    contactIcon: { fontSize: 14 },
    contactTxt: { color: colors.text.primary, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 1 },

    actionCard: { padding: spacing[24], alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accent.primary + '22' },
    actionLabel: { color: colors.accent.primary, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 2, marginBottom: 8 },
    actionTitle: { color: colors.text.primary, fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
    actionSub: { color: colors.text.muted, fontSize: fontSize.caption, textAlign: 'center', lineHeight: 20, marginBottom: spacing[24] },

    otpWrap: { width: '100%', marginBottom: spacing[24] },
    expiryTxt: { color: colors.text.muted, fontSize: 8, fontWeight: fontWeight.bold, marginTop: 16, letterSpacing: 1 },

    timerBox: { alignItems: 'center', gap: 12, marginBottom: spacing[24] },
    timerValue: { color: colors.text.primary, fontSize: 56, fontWeight: '900', letterSpacing: 2 },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.accent.primary + '11',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radius.full
    },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent.primary },
    liveTxt: { color: colors.accent.primary, fontSize: 8, fontWeight: fontWeight.bold, letterSpacing: 1 },

    endOtpBox: {
        backgroundColor: colors.elevated,
        paddingHorizontal: 32,
        paddingVertical: 20,
        borderRadius: radius.xl,
        marginBottom: spacing[24],
        borderWidth: 1,
        borderColor: colors.accent.border + '11'
    },
    endOtpCode: { color: colors.accent.primary, fontSize: 44, fontWeight: '900', letterSpacing: 8 },
    waitingIconBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    waitingTxt: { color: colors.text.muted, fontSize: 10, fontStyle: 'italic' },

    finishedBox: { alignItems: 'center', gap: 8, marginTop: 20 },
    finishStatus: { color: colors.accent.primary, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 2 },
    finishTitle: { color: colors.text.primary, fontSize: 24, fontWeight: '900', marginBottom: 16 }
});
