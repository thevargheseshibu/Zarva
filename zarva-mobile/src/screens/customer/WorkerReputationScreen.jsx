import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useT } from '../../hooks/useT';
import apiClient from '../../services/api/client';
import FadeInView from '../../components/FadeInView';
import Card from '../../components/Card';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import { colors, radius, spacing, shadows } from '../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../design-system/typography';

export default function WorkerReputationScreen({ route, navigation }) {
    const t = useT();
    const { workerId, workerName } = route.params || {};
    const [loading, setLoading] = useState(true);
    const [reviews, setReviews] = useState([]);
    const [summary, setSummary] = useState({ avg: 0, count: 0 });

    useEffect(() => {
        const fetchReviews = async () => {
            if (!workerId) {
                setLoading(false);
                return;
            }
            try {
                const res = await apiClient.get(`/api/reviews/worker/${workerId}`);
                const data = res.data?.data?.reviews || res.data?.reviews || [];
                setReviews(data);

                if (data.length > 0) {
                    const avg = data.reduce((acc, r) => acc + (r.overall_score || 0), 0) / data.length;
                    setSummary({ avg, count: data.length });
                }
            } catch (err) {
                console.error('Failed to fetch worker reviews', err);
            } finally {
                setLoading(false);
            }
        };
        fetchReviews();
    }, [workerId]);

    if (loading) {
        return (
            <View style={styles.loadingScreen}>
                <ActivityIndicator size="large" color={colors.accent.primary} />
                <Text style={styles.loadingText}>Loading Reputation...</Text>
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <PressableAnimated onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Text style={styles.headerBtnTxt}>←</Text>
                </PressableAnimated>
                <Text style={styles.headerTitle}>Professional Reputation</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* Summary Section */}
                <FadeInView delay={50}>
                    <Card style={styles.summaryCard}>
                        <View style={styles.summaryHeader}>
                            <View style={styles.scoreBox}>
                                <Text style={styles.avgScore}>{summary.avg.toFixed(1)}</Text>
                                <Text style={styles.maxScore}>/ 5.0</Text>
                            </View>
                            <View style={styles.summaryInfo}>
                                <Text style={styles.workerName}>{workerName || 'Professional'}</Text>
                                <View style={styles.starsBox}>
                                    <Text style={styles.starsTxt}>{"★".repeat(Math.round(summary.avg))}</Text>
                                    <Text style={styles.reviewsCount}>{summary.count} verified reviews</Text>
                                </View>
                            </View>
                        </View>
                    </Card>
                </FadeInView>

                <FadeInView delay={200}>
                    <Text style={styles.sectionHeader}>VERIFIED EXCELLENCE</Text>
                </FadeInView>

                {reviews.length === 0 ? (
                    <FadeInView delay={300} style={styles.emptyBox}>
                        <Text style={styles.emptyTxt}>No reviews yet. Be the first to share your experience!</Text>
                    </FadeInView>
                ) : (
                    reviews.map((item, index) => (
                        <FadeInView key={item.id} delay={300 + index * 100}>
                            <Card style={styles.reviewCard}>
                                <View style={styles.reviewTop}>
                                    <View>
                                        <Text style={styles.reviewerName}>{item.reviewer_identifier}</Text>
                                        <Text style={styles.reviewDate}>{new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                                    </View>
                                    <View style={styles.reviewStarsBox}>
                                        <Text style={styles.reviewStars}>{"★".repeat(item.overall_score)}</Text>
                                    </View>
                                </View>

                                {item.comment && (
                                    <Text style={styles.reviewComment}>"{item.comment}"</Text>
                                )}

                                {item.category_scores && Object.keys(item.category_scores).length > 0 && (
                                    <View style={styles.metricTags}>
                                        {Object.entries(item.category_scores).map(([key, val]) => (
                                            <View key={key} style={styles.metricTag}>
                                                <Text style={styles.metricTagTxt}>
                                                    {key.toUpperCase()}: {val}/5
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </Card>
                        </FadeInView>
                    ))
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    loadingScreen: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', gap: spacing[16] },
    loadingText: { color: colors.text.muted, fontSize: fontSize.caption, fontWeight: fontWeight.medium, letterSpacing: 1 },

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

    scrollContent: { padding: spacing[24], paddingBottom: 120 },

    summaryCard: {
        padding: spacing[24],
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.accent.border + '22',
        marginBottom: spacing[32]
    },
    summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[24] },
    scoreBox: { alignItems: 'flex-end', flexDirection: 'row', gap: 2 },
    avgScore: { color: colors.accent.primary, fontSize: 48, fontWeight: '900', lineHeight: 52 },
    maxScore: { color: colors.text.muted, fontSize: 14, fontWeight: fontWeight.bold, marginBottom: 8 },

    summaryInfo: { flex: 1, gap: 4 },
    workerName: { color: colors.text.primary, fontSize: fontSize.cardTitle, fontWeight: fontWeight.bold, letterSpacing: tracking.cardTitle },
    starsBox: { gap: 2 },
    starsTxt: { color: colors.accent.primary, fontSize: 16, letterSpacing: 2 },
    reviewsCount: { color: colors.text.muted, fontSize: 10, fontWeight: fontWeight.medium },

    sectionHeader: {
        color: colors.accent.primary,
        fontSize: 10,
        fontWeight: fontWeight.bold,
        letterSpacing: 2,
        marginBottom: spacing[16]
    },

    reviewCard: {
        padding: spacing[20],
        marginBottom: spacing[16],
        gap: spacing[12],
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surface
    },
    reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    reviewerName: { color: colors.text.primary, fontSize: fontSize.body, fontWeight: fontWeight.bold },
    reviewDate: { color: colors.text.muted, fontSize: 10, marginTop: 2 },
    reviewStarsBox: { backgroundColor: colors.accent.primary + '11', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    reviewStars: { color: colors.accent.primary, fontSize: 12, letterSpacing: 1 },

    reviewComment: { color: colors.text.primary, fontSize: fontSize.caption, lineHeight: 20, fontStyle: 'italic', opacity: 0.9 },

    metricTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    metricTag: {
        backgroundColor: colors.elevated,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.surface
    },
    metricTagTxt: { color: colors.text.muted, fontSize: 8, fontWeight: fontWeight.bold, letterSpacing: 0.5 },

    emptyBox: {
        padding: spacing[48],
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.accent.border + '22',
        borderStyle: 'dashed'
    },
    emptyTxt: { color: colors.text.muted, fontSize: fontSize.body, textAlign: 'center', fontStyle: 'italic' }
});
