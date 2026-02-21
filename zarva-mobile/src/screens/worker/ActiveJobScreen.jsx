import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../../design-system/tokens';
import StatusPill from '../../components/StatusPill';
import GoldButton from '../../components/GoldButton';
import apiClient from '../../services/api/client';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../../utils/firebase';
import { parseJobDescription } from '../../utils/jobParser';

export default function ActiveJobScreen({ route, navigation }) {
    const { jobId } = route.params || {};

    const [status, setStatus] = useState('assigned');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Real job data from server
    const [job, setJob] = useState(null);

    // Sub-view states
    const [startOtp, setStartOtp] = useState(['', '', '', '']);
    const [timerActive, setTimerActive] = useState(false);
    const [timeElapsed, setTimeElapsed] = useState(0);
    const [endOtp, setEndOtp] = useState('----'); // Fetched from server on completion
    const [otpExpirySeconds, setOtpExpirySeconds] = useState(null);

    // Firebase Listener to keep status synced (e.g. if customer cancels)
    useEffect(() => {
        if (!jobId) return;
        const jobRef = ref(db, `active_jobs/${jobId}`);
        const listener = onValue(jobRef, (snapshot) => {
            const data = snapshot.val();
            if (data && data.status) setStatus(data.status);
        });
        return () => off(jobRef, 'value', listener);
    }, [jobId]);

    // Timer logic
    useEffect(() => {
        let int;
        if (timerActive || status === 'in_progress') {
            int = setInterval(() => setTimeElapsed(p => p + 1), 1000);
        }
        return () => clearInterval(int);
    }, [timerActive, status]);

    // OTP Expiry Timer (Issue #23)
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
            console.error('Failed to fetch job', err);
            Alert.alert('Error', 'Could not load job details.');
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            if (jobId) fetchJob();
        }, [jobId])
    );

    const handleCall = () => {
        if (job?.customer_phone) Linking.openURL(`tel:${job.customer_phone}`);
    };

    const handleNavigate = () => {
        // Fallback or real coordinates if we add them later to jobs table. We use address for now.
        const query = encodeURIComponent(job?.address || 'Kochi');
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${query}`);
    };

    const handleArrived = async () => {
        setActionLoading(true);
        try {
            await apiClient.post(`/api/worker/jobs/${jobId}/arrived`);
            setStatus('worker_arrived');
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
        try {
            await apiClient.post(`/api/worker/jobs/${jobId}/verify-start-otp`, { code });
            setStatus('in_progress');
            setTimerActive(true);
        } catch (err) {
            if (err.response?.status === 403) {
                Alert.alert('Dispute Raised', 'Maximum attempts reached. This job has been disputed.');
                setStatus('disputed');
            } else {
                Alert.alert('Invalid Code', err.response?.data?.message || 'Incorrect start code.');
                setStartOtp(['', '', '', '']);
            }
        } finally {
            setActionLoading(false);
        }
    };

    const handleDispute = () => {
        Alert.alert(
            'Report Issue',
            'Are you sure you want to log a dispute for this job? It will be suspended pending admin review.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Proceed',
                    style: 'destructive',
                    onPress: async () => {
                        setActionLoading(true);
                        try {
                            await apiClient.post(`/api/worker/jobs/${jobId}/dispute`, { reason: 'Worker-initiated dispute via ActiveJob App' });
                            setStatus('disputed');
                            Alert.alert('Dispute Logged', 'Our administrative team will review this shortly.');
                        } catch (err) {
                            Alert.alert('Error', err.response?.data?.message || 'Failed to raise dispute.');
                        } finally {
                            setActionLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleMarkComplete = async () => {
        setActionLoading(true);
        try {
            const res = await apiClient.post(`/api/worker/jobs/${jobId}/complete`);
            setTimerActive(false);
            setStatus('pending_completion');
            if (res.data?.end_otp) setEndOtp(res.data.end_otp);
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
        if (status === 'assigned' || status === 'worker_en_route') {
            return (
                <View style={styles.actionBox}>
                    <Text style={styles.actionPrompt}>Head to the customer's location.</Text>
                    <GoldButton title="I've Arrived" onPress={handleArrived} disabled={actionLoading} loading={actionLoading} />
                </View>
            );
        }

        if (status === 'worker_arrived') {
            return (
                <View style={styles.actionBox}>
                    <Text style={styles.actionPrompt}>Ask Customer for START CODE</Text>
                    <Text style={styles.actionSub}>The customer's app shows a 4-digit code. Enter it to begin.</Text>

                    {otpExpirySeconds !== null && (
                        <Text style={[styles.actionSub, { color: otpExpirySeconds < 300 ? colors.error : colors.gold.primary, fontWeight: '700' }]}>
                            Expires in: {formatTime(otpExpirySeconds)}
                        </Text>
                    )}

                    <View style={styles.otpRow}>
                        {[0, 1, 2, 3].map(i => (
                            <View key={i} style={[styles.otpBox, startOtp[i] && styles.otpBoxActive]}>
                                <Text style={styles.otpTxt}>{startOtp[i] || '—'}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Developer Mock Numpad REMOVED for Production Security */}

                    <GoldButton
                        title="Begin Work"
                        disabled={startOtp.join('').length < 4 || actionLoading}
                        loading={actionLoading}
                        onPress={handleVerifyStartOtp}
                    />
                </View>
            );
        }

        if (status === 'in_progress') {
            return (
                <View style={styles.actionBox}>
                    <Text style={styles.actionPrompt}>Work In Progress</Text>

                    <View style={styles.timerCircle}>
                        <Text style={styles.timerVal}>{formatTime(timeElapsed)}</Text>
                        <Text style={styles.timerLbl}>Elapsed</Text>
                    </View>

                    <GoldButton title="Mark Work Complete" onPress={handleMarkComplete} disabled={actionLoading} loading={actionLoading} />

                    <TouchableOpacity style={styles.disputeBtn} onPress={handleDispute}>
                        <Text style={styles.disputeTxt}>⚠️ Report Issue / Dispute</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (status === 'pending_completion') {
            return (
                <View style={styles.actionBox}>
                    <Text style={styles.actionPrompt}>Show this code to customer</Text>
                    <Text style={styles.actionSub}>Customer must enter this END OTP on their app to release payment.</Text>

                    <View style={styles.readOnlyOtpWrap}>
                        <Text style={styles.readOnlyOtpTxt}>{endOtp}</Text>
                    </View>

                    <Text style={styles.waitingTxt}>⏳ Waiting for customer to confirm...</Text>
                </View>
            );
        }

        if (status === 'completed') {
            return (
                <View style={styles.actionBox}>
                    <Text style={styles.actionPrompt}>✅ Job Successfully Completed</Text>
                    <Text style={styles.actionSub}>The customer has confirmed the completion and payment has been processed.</Text>
                    <GoldButton title="Go to Dashboard" onPress={() => navigation.navigate('WorkerTabs')} />
                </View>
            );
        }

        if (status === 'cancelled') {
            return (
                <View style={styles.actionBox}>
                    <Text style={styles.actionPrompt}>❌ Job Cancelled</Text>
                    <Text style={styles.actionSub}>This job was cancelled.</Text>
                    <GoldButton title="Go to Dashboard" onPress={() => navigation.navigate('WorkerTabs')} />
                </View>
            );
        }

        if (status === 'disputed') {
            return (
                <View style={styles.actionBox}>
                    <Text style={styles.actionPrompt}>⚠️ Job Disputed</Text>
                    <Text style={styles.actionSub}>Too many incorrect OTP attempts or a dispute was raised. Our team will review this shortly.</Text>
                    <GoldButton title="Go to Dashboard" onPress={() => navigation.navigate('WorkerTabs')} />
                </View>
            );
        }
    };

    if (loading) {
        return (
            <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.gold.primary} />
            </View>
        );
    }

    if (!job) {
        return (
            <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: colors.text.muted }}>Job details not found.</Text>
                <GoldButton title="Go Back" onPress={() => navigation.goBack()} />
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backTxt}>←</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Active Job</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.topCard}>
                    <View style={styles.topRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                            <Text style={styles.catTxt}>{job.category}</Text>
                            {job.is_emergency ? <Text style={styles.emergencyBadge}>🚨 EMERGENCY</Text> : null}
                        </View>
                        <StatusPill status={status} />
                    </View>

                    <Text style={styles.custName}>{job.customer_name || 'Customer'}</Text>
                    <Text style={styles.addressTxt}>📍 {job.address}</Text>

                    {/* Parsed JSON details */}
                    {(() => {
                        const { text: descText, photo: photoUrl } = parseJobDescription(job.description);
                        return (
                            <View style={{ marginBottom: spacing.sm }}>
                                {!!descText && <Text style={{ color: colors.text.secondary, fontStyle: 'italic', marginBottom: spacing.xs }}>"{descText}"</Text>}
                                {!!photoUrl && <Image source={{ uri: photoUrl }} style={{ width: '100%', height: 180, borderRadius: radius.md, marginTop: spacing.xs, backgroundColor: colors.bg.surface }} />}
                            </View>
                        );
                    })()}

                    <Text style={styles.amountTxt}>Amount: ₹{job.amount}</Text>

                    {status !== 'completed' && status !== 'cancelled' && (
                        <View style={styles.btnRow}>
                            <TouchableOpacity style={styles.roundBtn} onPress={handleCall}>
                                <Text style={styles.roundIcon}>📞</Text>
                                <Text style={styles.roundTxt}>Call</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.roundBtn, styles.navBtn]} onPress={handleNavigate}>
                                <Text style={styles.roundIcon}>🗺️</Text>
                                <Text style={styles.roundTxt}>Navigate</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {renderActionView()}

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: spacing.xl + 20, paddingHorizontal: spacing.sm, paddingBottom: spacing.sm,
    },
    backBtn: { padding: spacing.sm },
    backTxt: { color: colors.text.primary, fontSize: 24 },
    title: { color: colors.text.primary, fontSize: 20, fontWeight: '700' },

    content: { padding: spacing.lg, gap: spacing.xl },

    topCard: { backgroundColor: colors.bg.elevated, padding: spacing.xl, borderRadius: radius.lg, borderTopWidth: 2, borderTopColor: colors.gold.primary },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    catTxt: { color: colors.text.secondary, fontSize: 16, fontWeight: '700', textTransform: 'uppercase' },
    emergencyBadge: { backgroundColor: colors.error + '22', color: colors.error, fontSize: 11, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },

    custName: { color: colors.text.primary, fontSize: 22, fontWeight: '800', marginTop: spacing.md },
    addressTxt: { color: colors.text.muted, fontSize: 15, lineHeight: 22, marginVertical: spacing.sm },
    amountTxt: { color: colors.gold.primary, fontSize: 16, fontWeight: '700' },

    btnRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
    roundBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
        paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.bg.surface,
        borderWidth: 1, borderColor: colors.bg.surface
    },
    navBtn: { backgroundColor: colors.gold.glow, borderColor: colors.gold.primary },
    roundIcon: { fontSize: 16 },
    roundTxt: { color: colors.text.primary, fontWeight: '600' },

    actionBox: { backgroundColor: colors.bg.surface, borderRadius: radius.lg, padding: spacing.xl },
    actionPrompt: { color: colors.text.primary, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: spacing.xs },
    actionSub: { color: colors.text.muted, fontSize: 13, textAlign: 'center', marginBottom: spacing.lg },

    otpRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginBottom: spacing.xl },
    otpBox: {
        width: 50, height: 60, borderRadius: radius.sm, backgroundColor: colors.bg.primary,
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.bg.elevated
    },
    otpBoxActive: { borderColor: colors.gold.primary },
    otpTxt: { color: colors.gold.primary, fontSize: 28, fontWeight: '800', fontFamily: 'Courier' },

    readOnlyOtpWrap: { backgroundColor: colors.bg.primary, padding: spacing.xl, borderRadius: radius.md, alignItems: 'center', marginVertical: spacing.md },
    readOnlyOtpTxt: { color: colors.gold.primary, fontSize: 48, fontWeight: '800', letterSpacing: 8, fontFamily: 'Courier', },
    waitingTxt: { color: colors.text.secondary, textAlign: 'center', marginTop: spacing.md, fontStyle: 'italic' },

    timerCircle: {
        width: 140, height: 140, borderRadius: 70, borderWidth: 4, borderColor: colors.gold.primary,
        alignSelf: 'center', justifyContent: 'center', alignItems: 'center', marginVertical: spacing.xl,
        backgroundColor: colors.bg.primary
    },
    timerVal: { color: colors.text.primary, fontSize: 32, fontWeight: '800', fontFamily: 'Courier' },
    timerLbl: { color: colors.text.muted, fontSize: 14, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },

    disputeBtn: { marginTop: spacing.xl, padding: spacing.md, alignItems: 'center' },
    disputeTxt: { color: colors.error, fontSize: 14, fontWeight: '600' }
});
