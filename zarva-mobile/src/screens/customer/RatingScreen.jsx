import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useT } from '../../hooks/useT';
import apiClient from '../../services/api/client';
import FadeInView from '../../components/FadeInView';
import PremiumButton from '../../components/PremiumButton';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import Card from '../../components/Card';
import { colors, radius, spacing, shadows } from '../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../design-system/typography';

export default function RatingScreen({ route, navigation }) {
    const t = useT();
    const { jobId } = route.params || {};

    const [rating, setRating] = useState(0);
    const [punctuality, setPunctuality] = useState(0);
    const [communication, setCommunication] = useState(0);
    const [professionalism, setProfessionalism] = useState(0);
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchLoading, setFetchLoading] = useState(true);
    const [job, setJob] = useState(null);

    useEffect(() => {
        const fetchDetails = async () => {
            if (!jobId) {
                setFetchLoading(false);
                return;
            }
            try {
                const res = await apiClient.get(`/api/jobs/${jobId}`);
                const jobData = res.data?.job;
                setJob(jobData);

                if (jobData?.is_reviewed && jobData.review) {
                    const rev = jobData.review;
                    setRating(rev.score || 0);
                    if (rev.category_scores) {
                        setPunctuality(rev.category_scores.punctuality || 0);
                        setCommunication(rev.category_scores.communication || 0);
                        setProfessionalism(rev.category_scores.professionalism || 0);
                    }
                    setComment(rev.comment || '');
                }
            } catch (err) {
                console.error('Failed to fetch job for rating', err);
            } finally {
                setFetchLoading(false);
            }
        };
        fetchDetails();
    }, [jobId]);

    const worker = job?.worker || { name: 'Professional', photo: null, rating: 0 };
    const isReadOnly = !!job?.is_reviewed;

    const handleSubmit = async () => {
        if (isReadOnly) {
            navigation.popToTop();
            return;
        }
        setLoading(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        try {
            await apiClient.post(`/api/reviews`, {
                job_id: jobId,
                overall_score: rating,
                category_scores: {
                    punctuality,
                    communication,
                    professionalism
                },
                comment
            });
            navigation.popToTop();
        } catch (err) {
            console.error('Failed to submit review', err);
            Alert.alert('Error', 'Failed to submit feedback. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const StarRow = ({ value, onChange, size = 32 }) => (
        <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                    key={star}
                    onPress={() => {
                        if (!isReadOnly) {
                            onChange(star);
                            Haptics.selectionAsync();
                        }
                    }}
                    activeOpacity={isReadOnly ? 1 : 0.7}
                    disabled={isReadOnly}
                >
                    <Text style={[
                        styles.star,
                        { fontSize: size },
                        star <= value ? { color: colors.accent.primary } : { color: colors.surface }
                    ]}>
                        {star <= value ? '★' : '☆'}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    if (fetchLoading) {
        return (
            <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.accent.primary} />
            </View>
        );
    }

    const workerPhoto = worker.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.name)}&background=101014&color=BD00FF`;

    return (
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <PressableAnimated onPress={() => navigation.popToTop()} style={styles.headerBtn}>
                    <Text style={styles.headerBtnTxt}>✕</Text>
                </PressableAnimated>
                {!isReadOnly && (
                    <TouchableOpacity onPress={() => navigation.popToTop()}>
                        <Text style={styles.skipTxt}>SKIP</Text>
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                <FadeInView delay={50} style={styles.profileBox}>
                    <View style={styles.photoContainer}>
                        <Image source={{ uri: workerPhoto }} style={styles.photo} />
                        <View style={styles.ratingBadge}>
                            <Text style={styles.ratingBadgeTxt}>⭐ {parseFloat(worker.rating || 0).toFixed(1)}</Text>
                        </View>
                    </View>
                    <Text style={styles.title}>{isReadOnly ? 'Your Review' : `Rate ${worker.name}`}</Text>
                    <Text style={styles.sub}>
                        {isReadOnly ? 'Thank you for your valuable feedback.' : 'How was your experience with the service?'}
                    </Text>
                </FadeInView>

                {/* Main Rating */}
                <FadeInView delay={200} style={styles.mainRatingBox}>
                    <StarRow value={rating} onChange={setRating} size={56} />
                    <Text style={styles.ratingLabel}>
                        {rating === 1 && "Poor"}
                        {rating === 2 && "Fair"}
                        {rating === 3 && "Good"}
                        {rating === 4 && "Very Good"}
                        {rating === 5 && "Exceptional!"}
                        {rating === 0 && "Select a Rating"}
                    </Text>
                </FadeInView>

                {/* Sub Metrics */}
                {(rating > 0 || isReadOnly) && (
                    <FadeInView delay={350}>
                        <Card style={styles.metricsCard}>
                            <View style={styles.metricRow}>
                                <Text style={styles.metricLabel}>Punctuality</Text>
                                <StarRow value={punctuality} onChange={setPunctuality} size={24} />
                            </View>
                            <View style={styles.metricRow}>
                                <Text style={styles.metricLabel}>Communication</Text>
                                <StarRow value={communication} onChange={setCommunication} size={24} />
                            </View>
                            <View style={styles.metricRow}>
                                <Text style={styles.metricLabel}>Professionalism</Text>
                                <StarRow value={professionalism} onChange={setProfessionalism} size={24} />
                            </View>

                            <View style={styles.commentWrap}>
                                <Text style={styles.commentLabel}>COMMENT</Text>
                                <TextInput
                                    style={[styles.input, isReadOnly && styles.inputDisabled]}
                                    placeholder="Add details about your experience..."
                                    placeholderTextColor={colors.text.muted}
                                    value={comment}
                                    onChangeText={setComment}
                                    multiline
                                    editable={!isReadOnly}
                                    selectionColor={colors.accent.primary}
                                />
                            </View>
                        </Card>
                    </FadeInView>
                )}

                <View style={styles.footer}>
                    <PremiumButton
                        title={isReadOnly ? "Back to Home" : "Submit Review"}
                        isDisabled={!isReadOnly && rating === 0}
                        loading={loading}
                        onPress={handleSubmit}
                    />
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
    headerBtnTxt: { color: colors.text.primary, fontSize: 18 },
    skipTxt: { color: colors.accent.primary, fontSize: 12, fontWeight: fontWeight.bold, letterSpacing: 1 },

    scrollContent: { padding: spacing[24], paddingBottom: 120 },

    profileBox: { alignItems: 'center', gap: spacing[16], marginBottom: spacing[40] },
    photoContainer: { position: 'relative' },
    photo: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: colors.accent.border },
    ratingBadge: {
        position: 'absolute',
        bottom: -10,
        alignSelf: 'center',
        backgroundColor: colors.surface,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.accent.border,
        ...shadows.premium
    },
    ratingBadgeTxt: { color: colors.text.primary, fontSize: 10, fontWeight: fontWeight.bold },

    title: { color: colors.text.primary, fontSize: fontSize.hero, fontWeight: fontWeight.bold, letterSpacing: tracking.hero, textAlign: 'center' },
    sub: { color: colors.text.secondary, fontSize: fontSize.body, textAlign: 'center', paddingHorizontal: spacing[32] },

    mainRatingBox: { alignItems: 'center', gap: spacing[12], marginBottom: spacing[40] },
    starRow: { flexDirection: 'row', gap: spacing[8], justifyContent: 'center' },
    star: { textShadowColor: 'rgba(189, 0, 255, 0.3)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 10 },
    ratingLabel: { color: colors.accent.primary, fontSize: fontSize.body, fontWeight: fontWeight.bold, letterSpacing: 1 },

    metricsCard: { padding: spacing[24], gap: spacing[20] },
    metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    metricLabel: { color: colors.text.primary, fontSize: fontSize.caption, fontWeight: fontWeight.semibold },

    commentWrap: { marginTop: spacing[12], gap: 8 },
    commentLabel: { color: colors.text.muted, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 1.5 },
    input: {
        backgroundColor: colors.elevated,
        borderRadius: radius.lg,
        padding: spacing[16],
        color: colors.text.primary,
        fontSize: fontSize.body,
        minHeight: 120,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: colors.surface
    },
    inputDisabled: { opacity: 0.7, backgroundColor: colors.surface },

    footer: { marginTop: spacing[48] }
});
