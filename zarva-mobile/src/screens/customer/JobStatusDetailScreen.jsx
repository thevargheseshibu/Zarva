import React, { useState, useEffect, useCallback } from 'react';
import { useTokens } from '../../design-system';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, BackHandler, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import dayjs from 'dayjs';
import { useT } from '../../hooks/useT';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../../utils/firebase';
import { useJobStore } from '../../stores/jobStore';
import apiClient from '../../services/api/client';
import { parseJobDescription } from '../../utils/jobParser';
import FadeInView from '../../components/FadeInView';
import StatusPill from '../../components/StatusPill';
import OTPInput from '../../components/OTPInput';
import PremiumButton from '../../components/PremiumButton';
import Card from '../../components/Card';
import PressableAnimated from '../../design-system/components/PressableAnimated';

const STAGES = ['open', 'searching', 'assigned', 'worker_en_route', 'worker_arrived', 'estimate_submitted', 'in_progress', 'pending_completion'];

export default function JobStatusDetailScreen({ route, navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const { jobId } = route.params || { jobId: 'mock-123' };
    const { searchPhase, assignedWorker, clearActiveJob, startListening, stopListening } = useJobStore();

    const [job, setJob] = useState(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [inspectionExpirySeconds, setInspectionExpirySeconds] = useState(null);
    const [verifyingEndOtp, setVerifyingEndOtp] = useState(false);
    const [chatUnread, setChatUnread] = useState(0);

    const status = searchPhase || job?.status || 'searching';
    const currentStageIdx = STAGES.indexOf(status) === -1 ? STAGES.length : STAGES.indexOf(status);

    useEffect(() => {
        fetchJobDetails();
        startListening(jobId);

        // Chat Unread Listener
        const chatUnreadRef = ref(db, `active_jobs/${jobId}/chat_unread/customer`);
        const listener = onValue(chatUnreadRef, (snapshot) => {
            const count = snapshot.val() || 0;
            setChatUnread(count);
        });

        return () => {
            stopListening();
            off(chatUnreadRef, 'value', listener);
        };
    }, [jobId]);

    const fetchJobDetails = async () => {
        try {
            const res = await apiClient.get(`/api/jobs/${jobId}`);
            if (res.data?.job) setJob(res.data.job);
        } catch (err) {
            console.error('Failed to fetch job details', err);
        }
    };

    // Auto-refresh details specifically when worker arrives or starts work to get OTP/timestamps
    useEffect(() => {
        if (['worker_arrived', 'estimate_submitted', 'in_progress'].includes(status)) {
            fetchJobDetails();
        }
    }, [status]);

    // Live Timer for In Progress & Inspection Total
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
            setElapsedSeconds(totalSeconds);
        };

        if (['inspection_active', 'in_progress'].includes(status) || job?.job_started_at) {
            updateTimer();
            int = setInterval(updateTimer, 1000);
        }
        return () => clearInterval(int);
    }, [status, job]);

    // Inspection Timer
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

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return h === '00' ? `${m}:${s}` : `${h}:${m}:${s}`;
    };

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                if (currentStageIdx < STAGES.length && !['completed', 'cancelled'].includes(status)) {
                    Alert.alert(t('active_request_title'), t('active_request_msg'), [
                        { text: t('stay'), style: 'cancel' },
                        { text: t('go_home'), onPress: () => navigation.replace('CustomerTabs') }
                    ]);
                    return true;
                }
                return false;
            };
            const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => sub.remove();
        }, [status, currentStageIdx])
    );

    const generateMapHTML = (workerLat, workerLng, jobLat, jobLng) => `
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
            <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
            <style>
                body { padding: 0; margin: 0; background: #0A0A0B; }
                #map { height: 100vh; width: 100vw; }
                .leaflet-bar { border: none !important; }
                .leaflet-control-attribution { display: none; }
            </style>
        </head>
        <body>
            <div id="map"></div>
            <script>
                var map = L.map('map', { zoomControl: false }).setView([${jobLat}, ${jobLng}], 14);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png', {
                    attribution: ''
                }).addTo(map);

                var jobIcon = L.divIcon({
                    className: 'job-icon',
                    html: '<div style="background: #BD00FF; width: 12px; height: 12px; border-radius: 6px; border: 2px solid white; box-shadow: 0 0 10px #BD00FF;"></div>',
                    iconSize: [12, 12],
                    iconAnchor: [6, 6]
                });
                
                L.marker([${jobLat}, ${jobLng}], { icon: jobIcon }).addTo(map);

                if (${!!workerLat} && ${!!workerLng}) {
                    var workerIcon = L.divIcon({
                        className: 'worker-icon',
                        html: '<div style="background: #00E0FF; width: 16px; height: 16px; border-radius: 8px; border: 2px solid white; box-shadow: 0 0 15px #00E0FF;"></div>',
                        iconSize: [16, 16],
                        iconAnchor: [8, 8]
                    });
                    L.marker([${workerLat}, ${workerLng}], { icon: workerIcon }).addTo(map);
                    
                    var bounds = L.latLngBounds([${workerLat}, ${workerLng}], [${jobLat}, ${jobLng}]);
                    map.fitBounds(bounds, { padding: [50, 50] });
                }
            </script>
        </body>
        </html>
    `;

    return (
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <PressableAnimated onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Text style={styles.headerBtnTxt}>←</Text>
                </PressableAnimated>
                <Text style={styles.headerTitle}>{t('status')}</Text>

                {['assigned', 'worker_en_route', 'worker_arrived', 'estimate_submitted', 'in_progress', 'pending_completion'].includes(status) && job ? (
                    <PressableAnimated
                        style={styles.headerChatBtn}
                        onPress={() => navigation.navigate('Chat', { jobId, userRole: 'customer', otherUserId: job.worker_id })}
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
                {/* Map Section */}
                {['assigned', 'worker_en_route', 'worker_arrived'].includes(status) && (
                    <View style={styles.mapContainer}>
                        <WebView
                            source={{ html: generateMapHTML((status === 'worker_arrived' && job?.worker?.lat) ? job.worker.lat : assignedWorker?.lat, (status === 'worker_arrived' && job?.worker?.lng) ? job.worker.lng : assignedWorker?.lng, job?.lat, job?.lng) }}
                            style={styles.map}
                            scrollEnabled={false}
                        />
                        <View style={styles.mapOverlay}>
                            <StatusPill status={status} />
                        </View>
                    </View>
                )}

                {/* Main Status Card */}
                <Card style={[styles.mainCard, status === 'completed' && styles.completedCard]}>
                    <View style={styles.statusRow}>
                        <View style={styles.statusInfo}>
                            <Text style={styles.statusLabel}>{t('current_status')}</Text>
                            <Text style={styles.statusTitle}>
                                {status === 'searching' && t('status_finding_prof')}
                                {status === 'assigned' && t('status_prof_matched')}
                                {status === 'worker_en_route' && t('status_en_route')}
                                {status === 'worker_arrived' && t('status_at_doorstep')}
                                {status === 'estimate_submitted' && 'Review Estimate'}
                                {status === 'in_progress' && t('status_in_progress')}
                                {status === 'pending_completion' && t('status_reviewing')}
                                {status === 'completed' && t('status_complete')}
                            </Text>
                        </View>
                        {status === 'in_progress' && (
                            <View style={styles.timerCircle}>
                                <Text style={styles.timerTxt}>{formatTime(elapsedSeconds)}</Text>
                            </View>
                        )}
                    </View>

                    {/* Stage Indicators */}
                    <View style={styles.stagesRow}>
                        {STAGES.map((s, i) => (
                            <View key={s} style={styles.stageCol}>
                                <View style={[
                                    styles.stageDot,
                                    i <= currentStageIdx && styles.stageDotActive,
                                    i === currentStageIdx && styles.stageDotCurrent
                                ]} />
                                {i < STAGES.length - 1 && (
                                    <View style={[
                                        styles.stageLine,
                                        i < currentStageIdx && styles.stageLineActive
                                    ]} />
                                )}
                            </View>
                        ))}
                    </View>
                </Card>

                {/* Action Area */}
                {status === 'worker_arrived' && (
                    <FadeInView delay={200}>
                        <Card glow style={styles.premiumActionCard}>
                            <View style={styles.luxuryHeader}>
                                <View style={[styles.luxuryIconBox, { backgroundColor: tTheme.brand.primary + '11' }]}>
                                    <Text style={styles.luxuryIcon}>🔐</Text>
                                </View>
                                <View>
                                    <Text style={styles.luxuryLabel}>VERIFICATION PHASE</Text>
                                    <Text style={styles.luxuryTitle}>{t('share_service_code') || 'Secure Arrival'}</Text>
                                </View>
                            </View>

                            <View style={styles.counterSection}>
                                <View style={styles.countCircle}>
                                    <Text style={styles.countValue}>{inspectionExpirySeconds !== null ? formatTime(inspectionExpirySeconds) : '--:--'}</Text>
                                    <Text style={styles.countLabel}>INSPECTION WINDOW</Text>
                                </View>
                                <Text style={styles.counterHint}>The professional has arrived. Share the code below to begin the assessment.</Text>
                            </View>

                            <View style={styles.otpLuxDisplay}>
                                <Text style={styles.otpLuxLabel}>INSPECTION CODE</Text>
                                <Text style={styles.otpLuxValue}>{job?.inspection_otp || '----'}</Text>
                            </View>
                        </Card>
                    </FadeInView>
                )}

                {status === 'estimate_submitted' && (
                    <FadeInView delay={200}>
                        <Card glow style={styles.actionCard}>
                            <Text style={styles.actionTitle}>Review Estimate</Text>
                            <Text style={styles.actionSub}>The professional has submitted their service estimate. Review the details below. If approved, provide the Start Code to begin the billable session.</Text>

                            <View style={styles.estimateBox}>
                                <View style={styles.estimateRow}>
                                    <View style={styles.estIconBox}>
                                        <Text style={styles.estIcon}>⏱️</Text>
                                    </View>
                                    <View style={styles.estInfoBlock}>
                                        <Text style={styles.estimateLabel}>Estimated Time</Text>
                                        <Text style={styles.estimateVal}>{job?.estimated_duration_minutes || 0} Minutes</Text>
                                    </View>
                                </View>
                                {job?.issue_notes ? (
                                    <View style={[styles.estimateRow, { marginTop: 16, alignItems: 'flex-start' }]}>
                                        <View style={[styles.estIconBox, { backgroundColor: tTheme.brand.primary + '11' }]}>
                                            <Text style={styles.estIcon}>📝</Text>
                                        </View>
                                        <View style={styles.estInfoBlock}>
                                            <Text style={styles.estimateLabel}>Pro Notes</Text>
                                            <Text style={[styles.estimateVal, { marginTop: 4, lineHeight: 20 }]}>{job.issue_notes}</Text>
                                        </View>
                                    </View>
                                ) : null}
                            </View>

                            <View style={styles.startCodeWrapper}>
                                <Text style={styles.startCodeHeader}>Confirm & Start</Text>
                                <Text style={styles.startCodeSub}>Share this code with the pro to begin work:</Text>
                                <View style={styles.otpDisplay}>
                                    <Text style={styles.otpTxt}>{job?.start_otp || '----'}</Text>
                                </View>
                            </View>
                        </Card>
                    </FadeInView>
                )}

                {status === 'pending_completion' && (
                    <FadeInView delay={200}>
                        <Card glow style={styles.actionCard}>
                            <Text style={styles.actionTitle}>{t('verify_completion')}</Text>
                            <Text style={styles.actionSub}>{t('verify_completion_desc')}</Text>
                            <OTPInput
                                disabled={verifyingEndOtp}
                                onComplete={async (code) => {
                                    setVerifyingEndOtp(true);
                                    try {
                                        await apiClient.post(`/api/jobs/${jobId}/verify-end-otp`, { otp: code });
                                        navigation.replace('Payment', { jobId });
                                    } catch (err) {
                                        Alert.alert('Error', t('invalid_code'));
                                    } finally {
                                        setVerifyingEndOtp(false);
                                    }
                                }}
                            />
                        </Card>
                    </FadeInView>
                )}

                {/* Worker Details */}
                {assignedWorker && (
                    <FadeInView delay={300}>
                        <PressableAnimated
                            onPress={() => navigation.navigate('WorkerReputation', { workerId: assignedWorker.id })}
                            style={styles.workerRow}
                        >
                            <Image source={{ uri: assignedWorker.photo }} style={styles.workerPhoto} />
                            <View style={styles.workerInfo}>
                                <Text style={styles.workerName}>{assignedWorker.name}</Text>
                                <View style={styles.workerMeta}>
                                    <Text style={styles.workerRating}>⭐ {assignedWorker.rating ? Number(assignedWorker.rating).toFixed(1) : t('new_worker')}</Text>
                                    <View style={styles.metaDivider} />
                                    <Text style={styles.workerJobs}>{assignedWorker.completed_jobs || 0} Jobs</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={styles.callIconBtn}>
                                <Text style={styles.callIcon}>📞</Text>
                            </TouchableOpacity>
                        </PressableAnimated>
                    </FadeInView>
                )}

                {/* Job Info Section */}
                {job && (
                    <FadeInView delay={400} style={styles.detailsSection}>
                        <Text style={styles.sectionHeader}>{t('request_details')}</Text>
                        <Card style={styles.detailsCard}>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>{t('service').toUpperCase()}</Text>
                                <Text style={styles.detailValue}>{t(`cat_${job.category}`) || job.category}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>{t('location').toUpperCase()}</Text>
                                <Text style={styles.detailValue} numberOfLines={2}>{job.address}</Text>
                            </View>
                            {job.scheduled_for && (
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>{t('scheduled').toUpperCase()}</Text>
                                    <Text style={styles.detailValue}>{dayjs(job.scheduled_for).format('MMM D, h:mm A')}</Text>
                                </View>
                            )}
                            {job.description && (
                                <View style={[styles.detailRow, { marginTop: tTheme.spacing.sm }]}>
                                    <Text style={styles.detailLabel}>{t('description').toUpperCase()}</Text>
                                    <Text style={styles.detailValue}>{parseJobDescription(job.description).text}</Text>
                                </View>
                            )}
                        </Card>
                    </FadeInView>
                )}

                {/* Footer Actions */}
                <View style={styles.footerActions}>
                    {['open', 'searching', 'no_worker_found', 'assigned', 'worker_en_route'].includes(status) && (
                        <PremiumButton
                            variant="secondary"
                            title={t('edit_request')}
                            onPress={() => navigation.navigate('EditJob', { jobId })}
                            style={{ marginBottom: tTheme.spacing.md }}
                        />
                    )}
                    {['open', 'searching', 'no_worker_found', 'assigned', 'worker_en_route'].includes(status) && (
                        <PremiumButton
                            variant="secondary"
                            title={t('status_cancel')}
                            onPress={() => {
                                Alert.alert(t('status_cancel'), t('are_you_sure'), [
                                    { text: t('no'), style: 'cancel' },
                                    {
                                        text: t('yes_cancel'), style: 'destructive', onPress: async () => {
                                            try {
                                                await apiClient.post(`/api/jobs/${jobId}/cancel`);
                                                navigation.replace('CustomerTabs');
                                            } catch (e) { }
                                        }
                                    }
                                ]);
                            }}
                        />
                    )}
                    {status === 'completed' && (
                        <PremiumButton
                            title={t('leave_review')}
                            onPress={() => navigation.navigate('Rating', { jobId })}
                        />
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.app },
    header: {
        paddingTop: 60,
        paddingHorizontal: t.spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: t.spacing.sm
    },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.background.surface, justifyContent: 'center', alignItems: 'center' },
    headerBtnTxt: { color: t.text.primary, fontSize: 20 },
    headerTitle: { color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.bold, letterSpacing: t.typography.tracking.body },
    headerChatBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.background.surfaceRaised, justifyContent: 'center', alignItems: 'center', position: 'relative' },
    chatIcon: { fontSize: 20 },
    unreadBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: t.status.error.base, minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: t.background.app },
    unreadTxt: { color: '#FFF', fontSize: 10, fontWeight: '900' },

    scrollContent: { paddingBottom: 100 },

    mapContainer: { height: 260, position: 'relative', overflow: 'hidden' },
    map: { flex: 1 },
    mapOverlay: { position: 'absolute', top: 20, right: 20 },

    mainCard: { margin: t.spacing.lg, gap: t.spacing.lg },
    completedCard: { borderColor: t.brand.primary + '44', borderWidth: 1 },
    statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    statusInfo: { flex: 1 },
    statusLabel: { color: t.brand.primary, fontSize: t.typography.size.micro, fontWeight: t.typography.weight.bold, letterSpacing: 1.5 },
    statusTitle: { color: t.text.primary, fontSize: t.typography.size.title, fontWeight: t.typography.weight.bold, marginTop: 4, letterSpacing: t.typography.tracking.title },

    timerCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: t.background.surfaceRaised, borderWidth: 2, borderColor: t.brand.primary, justifyContent: 'center', alignItems: 'center' },
    timerTxt: { color: t.text.primary, fontSize: 14, fontWeight: t.typography.weight.bold },

    stagesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: t.spacing.sm },
    stageCol: { flex: 1, alignItems: 'center', position: 'relative' },
    stageDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.background.surfaceRaised },
    stageDotActive: { backgroundColor: t.brand.primary },
    stageDotCurrent: { shadowColor: t.brand.primary, shadowRadius: 6, shadowOpacity: 0.8, backgroundColor: '#FFF' },
    stageLine: { position: 'absolute', left: '50%', top: 3.5, width: '100%', height: 1, backgroundColor: t.background.surfaceRaised, zIndex: -1 },
    stageLineActive: { backgroundColor: t.brand.primary },

    actionCard: { marginHorizontal: t.spacing.lg, marginBottom: t.spacing.lg, alignItems: 'center', gap: t.spacing.md },
    actionTitle: { color: t.text.primary, fontSize: t.typography.size.cardTitle, fontWeight: t.typography.weight.bold },
    actionSub: { color: t.text.secondary, fontSize: t.typography.size.caption, textAlign: 'center' },
    otpDisplay: { paddingVertical: t.spacing.lg, paddingHorizontal: t.spacing[32], borderRadius: t.radius.lg, backgroundColor: t.background.surfaceRaised },
    otpTxt: { color: t.brand.primary, fontSize: 32, fontWeight: '900', letterSpacing: 8 },
    otpInputWrap: { marginTop: t.spacing.lg },

    estimateBox: { width: '100%', backgroundColor: t.background.app, padding: t.spacing.lg, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.brand.primary + '33', marginTop: 8 },
    estimateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    estimateLabel: { color: t.text.tertiary, fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
    estimateVal: { color: t.text.primary, fontSize: 14, fontWeight: '600' },
    estIconBox: { width: 36, height: 36, borderRadius: 12, backgroundColor: t.background.surfaceRaised, justifyContent: 'center', alignItems: 'center', marginRight: t.spacing.sm },
    estIcon: { fontSize: 16 },
    estInfoBlock: { flex: 1 },
    startCodeWrapper: { marginTop: t.spacing['2xl'], alignItems: 'center', backgroundColor: t.brand.primary + '0A', padding: t.spacing.lg, borderRadius: t.radius.xl, borderWidth: 1, borderColor: t.brand.primary + '22', width: '100%' },
    startCodeHeader: { color: t.text.primary, fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
    startCodeSub: { color: t.text.secondary, fontSize: 12, marginTop: 4, marginBottom: 12 },

    workerRow: { marginHorizontal: t.spacing.lg, backgroundColor: t.background.surface, borderRadius: t.radius.xl, flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, ...t.shadows.premium },
    workerPhoto: { width: 50, height: 50, borderRadius: 25 },
    workerInfo: { flex: 1 },
    workerName: { color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.bold },
    workerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    workerRating: { color: t.brand.primary, fontSize: t.typography.size.micro, fontWeight: t.typography.weight.bold },
    metaDivider: { width: 4, height: 4, borderRadius: 2, backgroundColor: t.text.tertiary },
    workerJobs: { color: t.text.secondary, fontSize: t.typography.size.micro },
    callIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.background.surfaceRaised, justifyContent: 'center', alignItems: 'center' },
    callIcon: { fontSize: 16 },

    detailsSection: { marginTop: t.spacing.xl, paddingHorizontal: t.spacing.lg },
    sectionHeader: { color: t.text.tertiary, fontSize: t.typography.size.micro, fontWeight: t.typography.weight.bold, letterSpacing: 1.5, marginBottom: t.spacing.sm },
    detailsCard: { gap: t.spacing.md },
    detailRow: { gap: 4 },
    detailLabel: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1 },
    detailValue: { color: t.text.primary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.medium },

    footerActions: { padding: t.spacing.lg, gap: t.spacing.md }
});
