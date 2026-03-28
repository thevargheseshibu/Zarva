import React, { useState, useEffect } from 'react';
import { useTokens } from '@shared/design-system';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useT } from '@shared/i18n/useTranslation';
import apiClient from '@infra/api/client';
import FadeInView from '@shared/ui/FadeInView';
import Card from '@shared/ui/ZCard';
import PressableAnimated from '@shared/design-system/components/PressableAnimated';

export default function WorkerReputationScreen({ route, navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
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
                <ActivityIndicator size="large" color={tTheme.brand.primary} />
                <Text style={styles.loadingText}>{t('loading_reputation')}</Text>
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
                <Text style={styles.headerTitle}>{t('professional_reputation')}</Text>
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
                                <Text style={styles.workerName}>{workerName || t('worker') || 'Professional'}</Text>
                                <View style={styles.starsBox}>
                                    <Text style={styles.starsTxt}>{"★".repeat(Math.round(summary.avg))}</Text>
                                    <Text style={styles.reviewsCount}>{t('verified_reviews_count').replace('%{count}', summary.count)}</Text>
                                </View>
                            </View>
                        </View>
                    </Card>
                </FadeInView>

                <FadeInView delay={200}>
                    <Text style={styles.sectionHeader}>{t('verified_excellence')}</Text>
                </FadeInView>

                {reviews.length === 0 ? (
                    <FadeInView delay={300} style={styles.emptyBox}>
                        <Text style={styles.emptyTxt}>{t('no_reviews_yet')}</Text>
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

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.app },
    loadingScreen: { flex: 1, backgroundColor: t.background.app, justifyContent: 'center', alignItems: 'center', gap: t.spacing.lg },
    loadingText: { color: t.text.tertiary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.medium, letterSpacing: 1 },

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

    scrollContent: { padding: t.spacing['2xl'], paddingBottom: 120 },

    summaryCard: {
        padding: t.spacing['2xl'],
        backgroundColor: t.background.surface,
        borderWidth: 1,
        borderColor: t.border.default + '22',
        marginBottom: t.spacing[32]
    },
    summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: t.spacing['2xl'] },
    scoreBox: { alignItems: 'flex-end', flexDirection: 'row', gap: 2 },
    avgScore: { color: t.brand.primary, fontSize: 48, fontWeight: '900', lineHeight: 52 },
    maxScore: { color: t.text.tertiary, fontSize: 14, fontWeight: t.typography.weight.bold, marginBottom: 8 },

    summaryInfo: { flex: 1, gap: 4 },
    workerName: { color: t.text.primary, fontSize: t.typography.size.cardTitle, fontWeight: t.typography.weight.bold, letterSpacing: t.typography.tracking.cardTitle },
    starsBox: { gap: 2 },
    starsTxt: { color: t.brand.primary, fontSize: 16, letterSpacing: 2 },
    reviewsCount: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.medium },

    sectionHeader: {
        color: t.brand.primary,
        fontSize: 10,
        fontWeight: t.typography.weight.bold,
        letterSpacing: 2,
        marginBottom: t.spacing.lg
    },

    reviewCard: {
        padding: t.spacing[20],
        marginBottom: t.spacing.lg,
        gap: t.spacing.md,
        backgroundColor: t.background.surface,
        borderWidth: 1,
        borderColor: t.background.surface
    },
    reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    reviewerName: { color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.bold },
    reviewDate: { color: t.text.tertiary, fontSize: 10, marginTop: 2 },
    reviewStarsBox: { backgroundColor: t.brand.primary + '11', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    reviewStars: { color: t.brand.primary, fontSize: 12, letterSpacing: 1 },

    reviewComment: { color: t.text.primary, fontSize: t.typography.size.caption, lineHeight: 20, fontStyle: 'italic', opacity: 0.9 },

    metricTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    metricTag: {
        backgroundColor: t.background.surfaceRaised,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: t.radius.md,
        borderWidth: 1,
        borderColor: t.background.surface
    },
    metricTagTxt: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 0.5 },

    emptyBox: {
        padding: t.spacing[48],
        alignItems: 'center',
        backgroundColor: t.background.surface,
        borderRadius: t.radius.xl,
        borderWidth: 1,
        borderColor: t.border.default + '22',
        borderStyle: 'dashed'
    },
    emptyTxt: { color: t.text.tertiary, fontSize: t.typography.size.body, textAlign: 'center', fontStyle: 'italic' }
});
