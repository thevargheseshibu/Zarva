import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator } from 'react-native';
import { colors, spacing, radius } from '../../design-system/tokens';
import GoldButton from '../../components/GoldButton';
import apiClient from '../../services/api/client';

export default function RatingScreen({ route, navigation }) {
    const { jobId } = route.params || {};

    const [rating, setRating] = useState(0);
    const [punctuality, setPunctuality] = useState(0);
    const [communication, setCommunication] = useState(0);
    const [professionalism, setProfessionalism] = useState(0);
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchLoading, setFetchLoading] = useState(true);

    const [job, setJob] = useState(null);

    React.useEffect(() => {
        const fetchDetails = async () => {
            if (!jobId) {
                setFetchLoading(false);
                return;
            }
            try {
                const res = await apiClient.get(`/api/jobs/${jobId}`);
                setJob(res.data?.job);
            } catch (err) {
                console.error('Failed to fetch job for rating', err);
            } finally {
                setFetchLoading(false);
            }
        };
        fetchDetails();
    }, [jobId]);

    const worker = job?.worker || { name: 'Worker', photo: null, rating: 0 };

    const handleSubmit = async () => {
        setLoading(true);
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
            navigation.popToTop(); // Back to Home in CustomerStack
        } catch (err) {
            console.error('Failed to submit review', err);
            Alert.alert('Error', err.response?.data?.message || 'Failed to submit review');
        } finally {
            setLoading(false);
        }
    };

    const StarRow = ({ value, onChange, size = 32 }) => (
        <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => onChange(star)} activeOpacity={0.8}>
                    <Text style={[styles.star, { fontSize: size, color: star <= value ? colors.gold.primary : colors.bg.surface }]}>
                        ★
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    if (fetchLoading) {
        return (
            <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.gold.primary} />
            </View>
        );
    }

    const workerPhoto = worker.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.name)}&background=random`;

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.popToTop()} style={styles.skipBtn}>
                    <Text style={styles.skipTxt}>Skip</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                <View style={styles.profileBox}>
                    <Image source={{ uri: workerPhoto }} style={styles.photo} />
                    <Text style={styles.title}>Rate {worker.name}</Text>
                    {parseFloat(worker.rating) > 0 ? (
                        <TouchableOpacity
                            onPress={() => navigation.navigate('WorkerReputation', {
                                workerId: worker.user_id || worker.id,
                                workerName: worker.name
                            })}
                            style={styles.reputationBadge}
                        >
                            <Text style={styles.reputationTxt}>★ {parseFloat(worker.rating).toFixed(1)}</Text>
                            <Text style={styles.reputationLbl}>Worker Reputation ›</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.newWorkerBadgeRating}>
                            <Text style={styles.newWorkerTxtRating}>New Worker</Text>
                        </View>
                    )}
                    <Text style={styles.sub}>How was your experience with this service?</Text>
                </View>

                {/* Main Rating */}
                <View style={[styles.section, { alignItems: 'center', marginBottom: spacing.xl }]}>
                    <StarRow value={rating} onChange={setRating} size={48} />
                </View>

                {/* Sub Metrics */}
                {rating > 0 && (
                    <View style={styles.metricsBox}>
                        <View style={styles.metricRow}>
                            <Text style={styles.metricLabel}>Punctuality</Text>
                            <StarRow value={punctuality} onChange={setPunctuality} size={28} />
                        </View>
                        <View style={styles.metricRow}>
                            <Text style={styles.metricLabel}>Communication</Text>
                            <StarRow value={communication} onChange={setCommunication} size={28} />
                        </View>
                        <View style={styles.metricRow}>
                            <Text style={styles.metricLabel}>Professionalism</Text>
                            <StarRow value={professionalism} onChange={setProfessionalism} size={28} />
                        </View>

                        <TextInput
                            style={styles.input}
                            placeholder="Add a comment... (optional)"
                            placeholderTextColor={colors.text.muted}
                            value={comment}
                            onChangeText={setComment}
                            multiline
                        />
                    </View>
                )}

            </ScrollView>

            <View style={styles.footer}>
                <GoldButton
                    title="Submit Feedback"
                    disabled={rating === 0}
                    loading={loading}
                    onPress={handleSubmit}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary },
    header: {
        flexDirection: 'row', justifyContent: 'flex-end',
        paddingTop: spacing.xl + 20, paddingHorizontal: spacing.lg
    },
    skipBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    skipTxt: { color: colors.text.muted, fontSize: 16, fontWeight: '600' },

    content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },

    profileBox: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl },
    photo: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: colors.gold.primary },
    title: { color: colors.text.primary, fontSize: 24, fontWeight: '700' },
    sub: { color: colors.text.secondary, fontSize: 15 },

    section: { gap: spacing.md },
    starRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
    star: { textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },

    metricsBox: {
        backgroundColor: colors.bg.surface, borderRadius: radius.lg,
        padding: spacing.xl, gap: spacing.lg
    },
    metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    metricLabel: { color: colors.text.primary, fontSize: 15, fontWeight: '600' },

    input: {
        backgroundColor: colors.bg.primary, borderRadius: radius.md,
        color: colors.text.primary, padding: spacing.md, fontSize: 15,
        minHeight: 100, textAlignVertical: 'top', marginTop: spacing.md,
        borderWidth: 1, borderColor: colors.bg.surface
    },

    reputationBadge: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
        backgroundColor: colors.gold.primary + '15',
        paddingHorizontal: spacing.md, paddingVertical: 4,
        borderRadius: radius.full, borderWidth: 1, borderColor: colors.gold.primary + '33'
    },
    reputationTxt: { color: colors.gold.primary, fontWeight: '800', fontSize: 14 },
    reputationLbl: { color: colors.gold.primary, fontSize: 11, fontWeight: '600', textDecorationLine: 'underline' },

    newWorkerBadgeRating: {
        backgroundColor: colors.gold.primary + '22',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.gold.primary + '44',
        marginVertical: spacing.sm,
    },
    newWorkerTxtRating: {
        color: colors.gold.primary,
        fontSize: 12,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },

    footer: { padding: spacing.lg, paddingBottom: spacing.xl * 2, borderTopWidth: 1, borderTopColor: colors.bg.surface }
});
