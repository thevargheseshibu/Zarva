import React, { useState, useEffect, useCallback } from 'react';
import { useTokens } from '../../design-system';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Linking, TextInput } from 'react-native';
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
    const [showingEstimate, setShowingEstimate] = useState(false);
    const [estimateData, setEstimateData] = useState({ minutes: '', notes: '' });
    const [timerActive, setTimerActive] = useState(false);
    const [timeElapsed, setTimeElapsed] = useState(0);
    const [endOtp, setEndOtp] = useState('----');
    const [otpExpirySeconds, setOtpExpirySeconds] = useState(null);
    const [inspectionExpirySeconds, setInspectionExpirySeconds] = useState(null);
    const [chatUnread, setChatUnread] = useState(0);

    useEffect(() => {
        if (!jobId) return;
        const jobRef = ref(db, `active_jobs/${jobId}`);
        const listener = onValue(jobRef, (snapshot) => {
            const data = snapshot.val();
            if (data?.status) setStatus(data.status);
        });

        const chatUnreadRef = ref(db, `active_jobs/${jobId}/chat_unread/worker`);
        const chatListener = onValue(chatUnreadRef, (snapshot) => {
            setChatUnread(snapshot.val() || 0);
        });

        return () => {
            off(jobRef, 'value', listener);
            off(chatUnreadRef, 'value', chatListener);
        };
    }, [jobId]);

    useEffect(() => {
        let int;
        const updateTimer = () => {
            if (!job) return;

            let totalSeconds = 0;

            // 1. Inspection Phase
            if (job.inspection_started_at) {
                const start = new Date(job.inspection_started_at).getTime();
                const end = job.inspection_ended_at ? new Date(job.inspection_ended_at).getTime() : Date.now();
                if (status === 'inspection_active' || job.inspection_ended_at) {
                    totalSeconds += Math.max(0, Math.floor((end - start) / 1000));
                }
            }

            // 2. Job Phase
            if (job.job_started_at) {
                const start = new Date(job.job_started_at).getTime();
                const end = job.job_ended_at ? new Date(job.job_ended_at).getTime() : Date.now();
                if (status === 'in_progress' || job.job_ended_at) {
                    totalSeconds += Math.max(0, Math.floor((end - start) / 1000));
                }
            }

            setTimeElapsed(totalSeconds);
        };

        if (timerActive || status === 'inspection_active' || status === 'in_progress') {
            updateTimer();
            int = setInterval(updateTimer, 1000);
        }
        return () => clearInterval(int);
    }, [timerActive, status, job]);

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

    useEffect(() => {
        let int;
        if (status === 'worker_arrived' && job?.inspection_expires_at) {
            const expiryTime = new Date(job.inspection_expires_at).getTime();
            const updateExpiry = () => {
                const remaining = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
                setInspectionExpirySeconds(remaining);
            };
            updateExpiry();
            int = setInterval(updateExpiry, 1000);
        }
        return () => clearInterval(int);
    }, [status, job?.inspection_expires_at]);

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
            const res = await apiClient.post(`/api/worker/jobs/${jobId}/verify-start-otp`, { code });

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

    const handleVerifyInspectionOtp = async () => {
        const code = inspectionOtp.join('');
        if (code.length !== 4) return;
        setActionLoading(true);
        try {
            const res = await apiClient.post(`/api/worker/jobs/${jobId}/verify-inspection-otp`, { otp: code });
            if (res.data?.verified) {
                setShowingEstimate(true);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Invalid Inspection Code.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSubmitEstimate = async () => {
        if (!estimateData.minutes || isNaN(estimateData.minutes)) {
            return Alert.alert('Invalid Input', 'Please enter a valid number of minutes.');
        }
        setActionLoading(true);
        try {
            await apiClient.post(`/api/worker/jobs/${jobId}/inspection/estimate`, {
                estimated_minutes: parseInt(estimateData.minutes, 10),
                notes: estimateData.notes,
            });
            setShowingEstimate(false);
            setStatus('estimate_submitted');
            setStartOtp(['', '', '', '']);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to submit estimate.');
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
        const isInspection = status === 'inspection_active';
        const isEstimateSubmitted = status === 'estimate_submitted';
        const isInProgress = status === 'in_progress';
        const isPending = status === 'pending_completion';

        if (isAssigned) {
            return (
                <FadeInView delay={200} style={styles.actionSection}>
                    <Card style={styles.actionCard}>
                        <Text style={styles.actionLabel}>{t('mission_status')}</Text>
                        <Text style={styles.actionTitle}>{t('navigate_to_client')}</Text>
                        <Text style={styles.actionSub}>{t('navigate_desc')}</Text>
                        <PremiumButton
                            title={t('confirm_arrival')}
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
                    <Card glow style={styles.premiumActionCard}>
                        <View style={styles.luxuryHeader}>
                            <View style={[styles.luxuryIconBox, { backgroundColor: tTheme.brand.primary + '11' }]}>
                                <Text style={styles.luxuryIcon}>🔐</Text>
                            </View>
                            <View>
                                <Text style={styles.luxuryLabel}>{t('authentication').toUpperCase()}</Text>
                                <Text style={styles.luxuryTitle}>Secure Arrival</Text>
                            </View>
                        </View>

                        <View style={styles.counterSection}>
                            <View style={styles.countCircle}>
                                <Text style={styles.countValue}>{inspectionExpirySeconds !== null ? formatTime(inspectionExpirySeconds) : '--:--'}</Text>
                                <Text style={styles.countLabel}>INSPECTION TIME</Text>
                            </View>
                            <Text style={styles.counterHint}>Verify arrival with the customer within this window to start your assessment.</Text>
                        </View>

                        <View style={styles.otpLuxWrap}>
                            <Text style={styles.otpLuxLabel}>ENTER INSPECTION CODE</Text>
                            <OTPInput
                                disabled={actionLoading}
                                onChange={(code) => setInspectionOtp(code.split('').concat(Array(4).fill('')).slice(0, 4))}
                            />
                        </View>

                        <PremiumButton
                            title="Verify & Begin Inspection"
                            onPress={handleVerifyInspectionOtp}
                            loading={actionLoading}
                            disabled={inspectionOtp.join('').length < 4}
                            style={styles.luxButton}
                        />
                    </Card>
                </FadeInView>
            );
        }

        if (isInspection) {
            return (
                <FadeInView delay={200} style={styles.actionSection}>
                    <Card glow style={styles.premiumActionCard}>
                        <View style={styles.luxuryHeader}>
                            <View style={[styles.luxuryIconBox, { backgroundColor: '#00E0FF11' }]}>
                                <Text style={styles.luxuryIcon}>📋</Text>
                            </View>
                            <View>
                                <Text style={styles.luxuryLabel}>ASSESSMENT PHASE</Text>
                                <Text style={styles.luxuryTitle}>Service Estimate</Text>
                            </View>
                        </View>

                        <View style={styles.estimateFormLuxury}>
                            <View style={styles.inputGroupLux}>
                                <Text style={styles.luxInputLabel}>ESTIMATED MINUTES</Text>
                                <View style={styles.luxInputContainer}>
                                    <TextInput
                                        style={styles.luxTextInput}
                                        keyboardType="numeric"
                                        placeholder="60"
                                        placeholderTextColor={tTheme.text.tertiary}
                                        value={estimateData.minutes}
                                        onChangeText={(val) => setEstimateData(prev => ({ ...prev, minutes: val }))}
                                    />
                                    <View style={styles.luxUnitBox}><Text style={styles.luxUnitTxt}>MIN</Text></View>
                                </View>
                            </View>

                            <View style={styles.inputGroupLux}>
                                <Text style={styles.luxInputLabel}>FINDINGS & NOTES</Text>
                                <TextInput
                                    style={styles.luxTextArea}
                                    multiline
                                    placeholder="Describe the issue and proposed fix..."
                                    placeholderTextColor={tTheme.text.tertiary}
                                    value={estimateData.notes}
                                    onChangeText={(val) => setEstimateData(prev => ({ ...prev, notes: val }))}
                                />
                            </View>
                        </View>

                        <PremiumButton
                            title="Send Estimate to Client"
                            onPress={handleSubmitEstimate}
                            loading={actionLoading}
                            style={styles.luxButton}
                        />
                    </Card>
                </FadeInView>
            );
        }

        if (isEstimateSubmitted) {
            return (
                <FadeInView delay={200} style={styles.actionSection}>
                    <Card style={styles.actionCard}>
                        <Text style={styles.actionLabel}>{t('authentication')}</Text>
                        <Text style={styles.actionTitle}>{t('enter_start_code')}</Text>
                        <Text style={styles.actionSub}>Waiting for client to approve estimate. Enter their start code once provided.</Text>
                        <View style={styles.otpWrap}>
                            <OTPInput
                                disabled={actionLoading}
                                onChange={(code) => setStartOtp(code.split('').concat(Array(4).fill('')).slice(0, 4))}
                            />
                        </View>
                        <PremiumButton
                            title={t('start_billable_session')}
                            onPress={handleVerifyStartOtp}
                            loading={actionLoading}
                            disabled={startOtp.join('').length < 4}
                        />
                        {otpExpirySeconds !== null && (
                            <Text style={styles.expiryTxt}>{t('code_expires_in')}{formatTime(otpExpirySeconds)}</Text>
                        )}
                    </Card>
                </FadeInView>
            );
        }

        if (isInProgress) {
            return (
                <FadeInView delay={200} style={styles.actionSection}>
                    <Card style={styles.actionCard}>
                        <Text style={styles.actionLabel}>{t('active_session')}</Text>
                        <View style={styles.timerBox}>
                            <Text style={styles.timerValue}>{formatTime(timeElapsed)}</Text>
                            <View style={styles.liveBadge}>
                                <View style={styles.liveDot} />
                                <Text style={styles.liveTxt}>{t('live_billing')}</Text>
                            </View>
                        </View>
                        <Text style={styles.actionSub}>{t('active_session_desc')}</Text>
                        <PremiumButton
                            title="Request Time Extension"
                            variant="secondary"
                            onPress={() => navigation.navigate('ExtensionRequest', { jobId })}
                            disabled={actionLoading}
                            style={{ marginBottom: 12 }}
                        />
                        <PremiumButton
                            title={t('terminate_complete')}
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
                        <Text style={styles.actionLabel}>{t('finalization')}</Text>
                        <Text style={styles.actionTitle}>{t('share_completion_code')}</Text>
                        <Text style={styles.actionSub}>{t('share_completion_code_desc')}</Text>
                        <View style={styles.endOtpBox}>
                            <Text style={styles.endOtpCode}>{endOtp}</Text>
                        </View>
                        <View style={styles.waitingIconBox}>
                            <ActivityIndicator size="small" color={tTheme.brand.primary} />
                            <Text style={styles.waitingTxt}>{t('awaiting_confirmation')}</Text>
                        </View>
                    </Card>
                </FadeInView>
            );
        }

        return (
            <FadeInView delay={200} style={styles.finishedBox}>
                <Text style={styles.finishStatus}>{t('mission_complete')}</Text>
                <Text style={styles.finishTitle}>{t('session_archived')}</Text>
                <PremiumButton
                    variant="ghost"
                    title={t('return_to_dashboard')}
                    onPress={() => navigation.navigate('WorkerTabs')}
                />
            </FadeInView>
        );
    };

    if (loading) return (
        <View style={styles.loadingScreen}>
            <ActivityIndicator size="large" color={tTheme.brand.primary} />
            <Text style={styles.loadingTxt}>{t('syncing_session')}</Text>
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
                    <Text style={styles.headerTitle}>{t('live_operations')}</Text>
                    <View style={styles.statusPillWrap}>
                        <StatusPill status={status} />
                    </View>
                </View>
                {['assigned', 'worker_en_route', 'worker_arrived', 'estimate_submitted', 'in_progress', 'pending_completion'].includes(status) && job ? (
                    <PressableAnimated
                        style={styles.headerChatBtn}
                        onPress={() => navigation.navigate('Chat', { jobId, userRole: 'worker', otherUserId: job.customer_id })}
                    >
                        <Text style={styles.chatIcon}>💬</Text>
                        {chatUnread > 0 && (
                            <View style={styles.unreadBadge}>
                                <Text style={styles.unreadTxt}>{chatUnread}</Text>
                            </View>
                        )}
                    </PressableAnimated>
                ) : (
                    <View style={{ width: 44 }} />
                )}
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
                                <Text style={styles.clientLabel}>{t('client_label')}</Text>
                                <Text style={styles.clientName}>{job?.customer_name || 'Client'}</Text>
                                <Text style={styles.categoryTxt}>{job?.category}</Text>
                            </View>
                        </View>

                        <View style={styles.jobLocation}>
                            <View style={styles.locLeft}>
                                <Text style={styles.locLabel}>{t('service_address')}</Text>
                                <Text style={styles.locAddress} numberOfLines={2}>{job?.address}</Text>
                            </View>
                            <PressableAnimated style={styles.navBtn} onPress={handleNavigate}>
                                <Text style={styles.navBtnIcon}>🧭</Text>
                            </PressableAnimated>
                        </View>

                        <View style={styles.contactActions}>
                            <TouchableOpacity style={styles.contactBtn} onPress={handleCall}>
                                <Text style={styles.contactIcon}>📞</Text>
                                <Text style={styles.contactTxt}>{t('voice_call')}</Text>
                            </TouchableOpacity>
                        </View>
                    </Card>
                </FadeInView>

                {renderActionView()}
            </ScrollView>
        </View>
    );
}

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.app },
    loadingScreen: { flex: 1, backgroundColor: t.background.app, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingTxt: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1 },

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
    headerCenter: { alignItems: 'center', gap: 4 },
    headerTitle: { color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.bold, letterSpacing: t.typography.tracking.body },
    statusPillWrap: { transform: [{ scale: 0.85 }] },
    headerChatBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.background.surfaceRaised, justifyContent: 'center', alignItems: 'center', position: 'relative' },
    chatIcon: { fontSize: 20 },
    unreadBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: t.status.error.base, minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: t.background.app },
    unreadTxt: { color: '#FFF', fontSize: 10, fontWeight: '900' },

    scrollContent: { padding: t.spacing['2xl'], paddingBottom: 120, gap: t.spacing['2xl'] },

    clientCard: { padding: t.spacing['2xl'], gap: t.spacing[20], backgroundColor: t.background.surface, borderWidth: 1, borderColor: t.border.default + '11' },
    clientTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    clientAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: t.brand.primary + '11', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: t.border.default + '22' },
    avatarTxt: { color: t.brand.primary, fontSize: 20, fontWeight: '900' },
    clientInfo: { gap: 2 },
    clientLabel: { color: t.brand.primary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1.5 },
    clientName: { color: t.text.primary, fontSize: t.typography.size.title, fontWeight: t.typography.weight.bold },
    categoryTxt: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.medium },

    jobLocation: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: t.background.surfaceRaised,
        padding: t.spacing.lg,
        borderRadius: t.radius.lg,
        borderWidth: 1,
        borderColor: t.background.surface
    },
    locLeft: { flex: 1, gap: 4 },
    locLabel: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1 },
    locAddress: { color: t.text.primary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.medium },
    navBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.brand.primary + '22', justifyContent: 'center', alignItems: 'center' },
    navBtnIcon: { fontSize: 16 },

    contactActions: { marginTop: 4 },
    contactBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: t.radius.md,
        borderWidth: 1,
        borderColor: t.border.default + '44'
    },
    contactIcon: { fontSize: 14 },
    contactTxt: { color: t.text.primary, fontSize: 9, fontWeight: t.typography.weight.bold, letterSpacing: 1 },

    actionCard: { padding: t.spacing['2xl'], alignItems: 'center', backgroundColor: t.background.surface, borderWidth: 1, borderColor: t.brand.primary + '22' },
    actionLabel: { color: t.brand.primary, fontSize: 9, fontWeight: t.typography.weight.bold, letterSpacing: 2, marginBottom: 8 },
    actionTitle: { color: t.text.primary, fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
    actionSub: { color: t.text.tertiary, fontSize: t.typography.size.caption, textAlign: 'center', lineHeight: 20, marginBottom: t.spacing['2xl'] },

    estimateInputWrap: { width: '100%', gap: 8, marginBottom: t.spacing['2xl'] },
    inputLabel: { color: t.text.secondary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.bold, marginTop: t.spacing.sm, letterSpacing: t.typography.tracking.caption },
    textInput: { backgroundColor: t.background.app, color: t.text.primary, padding: t.spacing.lg, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.border.default, fontSize: 16 },
    textInputArea: { backgroundColor: t.background.app, color: t.text.primary, padding: t.spacing.lg, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.border.default, fontSize: 16, minHeight: 100, textAlignVertical: 'top' },

    otpWrap: { width: '100%', alignItems: 'center', marginBottom: t.spacing['2xl'] },
    expiryTxt: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.bold, marginTop: 16, letterSpacing: 1 },

    timerBox: { alignItems: 'center', gap: 12, marginBottom: t.spacing['2xl'] },
    timerValue: { color: t.text.primary, fontSize: 56, fontWeight: '900', letterSpacing: 2 },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: t.brand.primary + '11',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: t.radius.full
    },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.brand.primary },
    liveTxt: { color: t.brand.primary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1 },

    endOtpBox: {
        backgroundColor: t.background.surfaceRaised,
        paddingHorizontal: 32,
        paddingVertical: 20,
        borderRadius: t.radius.xl,
        marginBottom: t.spacing['2xl'],
        borderWidth: 1,
        borderColor: t.border.default + '11'
    },
    endOtpCode: { color: t.brand.primary, fontSize: 44, fontWeight: '900', letterSpacing: 8 },
    waitingIconBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    waitingTxt: { color: t.text.tertiary, fontSize: 10, fontStyle: 'italic' },

    finishedBox: { alignItems: 'center', gap: 8, marginTop: 20 },
    finishStatus: { color: t.brand.primary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 2 },
    finishTitle: { color: t.text.primary, fontSize: 24, fontWeight: '900', marginBottom: 16 }
});
