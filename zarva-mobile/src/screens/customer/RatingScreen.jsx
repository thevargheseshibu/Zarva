import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image } from 'react-native';
import { colors, spacing, radius } from '../../design-system/tokens';
import GoldButton from '../../components/GoldButton';
import apiClient from '../../services/api/client';

export default function RatingScreen({ route, navigation }) {
    const { jobId } = route.params || { jobId: 'mock-123' };

    const [rating, setRating] = useState(0);
    const [quality, setQuality] = useState(0);
    const [punctual, setPunctual] = useState(0);
    const [behavior, setBehavior] = useState(0);
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);

    // Mock Worker Data
    const worker = { name: 'Rahul R', photo: 'https://i.pravatar.cc/150?img=11' };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            // await apiClient.post(`/api/reviews`, { jobId, rating, quality, punctual, behavior, comment });
            console.log('Submitted Review', { rating, metrics: { quality, punctual, behavior } });
        } catch (err) {
            // Ignored for dev
        } finally {
            setLoading(false);
            navigation.popToTop(); // Back to Home in CustomerStack
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

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.popToTop()} style={styles.skipBtn}>
                    <Text style={styles.skipTxt}>Skip</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                <View style={styles.profileBox}>
                    <Image source={{ uri: worker.photo }} style={styles.photo} />
                    <Text style={styles.title}>Rate {worker.name}</Text>
                    <Text style={styles.sub}>How was your experience?</Text>
                </View>

                {/* Main Rating */}
                <View style={[styles.section, { alignItems: 'center', marginBottom: spacing.xl }]}>
                    <StarRow value={rating} onChange={setRating} size={48} />
                </View>

                {/* Sub Metrics */}
                {rating > 0 && (
                    <View style={styles.metricsBox}>
                        <View style={styles.metricRow}>
                            <Text style={styles.metricLabel}>Work Quality</Text>
                            <StarRow value={quality} onChange={setQuality} size={28} />
                        </View>
                        <View style={styles.metricRow}>
                            <Text style={styles.metricLabel}>Punctuality</Text>
                            <StarRow value={punctual} onChange={setPunctual} size={28} />
                        </View>
                        <View style={styles.metricRow}>
                            <Text style={styles.metricLabel}>Behavior</Text>
                            <StarRow value={behavior} onChange={setBehavior} size={28} />
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

    footer: { padding: spacing.lg, paddingBottom: spacing.xl * 2, borderTopWidth: 1, borderTopColor: colors.bg.surface }
});
