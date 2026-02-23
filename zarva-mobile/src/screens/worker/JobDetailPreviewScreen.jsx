import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useT } from '../../hooks/useT';
import apiClient from '../../services/api/client';
import { useWorkerStore } from '../../stores/workerStore';
import FadeInView from '../../components/FadeInView';
import PremiumButton from '../../components/PremiumButton';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import Card from '../../components/Card';
import { colors, radius, spacing, shadows } from '../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../design-system/typography';
import { haversineKm, formatDistance, calculateTravelCharge } from '../../utils/distance';
import { parseJobDescription } from '../../utils/jobParser';

dayjs.extend(relativeTime);

export default function JobDetailPreviewScreen({ route, navigation }) {
    const t = useT();
    const { job: initialJob } = route.params || {};
    const [job, setJob] = useState({ ...initialJob, dist: initialJob?.dist ?? null });
    const [loading, setLoading] = useState(false);
    const [locLoading, setLocLoading] = useState(true);
    const [workerLoc, setWorkerLoc] = useState(null);
    const { locationOverride } = useWorkerStore();

    const { structured: structuredQuestions, photos, text: parsedText } = parseJobDescription(job?.description || job?.desc);
    const finalDescription = parsedText || job?.description || job?.desc;

    useEffect(() => {
        const getDist = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    setLocLoading(false);
                    return;
                }
                let currentCoords = null;
                if (locationOverride) {
                    currentCoords = { lat: locationOverride.lat, lng: locationOverride.lng };
                } else {
                    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    currentCoords = { lat: location.coords.latitude, lng: location.coords.longitude };
                }
                setWorkerLoc(currentCoords);

                if (job.latitude && job.longitude) {
                    const kms = haversineKm(currentCoords.lat, currentCoords.lng, parseFloat(job.latitude), parseFloat(job.longitude));
                    const travel = calculateTravelCharge(kms);
                    const baseRate = parseFloat(job.rate_per_hour || 0);
                    const estTotal = baseRate + travel + (parseFloat(job.advance_amount || 0));
                    setJob(prev => ({ ...prev, dist: kms, travel_charge: travel, total_amount: estTotal }));
                }
            } catch (err) { } finally { setLocLoading(false); }
        };
        getDist();
    }, []);

    const handleAccept = async () => {
        setLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        try {
            if (workerLoc) {
                await apiClient.put('/api/worker/location', { lat: workerLoc.lat, lng: workerLoc.lng }).catch(() => { });
            }
            await apiClient.post(`/api/worker/jobs/${job.id}/accept`);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            navigation.replace('ActiveJob', { jobId: job.id });
        } catch (error) {
            setLoading(false);
            if (error.response?.status === 409) {
                Alert.alert('Too Slow!', 'This job was already taken by another professional.');
                navigation.goBack();
            } else {
                Alert.alert('Error', error.response?.data?.message || 'Failed to accept job.');
            }
        }
    };

    if (!job) return null;

    return (
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <PressableAnimated onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Text style={styles.headerBtnTxt}>←</Text>
                </PressableAnimated>
                <Text style={styles.headerTitle}>Job Specification</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* Hero Card */}
                <FadeInView delay={50}>
                    <Card style={styles.heroCard}>
                        <View style={styles.categoryBox}>
                            <Text style={styles.categoryTxt}>{job.category?.toUpperCase() || 'SERVICE'}</Text>
                        </View>
                        <Text style={styles.payoutValue}>₹{job.total_amount ? parseFloat(job.total_amount).toFixed(0) : '—'}</Text>
                        <View style={styles.metaBox}>
                            <View style={styles.metaLine}>
                                <Text style={styles.metaIcon}>📍</Text>
                                <Text style={styles.metaTxt}>{job.dist != null ? formatDistance(job.dist) : '—'} away</Text>
                            </View>
                            <View style={styles.metaLine}>
                                <Text style={styles.metaIcon}>⏰</Text>
                                <Text style={styles.metaTxt}>{dayjs(job.time).fromNow()}</Text>
                            </View>
                        </View>
                    </Card>
                </FadeInView>

                {/* Client Info */}
                <FadeInView delay={200} style={styles.section}>
                    <Text style={styles.sectionHeader}>REQUESTER</Text>
                    <Card style={styles.clientCard}>
                        <View style={styles.avatarMini}>
                            <Text style={styles.avatarMiniTxt}>{job.customer_name?.charAt(0) || 'C'}</Text>
                        </View>
                        <View>
                            <Text style={styles.clientName}>{job.customer_name || 'Customer'}</Text>
                            <Text style={styles.clientSub}>Contact details hidden until accepted</Text>
                        </View>
                    </Card>
                </FadeInView>

                {/* Requirements */}
                <FadeInView delay={350} style={styles.section}>
                    <Text style={styles.sectionHeader}>REQUIREMENTS</Text>
                    <Card style={styles.reqCard}>
                        {structuredQuestions.length > 0 ? (
                            structuredQuestions.map((item, idx) => (
                                <View key={idx} style={styles.reqItem}>
                                    <Text style={styles.reqLabel}>{item.label.toUpperCase()}</Text>
                                    <Text style={styles.reqVal}>{item.value}</Text>
                                    {idx < structuredQuestions.length - 1 && <View style={styles.reqDivider} />}
                                </View>
                            ))
                        ) : (
                            <Text style={styles.reqDesc}>"{finalDescription || 'No specific instructions provided.'}"</Text>
                        )}
                    </Card>
                </FadeInView>

                {/* Attachments */}
                {photos.length > 0 && (
                    <FadeInView delay={450} style={styles.section}>
                        <Text style={styles.sectionHeader}>ATTACHMENTS</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoList}>
                            {photos.map((uri, idx) => (
                                <TouchableOpacity key={idx} activeOpacity={0.9}>
                                    <Image source={{ uri }} style={styles.photo} />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </FadeInView>
                )}

                {/* Payout Breakdown */}
                <FadeInView delay={550} style={styles.section}>
                    <Text style={styles.sectionHeader}>FINANCIAL BREAKDOWN</Text>
                    <Card style={styles.breakdownCard}>
                        <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>Professional Service Fee</Text>
                            <Text style={styles.priceVal}>₹{job.rate_per_hour}</Text>
                        </View>
                        {job.travel_charge > 0 && (
                            <View style={styles.priceRow}>
                                <Text style={styles.priceLabel}>Travel Allowance</Text>
                                <Text style={styles.priceVal}>₹{job.travel_charge}</Text>
                            </View>
                        )}
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>TOTAL ESTIMATE</Text>
                            <Text style={styles.totalVal}>₹{job.total_amount}</Text>
                        </View>
                    </Card>
                </FadeInView>

            </ScrollView>

            <View style={styles.footer}>
                <View style={{ flex: 1.2 }}>
                    <PremiumButton variant="ghost" title="Decline" onPress={() => navigation.goBack()} disabled={loading} />
                </View>
                <View style={{ flex: 2 }}>
                    <PremiumButton title="Acquire Request" onPress={handleAccept} loading={loading} />
                </View>
            </View>
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

    scrollContent: { padding: spacing[24], paddingBottom: 160, gap: spacing[32] },

    heroCard: { padding: spacing[24], alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accent.border + '22' },
    categoryBox: { backgroundColor: colors.accent.primary + '11', paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.full, marginBottom: 8 },
    categoryTxt: { color: colors.accent.primary, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 1 },
    payoutValue: { color: colors.text.primary, fontSize: 56, fontWeight: '900', letterSpacing: -1 },
    metaBox: { flexDirection: 'row', gap: 16, marginTop: 8 },
    metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaIcon: { fontSize: 12 },
    metaTxt: { color: colors.text.muted, fontSize: fontSize.caption, fontWeight: fontWeight.medium },

    section: { gap: spacing[12] },
    sectionHeader: { color: colors.accent.primary, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 2, marginLeft: 4 },

    clientCard: { flexDirection: 'row', alignItems: 'center', padding: spacing[20], gap: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surface },
    avatarMini: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent.primary + '11', justifyContent: 'center', alignItems: 'center' },
    avatarMiniTxt: { color: colors.accent.primary, fontSize: 16, fontWeight: '900' },
    clientName: { color: colors.text.primary, fontSize: fontSize.body, fontWeight: fontWeight.bold },
    clientSub: { color: colors.text.muted, fontSize: 10 },

    reqCard: { padding: spacing[20], backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surface },
    reqItem: { gap: 4 },
    reqLabel: { color: colors.text.muted, fontSize: 8, fontWeight: fontWeight.bold, letterSpacing: 1 },
    reqVal: { color: colors.text.primary, fontSize: fontSize.body, fontWeight: fontWeight.medium },
    reqDivider: { height: 1, backgroundColor: colors.elevated, marginVertical: 12 },
    reqDesc: { color: colors.text.primary, fontSize: fontSize.body, fontStyle: 'italic', lineHeight: 24, opacity: 0.9 },

    photoList: { gap: spacing[16], paddingRight: spacing[24] },
    photo: { width: 280, height: 180, borderRadius: radius.xl, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.surface },

    breakdownCard: { padding: spacing[20], gap: spacing[12], backgroundColor: colors.surface, borderStyle: 'dotted', borderWidth: 1, borderColor: colors.accent.border + '44' },
    priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    priceLabel: { color: colors.text.secondary, fontSize: fontSize.caption },
    priceVal: { color: colors.text.primary, fontSize: fontSize.caption, fontWeight: fontWeight.bold },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.elevated },
    totalLabel: { color: colors.accent.primary, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1 },
    totalVal: { color: colors.accent.primary, fontSize: 20, fontWeight: '900' },

    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: spacing[24],
        paddingTop: 20,
        paddingBottom: 44,
        backgroundColor: colors.background,
        flexDirection: 'row',
        gap: spacing[12],
        borderTopWidth: 1,
        borderTopColor: colors.elevated
    }
});
