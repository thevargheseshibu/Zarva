import React, { useState, useEffect } from 'react';
import { useTokens } from '../../design-system';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useT } from '../../hooks/useT';
import apiClient from '@infra/api/client';
import { useWorkerStore } from '@worker/store';
import FadeInView from '../@shared/ui/FadeInView';
import PremiumButton from '../@shared/ui/PremiumButton';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import Card from '../@shared/ui/ZCard';


import { haversineKm, formatDistance, calculateTravelCharge } from '../../utils/distance';
import { parseJobDescription } from '../../utils/jobParser';

dayjs.extend(relativeTime);

export default function JobDetailPreviewScreen({ route, navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
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
        const getDistAndDetails = async () => {
            try {
                // 1. If we only have an ID or missing description, fetch from API
                const jobId = job.id || initialJob?.id;
                if (jobId && (!job.description && !job.desc)) {
                    setLoading(true);
                    try {
                        const res = await apiClient.get(`/api/worker/jobs/${jobId}`);
                        if (res.data?.job) {
                            setJob(prev => ({ ...prev, ...res.data.job }));
                        }
                    } catch (e) {
                        console.warn('[JobPreview] Details fetch failed:', e.message);
                    } finally {
                        setLoading(false);
                    }
                }

                // 2. Refresh Location & Distance
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

                // Re-check job coords after possible fetch
                const targetJob = job.latitude ? job : (initialJob || {});
                if (targetJob.latitude && targetJob.longitude) {
                    const kms = haversineKm(currentCoords.lat, currentCoords.lng, parseFloat(targetJob.latitude), parseFloat(targetJob.longitude));
                    const travel = calculateTravelCharge(kms);
                    const baseRate = parseFloat(targetJob.rate_per_hour || 0);
                    const estTotal = baseRate + travel + (parseFloat(targetJob.advance_amount || 0));
                    setJob(prev => ({ ...prev, dist: kms, travel_charge: travel, total_amount: estTotal }));
                }
            } catch (err) { } finally { setLocLoading(false); }
        };
        getDistAndDetails();
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
                <Text style={styles.headerTitle}>{t('job_specification')}</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* Hero Card */}
                <FadeInView delay={50}>
                    <Card style={styles.heroCard}>
                        <View style={styles.categoryBox}>
                            <Text style={styles.categoryTxt}>{job.category?.toUpperCase() || t('category_service')}</Text>
                        </View>
                        <Text style={styles.payoutValue}>₹{job.total_amount ? parseFloat(job.total_amount).toFixed(0) : '—'}</Text>
                        <View style={styles.metaBox}>
                            <View style={styles.metaLine}>
                                <Text style={styles.metaIcon}>📍</Text>
                                <Text style={styles.metaTxt}>{job.dist != null ? formatDistance(job.dist) : '—'}{t('away_suffix')}</Text>
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
                    <Text style={styles.sectionHeader}>{t('requester')}</Text>
                    <Card style={styles.clientCard}>
                        <View style={styles.avatarMini}>
                            <Text style={styles.avatarMiniTxt}>{job.customer_name?.charAt(0) || 'C'}</Text>
                        </View>
                        <View>
                            <Text style={styles.clientName}>{job.customer_name || 'Customer'}</Text>
                            <Text style={styles.clientSub}>{t('secret_contact')}</Text>
                        </View>
                    </Card>
                </FadeInView>

                {/* Requirements */}
                <FadeInView delay={350} style={styles.section}>
                    <Text style={styles.sectionHeader}>{t('requirements')}</Text>
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
                            <Text style={styles.reqDesc}>"{finalDescription || t('no_instructions')}"</Text>
                        )}
                    </Card>
                </FadeInView>

                {/* Attachments */}
                {photos.length > 0 && (
                    <FadeInView delay={450} style={styles.section}>
                        <Text style={styles.sectionHeader}>{t('attachments')}</Text>
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
                    <Text style={styles.sectionHeader}>{t('financial_breakdown')}</Text>
                    <Card style={styles.breakdownCard}>
                        <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>{t('pro_service_fee')}</Text>
                            <Text style={styles.priceVal}>₹{job.rate_per_hour}</Text>
                        </View>
                        {job.travel_charge > 0 && (
                            <View style={styles.priceRow}>
                                <Text style={styles.priceLabel}>{t('travel_allowance')}</Text>
                                <Text style={styles.priceVal}>₹{job.travel_charge}</Text>
                            </View>
                        )}
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>{t('total_estimate')}</Text>
                            <Text style={styles.totalVal}>₹{job.total_amount}</Text>
                        </View>
                    </Card>
                </FadeInView>

            </ScrollView>

            <View style={styles.footer}>
                <View style={{ flex: 1.2 }}>
                    <PremiumButton variant="ghost" title={t('decline')} onPress={() => navigation.goBack()} disabled={loading} />
                </View>
                <View style={{ flex: 2 }}>
                    <PremiumButton title={t('acquire_request')} onPress={handleAccept} loading={loading} />
                </View>
            </View>
        </View>
    );
}

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.app },
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
    headerTitle: { color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.bold, letterSpacing: t.typography.tracking.body },

    scrollContent: { padding: t.spacing['2xl'], paddingBottom: 160, gap: t.spacing[32] },

    heroCard: { padding: t.spacing['2xl'], alignItems: 'center', backgroundColor: t.background.surface, borderWidth: 1, borderColor: t.border.default + '22' },
    categoryBox: { backgroundColor: t.brand.primary + '11', paddingHorizontal: 12, paddingVertical: 4, borderRadius: t.radius.full, marginBottom: 8 },
    categoryTxt: { color: t.brand.primary, fontSize: 9, fontWeight: t.typography.weight.bold, letterSpacing: 1 },
    payoutValue: { color: t.text.primary, fontSize: 56, fontWeight: '900', letterSpacing: -1 },
    metaBox: { flexDirection: 'row', gap: 16, marginTop: 8 },
    metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaIcon: { fontSize: 12 },
    metaTxt: { color: t.text.tertiary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.medium },

    section: { gap: t.spacing.md },
    sectionHeader: { color: t.brand.primary, fontSize: 9, fontWeight: t.typography.weight.bold, letterSpacing: 2, marginLeft: 4 },

    clientCard: { flexDirection: 'row', alignItems: 'center', padding: t.spacing[20], gap: 16, backgroundColor: t.background.surface, borderWidth: 1, borderColor: t.background.surface },
    avatarMini: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.brand.primary + '11', justifyContent: 'center', alignItems: 'center' },
    avatarMiniTxt: { color: t.brand.primary, fontSize: 16, fontWeight: '900' },
    clientName: { color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.bold },
    clientSub: { color: t.text.tertiary, fontSize: 10 },

    reqCard: { padding: t.spacing[20], backgroundColor: t.background.surface, borderWidth: 1, borderColor: t.background.surface },
    reqItem: { gap: 4 },
    reqLabel: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1 },
    reqVal: { color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.medium },
    reqDivider: { height: 1, backgroundColor: t.background.surfaceRaised, marginVertical: 12 },
    reqDesc: { color: t.text.primary, fontSize: t.typography.size.body, fontStyle: 'italic', lineHeight: 24, opacity: 0.9 },

    photoList: { gap: t.spacing.lg, paddingRight: t.spacing['2xl'] },
    photo: { width: 280, height: 180, borderRadius: t.radius.xl, backgroundColor: t.background.surfaceRaised, borderWidth: 1, borderColor: t.background.surface },

    breakdownCard: { padding: t.spacing[20], gap: t.spacing.md, backgroundColor: t.background.surface, borderStyle: 'dotted', borderWidth: 1, borderColor: t.border.default + '44' },
    priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    priceLabel: { color: t.text.secondary, fontSize: t.typography.size.caption },
    priceVal: { color: t.text.primary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.bold },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: t.background.surfaceRaised },
    totalLabel: { color: t.brand.primary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1 },
    totalVal: { color: t.brand.primary, fontSize: 20, fontWeight: '900' },

    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: t.spacing['2xl'],
        paddingTop: 20,
        paddingBottom: 44,
        backgroundColor: t.background.app,
        flexDirection: 'row',
        gap: t.spacing.md,
        borderTopWidth: 1,
        borderTopColor: t.background.surfaceRaised
    }
});
