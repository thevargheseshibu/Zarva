import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, BackHandler, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import dayjs from 'dayjs';
import { useT } from '../../hooks/useT';
import { useJobStore } from '../../stores/jobStore';
import apiClient from '../../services/api/client';
import { parseJobDescription } from '../../utils/jobParser';
import FadeInView from '../../components/FadeInView';
import StatusPill from '../../components/StatusPill';
import OTPInput from '../../components/OTPInput';
import PremiumButton from '../../components/PremiumButton';
import Card from '../../components/Card';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import { colors, radius, spacing, shadows } from '../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../design-system/typography';

const STAGES = ['searching', 'assigned', 'worker_en_route', 'worker_arrived', 'in_progress', 'pending_completion'];

export default function JobStatusDetailScreen({ route, navigation }) {
    const t = useT();
    const { jobId } = route.params || { jobId: 'mock-123' };
    const { searchPhase, assignedWorker, clearActiveJob, startListening, stopListening } = useJobStore();

    const [job, setJob] = useState(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [verifyingEndOtp, setVerifyingEndOtp] = useState(false);

    const status = searchPhase || 'searching';
    const currentStageIdx = STAGES.indexOf(status) === -1 ? STAGES.length : STAGES.indexOf(status);

    useEffect(() => {
        fetchJobDetails();
        startListening(jobId);
        return () => stopListening();
    }, [jobId]);

    const fetchJobDetails = async () => {
        try {
            const res = await apiClient.get(`/api/jobs/${jobId}`);
            if (res.data?.job) setJob(res.data.job);
        } catch (err) {
            console.error('Failed to fetch job details', err);
        }
    };

    // Live Timer for In Progress
    useEffect(() => {
        let int;
        if (status === 'in_progress' && job?.work_started_at) {
            const startMs = new Date(job.work_started_at).getTime();
            const updateTimer = () => {
                setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
            };
            updateTimer();
            int = setInterval(updateTimer, 1000);
        }
        return () => clearInterval(int);
    }, [status, job]);

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
                    Alert.alert('Active Request', 'This request is currently active. Go to Home instead?', [
                        { text: 'Stay', style: 'cancel' },
                        { text: 'Go Home', onPress: () => navigation.replace('CustomerTabs') }
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
                <Text style={styles.headerTitle}>Status</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Map Section */}
                {['assigned', 'worker_en_route', 'worker_arrived'].includes(status) && (
                    <View style={styles.mapContainer}>
                        <WebView
                            source={{ html: generateMapHTML(assignedWorker?.lat, assignedWorker?.lng, job?.lat, job?.lng) }}
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
                            <Text style={styles.statusLabel}>CURRENT STATUS</Text>
                            <Text style={styles.statusTitle}>
                                {status === 'searching' && "Finding your professional..."}
                                {status === 'assigned' && "Professional matched!"}
                                {status === 'worker_en_route' && "En route to your location"}
                                {status === 'worker_arrived' && "At your doorstep"}
                                {status === 'in_progress' && "Service in progress"}
                                {status === 'pending_completion' && "Reviewing completion"}
                                {status === 'completed' && "Service complete"}
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
                        <Card glow style={styles.actionCard}>
                            <Text style={styles.actionTitle}>Share Start Code</Text>
                            <Text style={styles.actionSub}>Provide this code to the professional to begin the service.</Text>
                            <View style={styles.otpDisplay}>
                                <Text style={styles.otpTxt}>{job?.start_otp || '----'}</Text>
                            </View>
                        </Card>
                    </FadeInView>
                )}

                {status === 'pending_completion' && (
                    <FadeInView delay={200}>
                        <Card glow style={styles.actionCard}>
                            <Text style={styles.actionTitle}>Verify Completion</Text>
                            <Text style={styles.actionSub}>Enter the code provided by the professional to finalize.</Text>
                            <View style={styles.otpInputWrap}>
                                <OTPInput
                                    disabled={verifyingEndOtp}
                                    onComplete={async (code) => {
                                        setVerifyingEndOtp(true);
                                        try {
                                            await apiClient.post(`/api/jobs/${jobId}/verify-end-otp`, { otp: code });
                                            navigation.replace('Payment', { jobId });
                                        } catch (err) {
                                            Alert.alert('Error', 'Invalid code. Please try again.');
                                        } finally {
                                            setVerifyingEndOtp(false);
                                        }
                                    }}
                                />
                            </View>
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
                                    <Text style={styles.workerRating}>⭐ {assignedWorker.rating || 'New'}</Text>
                                    <View style={styles.metaDivider} />
                                    <Text style={styles.workerJobs}>{assignedWorker.completed_jobs || 0} jobs</Text>
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
                        <Text style={styles.sectionHeader}>REQUEST DETAILS</Text>
                        <Card style={styles.detailsCard}>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>SERVICE</Text>
                                <Text style={styles.detailValue}>{t(`cat_${job.category}`) || job.category}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>LOCATION</Text>
                                <Text style={styles.detailValue} numberOfLines={2}>{job.address}</Text>
                            </View>
                            {job.scheduled_for && (
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>SCHEDULED</Text>
                                    <Text style={styles.detailValue}>{dayjs(job.scheduled_for).format('MMM D, h:mm A')}</Text>
                                </View>
                            )}
                        </Card>
                    </FadeInView>
                )}

                {/* Footer Actions */}
                <View style={styles.footerActions}>
                    {['searching', 'assigned', 'worker_en_route'].includes(status) && (
                        <PremiumButton
                            variant="secondary"
                            title="Cancel Request"
                            onPress={() => {
                                Alert.alert('Cancel Request', 'Are you sure?', [
                                    { text: 'No', style: 'cancel' },
                                    {
                                        text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
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
                            title="Leave a Review"
                            onPress={() => navigation.navigate('Rating', { jobId })}
                        />
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
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
    headerTitle: { color: colors.text.primary, fontSize: fontSize.body, fontWeight: fontWeight.bold, letterSpacing: tracking.body },

    scrollContent: { paddingBottom: 100 },

    mapContainer: { height: 260, position: 'relative', overflow: 'hidden' },
    map: { flex: 1 },
    mapOverlay: { position: 'absolute', top: 20, right: 20 },

    mainCard: { margin: spacing[24], padding: spacing[24], gap: spacing[24] },
    completedCard: { borderColor: colors.accent.primary + '44', borderWidth: 1 },
    statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    statusInfo: { flex: 1 },
    statusLabel: { color: colors.accent.primary, fontSize: fontSize.micro, fontWeight: fontWeight.bold, letterSpacing: 1.5 },
    statusTitle: { color: colors.text.primary, fontSize: fontSize.title, fontWeight: fontWeight.bold, marginTop: 4, letterSpacing: tracking.title },

    timerCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.elevated, borderWidth: 2, borderColor: colors.accent.primary, justifyContent: 'center', alignItems: 'center' },
    timerTxt: { color: colors.text.primary, fontSize: 14, fontWeight: fontWeight.bold },

    stagesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing[8] },
    stageCol: { flex: 1, alignItems: 'center', position: 'relative' },
    stageDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.elevated },
    stageDotActive: { backgroundColor: colors.accent.primary },
    stageDotCurrent: { shadowColor: colors.accent.primary, shadowRadius: 6, shadowOpacity: 0.8, backgroundColor: '#FFF' },
    stageLine: { position: 'absolute', left: '50%', top: 3.5, width: '100%', height: 1, backgroundColor: colors.elevated, zIndex: -1 },
    stageLineActive: { backgroundColor: colors.accent.primary },

    actionCard: { marginHorizontal: spacing[24], marginBottom: spacing[24], padding: spacing[24], alignItems: 'center', gap: spacing[16] },
    actionTitle: { color: colors.text.primary, fontSize: fontSize.cardTitle, fontWeight: fontWeight.bold },
    actionSub: { color: colors.text.secondary, fontSize: fontSize.caption, textAlign: 'center' },
    otpDisplay: { paddingVertical: spacing[16], paddingHorizontal: spacing[32], borderRadius: radius.lg, backgroundColor: colors.elevated },
    otpTxt: { color: colors.accent.primary, fontSize: 32, fontWeight: '900', letterSpacing: 8 },
    otpInputWrap: { marginTop: spacing[16] },

    workerRow: { marginHorizontal: spacing[24], padding: spacing[16], backgroundColor: colors.surface, borderRadius: radius.xl, flexDirection: 'row', alignItems: 'center', gap: spacing[16], ...shadows.premium },
    workerPhoto: { width: 50, height: 50, borderRadius: 25 },
    workerInfo: { flex: 1 },
    workerName: { color: colors.text.primary, fontSize: fontSize.body, fontWeight: fontWeight.bold },
    workerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    workerRating: { color: colors.accent.primary, fontSize: fontSize.micro, fontWeight: fontWeight.bold },
    metaDivider: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.text.muted },
    workerJobs: { color: colors.text.secondary, fontSize: fontSize.micro },
    callIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.elevated, justifyContent: 'center', alignItems: 'center' },
    callIcon: { fontSize: 16 },

    detailsSection: { marginTop: spacing[32], paddingHorizontal: spacing[24] },
    sectionHeader: { color: colors.text.muted, fontSize: fontSize.micro, fontWeight: fontWeight.bold, letterSpacing: 1.5, marginBottom: spacing[12] },
    detailsCard: { padding: spacing[16], gap: spacing[16] },
    detailRow: { gap: 4 },
    detailLabel: { color: colors.text.muted, fontSize: 8, fontWeight: fontWeight.bold, letterSpacing: 1 },
    detailValue: { color: colors.text.primary, fontSize: fontSize.caption, fontWeight: fontWeight.medium },

    footerActions: { padding: spacing[24], gap: spacing[16] }
});
