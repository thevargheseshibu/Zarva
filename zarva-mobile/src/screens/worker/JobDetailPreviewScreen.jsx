import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { colors, spacing, radius } from '../../design-system/tokens';
import GoldButton from '../../components/GoldButton';
import apiClient from '../../services/api/client';
import { parseJobDescription } from '../../utils/jobParser';

export default function JobDetailPreviewScreen({ route, navigation }) {
    const { job } = route.params || {};

    // Mock full data since AvailableJobs only sends snippet
    const { text: parsedDesc, photo: parsedPhoto } = parseJobDescription(job?.desc);

    const fullJob = {
        id: job?.id || 'job-999',
        category: job?.category || 'Plumber',
        est: job?.est || '₹800 - ₹1200',
        dist: job?.dist || '3.4',
        desc: parsedDesc || 'Pipe broken under the kitchen sink. Water leaking fast and flooding the area.',
        photo: parsedPhoto || null,
        area: 'Kakkanad',
        notes: 'Please bring your own mop if possible.'
    };

    const [loading, setLoading] = useState(false);

    const handleAccept = async () => {
        setLoading(true);
        try {
            // Normally: await apiClient.post(`/api/worker/jobs/${fullJob.id}/accept`);
            setTimeout(() => {
                setLoading(false);
                Alert.alert('Job Accepted!', 'You are now assigned to this job.', [
                    { text: 'View Job', onPress: () => navigation.replace('ActiveJob', { jobId: fullJob.id }) }
                ]);
            }, 600);
        } catch (error) {
            setLoading(false);
            if (error.response?.status === 409) {
                Alert.alert('Too slow!', 'This job was already taken by another worker.');
                navigation.goBack();
            } else {
                Alert.alert('Error', 'Failed to accept job.');
            }
        }
    };

    return (
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backTxt}>←</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Job Details</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                <View style={styles.topCard}>
                    <Text style={styles.category}>{fullJob.category}</Text>
                    <Text style={styles.est}>{fullJob.est}</Text>
                </View>

                <View style={styles.infoBlock}>
                    <Text style={styles.label}>Location</Text>
                    <Text style={styles.valTxt}>📍 {fullJob.area} ({fullJob.dist} km away)</Text>
                    <Text style={styles.subTxt}>Exact address revealed after acceptance.</Text>
                </View>

                <View style={styles.infoBlock}>
                    <Text style={styles.label}>Description</Text>
                    <Text style={styles.valTxt}>"{fullJob.desc}"</Text>
                </View>

                {fullJob.notes && (
                    <View style={styles.infoBlock}>
                        <Text style={styles.label}>Special Notes</Text>
                        <Text style={styles.valTxt}>{fullJob.notes}</Text>
                    </View>
                )}

                {fullJob.photo && (
                    <View style={styles.infoBlock}>
                        <Text style={styles.label}>Customer Photo</Text>
                        <Image source={{ uri: fullJob.photo }} style={styles.photo} />
                    </View>
                )}

            </ScrollView>

            {/* Action Bottom Bar */}
            <View style={styles.actionBlock}>
                <TouchableOpacity
                    style={styles.ghostBtn}
                    onPress={() => navigation.goBack()}
                    disabled={loading}
                >
                    <Text style={styles.ghostTxt}>❌ Not Interested</Text>
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                    <GoldButton
                        title={loading ? "Accepting..." : "✅ Accept Job"}
                        onPress={handleAccept}
                        disabled={loading}
                    />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: spacing.xl + 20, paddingHorizontal: spacing.sm, paddingBottom: spacing.lg,
        borderBottomWidth: 1, borderBottomColor: colors.bg.surface
    },
    backBtn: { padding: spacing.sm },
    backTxt: { color: colors.text.primary, fontSize: 24 },
    title: { color: colors.text.primary, fontSize: 18, fontWeight: '700' },

    content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: 120 },

    topCard: { backgroundColor: colors.bg.surface, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center' },
    category: { color: colors.text.secondary, fontSize: 16, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
    est: { color: colors.gold.primary, fontSize: 36, fontWeight: '800', marginTop: spacing.xs, fontFamily: 'Courier' },

    infoBlock: { gap: spacing.xs },
    label: { color: colors.text.secondary, fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    valTxt: { color: colors.text.primary, fontSize: 16, lineHeight: 24 },
    subTxt: { color: colors.text.muted, fontSize: 13, fontStyle: 'italic', marginTop: 2 },

    photo: { width: '100%', height: 200, borderRadius: radius.md, marginTop: spacing.sm, backgroundColor: colors.bg.elevated },

    actionBlock: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: colors.bg.elevated, borderTopWidth: 1, borderTopColor: colors.bg.surface,
        flexDirection: 'row', padding: spacing.lg, paddingBottom: spacing.xl + 10, gap: spacing.md,
        alignItems: 'center'
    },
    ghostBtn: { flex: 1, alignItems: 'center', padding: spacing.md },
    ghostTxt: { color: colors.text.muted, fontSize: 15, fontWeight: '700' },
});
