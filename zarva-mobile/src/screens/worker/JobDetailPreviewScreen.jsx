import * as Location from 'expo-location';
import { haversineKm, formatDistance, calculateTravelCharge } from '../../utils/distance';
import { useWorkerStore } from '../../stores/workerStore';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Linking } from 'react-native';
import { View, Text, StyleSheet, FlatList, ScrollView, Image, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { colors, spacing, radius } from '../../design-system/tokens';
import React, { useState, useCallback } from 'react';
import { parseJobDescription } from '../../utils/jobParser';




dayjs.extend(relativeTime);

export default function JobDetailPreviewScreen({ route, navigation }) {
    const { job: initialJob } = route.params || {};
    // Pre-populate dist so it's never blank before GPS fires
    const [job, setJob] = useState({ ...initialJob, dist: initialJob?.dist ?? null });
    const [loading, setLoading] = useState(false);
    const [locLoading, setLocLoading] = useState(true);
    const [permissionDenied, setPermissionDenied] = useState(false);
    const [workerLoc, setWorkerLoc] = useState(null);
    const { locationOverride } = useWorkerStore();

    // Parse structured data and photos
    const { structured: structuredQuestions, photos, text: parsedText } = parseJobDescription(job?.description || job?.desc);
    const finalDescription = parsedText || job?.description || job?.desc;

    React.useEffect(() => {
        const getDist = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    setPermissionDenied(true);
                    setLocLoading(false);
                    return;
                }

                let currentCoords = null;
                if (locationOverride) {
                    currentCoords = { lat: locationOverride.lat, lng: locationOverride.lng };
                } else {
                    const location = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced
                    });

                    currentCoords = {
                        lat: location.coords.latitude,
                        lng: location.coords.longitude
                    };
                }
                setWorkerLoc(currentCoords);

                if (job.latitude && job.longitude) {
                    const kms = haversineKm(
                        currentCoords.lat,
                        currentCoords.lng,
                        parseFloat(job.latitude),
                        parseFloat(job.longitude)
                    );

                    const travel = calculateTravelCharge(kms);
                    const baseRate = parseFloat(job.rate_per_hour || 0);
                    // Assume minimum 1 hour if unspecified for estimate
                    const estTotal = baseRate + travel + (parseFloat(job.advance_amount || 0));

                    setJob(prev => ({
                        ...prev,
                        dist: kms,
                        travel_charge: travel,
                        total_amount: estTotal
                    }));
                } else if (initialJob.dist !== undefined) {
                    // Fallback: If latitude/longitude are hidden (e.g. privacy), use the pre-calculated distance from the server/AvailableJobsScreen
                    const travel = calculateTravelCharge(initialJob.dist);
                    const baseRate = parseFloat(job.rate_per_hour || 0);
                    const estTotal = baseRate + travel + (parseFloat(job.advance_amount || 0));

                    setJob(prev => ({
                        ...prev,
                        dist: initialJob.dist,
                        travel_charge: travel,
                        total_amount: estTotal
                    }));
                }
            } catch (err) {
                console.error('[JobPreview] Dist calc failed', err);
            } finally {
                setLocLoading(false);
            }
        };
        getDist();
    }, []);

    const handleAccept = async () => {
        setLoading(true);
        try {
            // Updated: share location immediately on acceptance
            if (workerLoc) {
                await apiClient.put('/api/worker/location', {
                    lat: workerLoc.lat,
                    lng: workerLoc.lng
                }).catch(e => console.warn('Location sync on accept failed', e));
            }

            await apiClient.post(`/api/worker/jobs/${job.id}/accept`);
            navigation.replace('ActiveJob', { jobId: job.id });
        } catch (error) {
            setLoading(false);
            if (error.response?.status === 409) {
                Alert.alert('Too Slow!', 'This job was already taken by another worker.');
                navigation.goBack();
            } else {
                Alert.alert('Error', error.response?.data?.message || 'Failed to accept job.');
            }
        }
    };

    if (!job) {
        return (
            <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: colors.text.muted }}>Job data missing.</Text>
            </View>
        );
    }

    const isEmergency = job.is_emergency;

    return (
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => {
                    if (navigation.canGoBack()) {
                        navigation.goBack();
                    } else {
                        navigation.replace('WorkerTabs');
                    }
                }}>
                    <Text style={styles.backTxt}>←</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Job Preview</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Hero Card */}
                <View style={styles.heroCard}>
                    <View style={styles.heroTopRow}>
                        <View style={styles.categoryBadge}>
                            <Text style={styles.categoryIcon}>⚡</Text>
                            <Text style={styles.categoryTxt}>{job.category || 'Service'}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                            {isEmergency && (
                                <View style={styles.emergencyBadge}>
                                    <Text style={styles.emergencyTxt}>🚨 EMERGENCY</Text>
                                </View>
                            )}
                            <Text style={styles.timeTxt}>{dayjs(job.time).fromNow()}</Text>
                        </View>
                    </View>

                    <Text style={styles.estValue}>₹{job.total_amount ? parseFloat(job.total_amount).toFixed(0) : 'Price on completion'}</Text>

                    <View style={styles.distRow}>
                        {locLoading ? (
                            <View style={styles.shimmerDist} />
                        ) : permissionDenied ? (
                            <TouchableOpacity onPress={() => Linking.openSettings()} style={styles.permissionBox}>
                                <Text style={styles.permissionTxt}>📍 Enable location to see distance</Text>
                            </TouchableOpacity>
                        ) : (
                            <Text style={[
                                styles.distTxt,
                                job.dist != null && job.dist < 0.5 ? styles.distVeryClose : (job.dist != null && job.dist > 15 ? styles.distFar : null)
                            ]}>
                                📍 {job.dist != null ? formatDistance(job.dist) : 'Distance unknown'} away
                                {job.dist != null && job.dist < 0.5 && <Text style={styles.distNote}> — Very close</Text>}
                                {job.dist != null && job.dist > 15 && <Text style={styles.distNote}> — Long distance</Text>}
                            </Text>
                        )}
                        {job.wave_number > 1 && (
                            <View style={styles.waveBadge}>
                                <Text style={styles.waveTxt}>Wave {job.wave_number}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Customer Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>CUSTOMER</Text>
                    <View style={styles.customerCard}>
                        <Text style={styles.customerName}>👤 {job.customer_name || 'Customer'}</Text>
                        <Text style={styles.customerNote}>Full contact revealed after acceptance</Text>
                    </View>
                </View>

                {/* Description / Questions */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>JOB DETAILS</Text>
                    {structuredQuestions.length > 0 ? (
                        <View style={styles.structuredContainer}>
                            {structuredQuestions.map((item, idx) => (
                                <View key={idx} style={styles.qAndA}>
                                    <Text style={styles.qText}>{item.label}</Text>
                                    <Text style={styles.aText}>{item.value}</Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View style={styles.descCard}>
                            {finalDescription ? (
                                <Text style={styles.descText}>"{finalDescription}"</Text>
                            ) : (
                                <Text style={styles.descEmpty}>No details provided.</Text>
                            )}
                        </View>
                    )}
                </View>

                {/* Address */}
                {job.address ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>SERVICE AREA</Text>
                        <View style={styles.customerCard}>
                            <Text style={styles.customerName}>📍 General area only</Text>
                            <Text style={styles.customerNote}>Exact address shared after you accept</Text>
                        </View>
                    </View>
                ) : null}

                {/* Scheduled */}
                {job.scheduled_at ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>SCHEDULED FOR</Text>
                        <View style={[styles.customerCard, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                            <Text style={{ fontSize: 22 }}>🗓</Text>
                            <Text style={[styles.customerName, { flex: 1 }]}>
                                {dayjs(job.scheduled_at).format('ddd, D MMM YYYY')} at {dayjs(job.scheduled_at).format('h:mm A')}
                            </Text>
                        </View>
                    </View>
                ) : null}

                {/* Photos */}
                {photos.length > 0 ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>CUSTOMER PHOTOS ({photos.length})</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoList}>
                            {photos.map((uri, idx) => (
                                <Image
                                    key={idx}
                                    source={{ uri }}
                                    style={styles.photo}
                                    resizeMode="cover"
                                />
                            ))}
                        </ScrollView>
                    </View>
                ) : null}

                {/* Pricing Breakdown */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>PRICING BREAKDOWN</Text>
                    <View style={styles.pricingCard}>
                        <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>Rate</Text>
                            <Text style={styles.priceValue}>₹{job.rate_per_hour || 0}/hr</Text>
                        </View>
                        {job.advance_amount > 0 && (
                            <View style={styles.priceRow}>
                                <Text style={styles.priceLabel}>Advance</Text>
                                <Text style={styles.priceValue}>₹{job.advance_amount}</Text>
                            </View>
                        )}
                        {job.travel_charge > 0 && (
                            <View style={styles.priceRow}>
                                <Text style={styles.priceLabel}>Travel charge</Text>
                                <Text style={styles.priceValue}>₹{job.travel_charge}</Text>
                            </View>
                        )}
                        {job.total_amount > 0 && (
                            <View style={[styles.priceRow, styles.priceRowTotal]}>
                                <Text style={[styles.priceLabel, { color: colors.gold.primary }]}>Estimated Total</Text>
                                <Text style={[styles.priceValue, { color: colors.gold.primary, fontWeight: '800' }]}>₹{job.total_amount}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Info Grid */}
                <View style={styles.infoGrid}>
                    <View style={styles.infoCell}>
                        <Text style={styles.infoLabel}>Posted</Text>
                        <Text style={styles.infoValue}>{dayjs(job.time).format('D MMM, h:mm A')}</Text>
                    </View>
                    <View style={styles.infoCell}>
                        <Text style={styles.infoLabel}>Distance</Text>
                        <Text style={styles.infoValue}>{job.dist != null ? formatDistance(job.dist) : '—'}</Text>
                    </View>
                    <View style={styles.infoCell}>
                        <Text style={styles.infoLabel}>Category</Text>
                        <Text style={styles.infoValue}>{job.category ? job.category.charAt(0).toUpperCase() + job.category.slice(1) : '—'}</Text>
                    </View>
                    <View style={styles.infoCell}>
                        <Text style={styles.infoLabel}>Type</Text>
                        <Text style={styles.infoValue}>{job.scheduled_at ? '📅 Scheduled' : '⚡ Immediate'}</Text>
                    </View>
                </View>

                {/* Warning for Wave > 1 */}
                {job.wave_number > 1 && (
                    <View style={styles.warningBox}>
                        <Text style={styles.warningTxt}>
                            ⚠️ Wave {job.wave_number} — Other workers already notified. Act fast.
                        </Text>
                    </View>
                )}

            </ScrollView>

            {/* Action Bottom Bar */}
            <View style={styles.actionBar}>
                <TouchableOpacity
                    style={styles.ghostBtn}
                    onPress={() => navigation.goBack()}
                    disabled={loading}
                >
                    <Text style={styles.ghostTxt}>✕ Pass</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.acceptBtn, loading && styles.acceptBtnDisabled]}
                    onPress={handleAccept}
                    disabled={loading}
                    activeOpacity={0.85}
                >
                    {loading ? (
                        <ActivityIndicator color={colors.bg.primary} />
                    ) : (
                        <Text style={styles.acceptTxt}>✓ Accept Job</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: spacing.xl + 20, paddingHorizontal: spacing.sm, paddingBottom: spacing.lg,
        borderBottomWidth: 1, borderBottomColor: colors.bg.surface,
    },
    backBtn: { padding: spacing.sm },
    backTxt: { color: colors.text.primary, fontSize: 24 },
    title: { color: colors.text.primary, fontSize: 18, fontWeight: '700' },

    content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: 130 },

    // Hero
    heroCard: {
        backgroundColor: colors.bg.elevated, borderRadius: radius.xl,
        padding: spacing.xl, borderWidth: 1, borderColor: colors.gold.muted + '55',
        gap: spacing.md,
    },
    heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    categoryBadge: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: colors.bg.surface, paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm, borderRadius: radius.full,
    },
    categoryIcon: { fontSize: 16 },
    categoryTxt: { color: colors.text.secondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
    emergencyBadge: {
        backgroundColor: colors.error + '22', paddingHorizontal: spacing.sm,
        paddingVertical: 3, borderRadius: radius.sm,
    },
    emergencyTxt: { color: colors.error, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
    timeTxt: { color: colors.text.muted, fontSize: 12 },
    estValue: { color: colors.gold.primary, fontSize: 38, fontWeight: '800', fontFamily: 'Courier' },
    distRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 24 },
    distTxt: { color: colors.text.secondary, fontSize: 14, fontWeight: '600' },
    distVeryClose: { color: '#4ADE80' }, // Green
    distFar: { color: '#FACC15' }, // Amber
    distNote: { fontSize: 12, fontWeight: '400' },
    shimmerDist: { width: 100, height: 16, backgroundColor: colors.bg.surface, borderRadius: radius.xs, opacity: 0.5 },
    permissionBox: { backgroundColor: colors.bg.surface, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.md },
    permissionTxt: { color: colors.gold.primary, fontSize: 12, fontWeight: '700' },
    waveBadge: { backgroundColor: colors.gold.glow, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
    waveTxt: { color: colors.gold.primary, fontSize: 11, fontWeight: '700' },

    // Section
    section: { gap: spacing.sm },
    sectionLabel: { color: colors.text.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },

    // Customer
    customerCard: { backgroundColor: colors.bg.surface, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
    customerName: { color: colors.text.primary, fontSize: 16, fontWeight: '700' },
    customerNote: { color: colors.text.muted, fontSize: 12, fontStyle: 'italic' },

    // Pricing
    pricingCard: { backgroundColor: colors.bg.elevated, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.bg.surface },
    priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    priceRowTotal: { borderTopWidth: 1, borderTopColor: colors.bg.surface, paddingTop: spacing.sm, marginTop: spacing.xs },
    priceLabel: { color: colors.text.secondary, fontSize: 14 },
    priceValue: { color: colors.text.primary, fontSize: 14, fontWeight: '700' },

    // Description
    descCard: {
        backgroundColor: colors.bg.elevated, borderRadius: radius.lg,
        padding: spacing.lg, borderLeftWidth: 3, borderLeftColor: colors.gold.muted,
    },
    descText: { color: colors.text.primary, fontSize: 15, lineHeight: 24, fontStyle: 'italic' },
    descEmpty: { color: colors.text.muted, fontSize: 14, fontStyle: 'italic' },

    // Structured Details
    structuredContainer: {
        backgroundColor: colors.bg.elevated, borderRadius: radius.lg,
        padding: spacing.md, gap: spacing.md, borderWidth: 1, borderColor: colors.bg.surface
    },
    qAndA: { gap: 4, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.bg.surface + '44' },
    qText: { color: colors.text.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
    aText: { color: colors.text.primary, fontSize: 15, fontWeight: '600' },

    // Photo
    photoList: { gap: spacing.md, paddingRight: spacing.lg },
    photo: { width: 280, height: 200, borderRadius: radius.lg, backgroundColor: colors.bg.surface },

    // Info Grid
    infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    infoCell: {
        flex: 1, minWidth: '45%', backgroundColor: colors.bg.elevated,
        padding: spacing.md, borderRadius: radius.md, gap: 4,
    },
    infoLabel: { color: colors.text.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
    infoValue: { color: colors.text.primary, fontSize: 15, fontWeight: '700' },

    // Warning
    warningBox: {
        backgroundColor: colors.warning + '18', borderRadius: radius.md,
        padding: spacing.md, borderWidth: 1, borderColor: colors.warning + '44',
    },
    warningTxt: { color: colors.warning, fontSize: 13, lineHeight: 20 },

    // Action bar
    actionBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: colors.bg.elevated, borderTopWidth: 1, borderTopColor: colors.bg.surface,
        flexDirection: 'row', padding: spacing.lg, paddingBottom: spacing.xl + 10,
        gap: spacing.md, alignItems: 'center',
    },
    ghostBtn: {
        flex: 1, alignItems: 'center', padding: spacing.md,
        borderRadius: radius.md, borderWidth: 1, borderColor: colors.bg.surface,
    },
    ghostTxt: { color: colors.text.muted, fontSize: 15, fontWeight: '700' },
    acceptBtn: {
        flex: 2, backgroundColor: colors.gold.primary, paddingVertical: spacing.md + 2,
        borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    },
    acceptBtnDisabled: { opacity: 0.6 },
    acceptTxt: { color: colors.bg.primary, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
});
