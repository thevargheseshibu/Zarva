import React, { useState, useEffect } from 'react';
import { useTokens } from '../../design-system';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useT } from '../../hooks/useT';
import apiClient from '../../services/api/client';
import FadeInView from '../../components/FadeInView';
import PremiumButton from '../../components/PremiumButton';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import Card from '../../components/Card';



export default function RatingScreen({ route, navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
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
                        star <= value ? { color: tTheme.brand.primary } : { color: tTheme.background.surface }
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
                <ActivityIndicator size="large" color={tTheme.brand.primary} />
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
                        <Text style={styles.skipTxt}>{t('skip_caps')}</Text>
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
                    <Text style={styles.title}>{isReadOnly ? t('your_review') : t('rate_name').replace('%{name}', worker.name)}</Text>
                    <Text style={styles.sub}>
                        {isReadOnly ? t('thank_you_feedback') : t('how_was_experience')}
                    </Text>
                </FadeInView>

                {/* Main Rating */}
                <FadeInView delay={200} style={styles.mainRatingBox}>
                    <StarRow value={rating} onChange={setRating} size={56} />
                    <Text style={styles.ratingLabel}>
                        {rating === 1 && t('rating_poor')}
                        {rating === 2 && t('rating_fair')}
                        {rating === 3 && t('rating_good')}
                        {rating === 4 && t('rating_very_good')}
                        {rating === 5 && t('rating_exceptional')}
                        {rating === 0 && t('rating_select')}
                    </Text>
                </FadeInView>

                {/* Sub Metrics */}
                {(rating > 0 || isReadOnly) && (
                    <FadeInView delay={350}>
                        <Card style={styles.metricsCard}>
                            <View style={styles.metricRow}>
                                <Text style={styles.metricLabel}>{t('punctuality')}</Text>
                                <StarRow value={punctuality} onChange={setPunctuality} size={24} />
                            </View>
                            <View style={styles.metricRow}>
                                <Text style={styles.metricLabel}>{t('communication')}</Text>
                                <StarRow value={communication} onChange={setCommunication} size={24} />
                            </View>
                            <View style={styles.metricRow}>
                                <Text style={styles.metricLabel}>{t('professionalism')}</Text>
                                <StarRow value={professionalism} onChange={setProfessionalism} size={24} />
                            </View>

                            <View style={styles.commentWrap}>
                                <Text style={styles.commentLabel}>{t('comment_caps')}</Text>
                                <TextInput
                                    style={[styles.input, isReadOnly && styles.inputDisabled]}
                                    placeholder={t('add_details_experience')}
                                    placeholderTextColor={tTheme.text.tertiary}
                                    value={comment}
                                    onChangeText={setComment}
                                    multiline
                                    editable={!isReadOnly}
                                    selectionColor={tTheme.brand.primary}
                                />
                            </View>
                        </Card>
                    </FadeInView>
                )}

                <View style={styles.footer}>
                    <PremiumButton
                        title={isReadOnly ? t('back_to_home') : t('submit_review')}
                        isDisabled={!isReadOnly && rating === 0}
                        loading={loading}
                        onPress={handleSubmit}
                    />
                </View>

            </ScrollView>
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
    headerBtnTxt: { color: t.text.primary, fontSize: 18 },
    skipTxt: { color: t.brand.primary, fontSize: 12, fontWeight: t.typography.weight.bold, letterSpacing: 1 },

    scrollContent: { padding: t.spacing['2xl'], paddingBottom: 120 },

    profileBox: { alignItems: 'center', gap: t.spacing.lg, marginBottom: t.spacing[40] },
    photoContainer: { position: 'relative' },
    photo: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: t.border.default },
    ratingBadge: {
        position: 'absolute',
        bottom: -10,
        alignSelf: 'center',
        backgroundColor: t.background.surface,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: t.radius.full,
        borderWidth: 1,
        borderColor: t.border.default,
        ...t.shadows.premium
    },
    ratingBadgeTxt: { color: t.text.primary, fontSize: 10, fontWeight: t.typography.weight.bold },

    title: { color: t.text.primary, fontSize: t.typography.size.hero, fontWeight: t.typography.weight.bold, letterSpacing: t.typography.tracking.hero, textAlign: 'center' },
    sub: { color: t.text.secondary, fontSize: t.typography.size.body, textAlign: 'center', paddingHorizontal: t.spacing[32] },

    mainRatingBox: { alignItems: 'center', gap: t.spacing.md, marginBottom: t.spacing[40] },
    starRow: { flexDirection: 'row', gap: t.spacing.sm, justifyContent: 'center' },
    star: { textShadowColor: 'rgba(189, 0, 255, 0.3)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 10 },
    ratingLabel: { color: t.brand.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.bold, letterSpacing: 1 },

    metricsCard: { padding: t.spacing['2xl'], gap: t.spacing[20] },
    metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    metricLabel: { color: t.text.primary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.semibold },

    commentWrap: { marginTop: t.spacing.md, gap: 8 },
    commentLabel: { color: t.text.tertiary, fontSize: 9, fontWeight: t.typography.weight.bold, letterSpacing: 1.5 },
    input: {
        backgroundColor: t.background.surfaceRaised,
        borderRadius: t.radius.lg,
        padding: t.spacing.lg,
        color: t.text.primary,
        fontSize: t.typography.size.body,
        minHeight: 120,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: t.background.surface
    },
    inputDisabled: { opacity: 0.7, backgroundColor: t.background.surface },

    footer: { marginTop: t.spacing[48] }
});
