import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { colors, spacing, radius } from '../../design-system/tokens';
import Card from '../../components/Card';
import apiClient from '../../services/api/client';

export default function WorkerReputationScreen({ route, navigation }) {
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
                <ActivityIndicator size="large" color={colors.gold.primary} />
                <Text style={styles.loadingText}>Fetching Reputation...</Text>
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backTxt}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Worker Reputation</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                {/* Summary Card */}
                <Card style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>{workerName || 'Worker'}</Text>
                    <View style={styles.ratingRow}>
                        <Text style={styles.avgScore}>{summary.avg.toFixed(1)}</Text>
                        <View>
                            <Text style={styles.stars}>{"★".repeat(Math.round(summary.avg))}</Text>
                            <Text style={styles.countTxt}>{summary.count} reviews shared by users</Text>
                        </View>
                    </View>
                </Card>

                <Text style={styles.sectionTitle}>Past Feedback</Text>

                {reviews.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyTxt}>No reviews yet for this worker.</Text>
                    </View>
                ) : (
                    reviews.map((item) => (
                        <Card key={item.id} style={styles.reviewCard}>
                            <View style={styles.reviewTop}>
                                <Text style={styles.reviewerName}>{item.reviewer_identifier}</Text>
                                <Text style={styles.reviewDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                            </View>
                            <Text style={styles.reviewStars}>{"★".repeat(item.overall_score)}</Text>
                            {item.comment && <Text style={styles.reviewComment}>"{item.comment}"</Text>}

                            {/* Detailed categories if available */}
                            {item.category_scores && Object.keys(item.category_scores).length > 0 && (
                                <View style={styles.categories}>
                                    {Object.entries(item.category_scores).map(([key, val]) => (
                                        <Text key={key} style={styles.catItem}>
                                            {key.charAt(0).toUpperCase() + key.slice(1)}: {val}/5
                                        </Text>
                                    ))}
                                </View>
                            )}
                        </Card>
                    ))
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary },
    loadingScreen: { flex: 1, backgroundColor: colors.bg.primary, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
    loadingText: { color: colors.text.muted, fontSize: 14 },

    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: spacing.xl + 20, paddingHorizontal: spacing.sm, paddingBottom: spacing.lg,
        borderBottomWidth: 1, borderBottomColor: colors.bg.surface
    },
    backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    backTxt: { color: colors.text.primary, fontSize: 24 },
    headerTitle: { color: colors.text.primary, fontSize: 18, fontWeight: '700' },

    scroll: { padding: spacing.lg, gap: spacing.md },

    summaryCard: { padding: spacing.xl, alignItems: 'center', gap: spacing.md },
    summaryTitle: { color: colors.text.primary, fontSize: 22, fontWeight: '800' },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
    avgScore: { color: colors.gold.primary, fontSize: 48, fontWeight: '900' },
    stars: { color: colors.gold.primary, fontSize: 20, letterSpacing: 2 },
    countTxt: { color: colors.text.muted, fontSize: 12, marginTop: 4 },

    sectionTitle: { color: colors.text.primary, fontSize: 16, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.xs },

    reviewCard: { padding: spacing.lg, gap: spacing.sm },
    reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    reviewerName: { color: colors.text.primary, fontSize: 14, fontWeight: '700' },
    reviewDate: { color: colors.text.muted, fontSize: 12 },
    reviewStars: { color: colors.gold.primary, fontSize: 14 },
    reviewComment: { color: colors.text.secondary, fontSize: 14, fontStyle: 'italic', lineHeight: 20 },

    categories: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
    catItem: { color: colors.text.muted, fontSize: 11, backgroundColor: colors.bg.surface, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },

    emptyBox: { padding: spacing.xxl, alignItems: 'center' },
    emptyTxt: { color: colors.text.muted, fontStyle: 'italic' }
});
