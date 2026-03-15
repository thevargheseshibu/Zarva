import React, { useState, useEffect, useCallback } from 'react';
import { useTokens } from '../../design-system';
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import { useT } from '../../hooks/useT';
import apiClient from '@infra/api/client';
import FadeInView from '../../components/FadeInView';
import StatusPill from '../../components/StatusPill';
import Card from '../../components/Card';
import PressableAnimated from '../../design-system/components/PressableAnimated';
import SkeletonCard from '../../design-system/components/SkeletonCard';
import PremiumButton from '../../components/PremiumButton';
import { useWorkerStore } from '@worker/store';

export default function MyCustomRequestsScreen({ navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { locationOverride } = useWorkerStore();

    const fetchTemplates = async () => {
        try {
            const res = await apiClient.get('/api/custom-jobs/templates');
            setTemplates(res.data || []);
        } catch (err) {
            console.warn('Failed to fetch templates:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchTemplates(); }, []));

    const onRefresh = () => {
        setRefreshing(true);
        fetchTemplates();
    };

    const handlePostJob = async (templateId) => {
        // Mock putting a job live
        try {
            let locData = { latitude: 0, longitude: 0, address: "Default Address" }; // Fallback
            if (locationOverride) {
                locData = { latitude: locationOverride.lat, longitude: locationOverride.lng, address: "Mock Override Address" }
            }
            await apiClient.post(`/api/custom-jobs/templates/${templateId}/post`, { location: locData });
            Alert.alert("Success", "Custom Job Posted Successfully!");
            fetchTemplates();
        } catch (err) {
            Alert.alert("Error", err.response?.data?.error || "Failed to post job");
        }
    };

    const renderTemplate = ({ item, index }) => {
        const canPost = item.status === 'approved';

        return (
            <FadeInView delay={index * 60}>
                <Card style={styles.card}>
                    <View style={styles.cardTop}>
                        <View style={styles.jobTypeBox}>
                            <Text style={styles.jobTypeTxt}>C</Text>
                        </View>
                        <View style={styles.jobInfo}>
                            <Text style={styles.jobTitle}>{item.title || 'Custom Request'}</Text>
                            <Text style={styles.jobDate}>{dayjs(item.created_at).format('MMM D, h:mm A')}</Text>
                        </View>
                        <StatusPill status={item.status || 'pending'} />
                    </View>

                    <Text style={styles.jobDesc} numberOfLines={2}>"{item.description}"</Text>

                    {item.status === 'approved' && item.hourly_rate && (
                        <View style={styles.metaRow}>
                            <Text style={styles.metaLabel}>Approved Rate:</Text>
                            <Text style={styles.metaVal}>₹{item.hourly_rate}/hr</Text>
                        </View>
                    )}

                    {canPost && (
                        <View style={styles.cardFooter}>
                            <PremiumButton
                                title="Post Live"
                                onPress={() => handlePostJob(item.id)}
                            />
                        </View>
                    )}
                </Card>
            </FadeInView>
        );
    };

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <PressableAnimated onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backTxt}>←</Text>
                </PressableAnimated>
                <Text style={styles.title}>My Custom Requests</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.listContent}>
                    {[1, 2, 3].map(i => (
                        <SkeletonCard key={i} height={160} style={{ marginBottom: tTheme.spacing.lg }} />
                    ))}
                </View>
            ) : (
                <FlatList
                    data={templates}
                    renderItem={renderTemplate}
                    keyExtractor={i => String(i.id)}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tTheme.brand.primary} />
                    }
                    ListEmptyComponent={() => (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyIcon}>📋</Text>
                            <Text style={styles.emptyTitle}>No Custom Requests</Text>
                            <Text style={styles.emptySub}>You haven't created any custom requests yet.</Text>
                        </View>
                    )}
                />
            )}
        </View>
    );
}

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.app },
    header: { paddingTop: 60, paddingHorizontal: t.spacing['2xl'], flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: t.spacing['2xl'] },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.background.surface, justifyContent: 'center', alignItems: 'center' },
    backTxt: { color: t.text.primary, fontSize: 18 },
    title: { color: t.text.primary, fontSize: t.typography.size.title, fontWeight: t.typography.weight.bold, letterSpacing: t.typography.tracking.title },

    listContent: { paddingHorizontal: t.spacing['2xl'], paddingBottom: 120 },
    card: { padding: t.spacing['2xl'], marginBottom: t.spacing.lg, backgroundColor: t.background.surface, borderWidth: 1, borderColor: t.border.default + '11', gap: t.spacing.md },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    jobTypeBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.status.warning.base + '22', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: t.status.warning.base + '44' },
    jobTypeTxt: { color: t.status.warning.dark, fontSize: 16, fontWeight: '900' },
    jobInfo: { flex: 1, gap: 2 },
    jobTitle: { color: t.text.primary, fontSize: t.typography.size.body, fontWeight: t.typography.weight.bold },
    jobDate: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.medium },

    jobDesc: { color: t.text.secondary, fontSize: t.typography.size.caption, lineHeight: 20, fontStyle: 'italic', marginTop: 4 },

    metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, padding: 12, backgroundColor: t.background.surfaceRaised, borderRadius: t.radius.md },
    metaLabel: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1 },
    metaVal: { color: t.text.primary, fontSize: 12, fontWeight: '900' },

    cardFooter: { marginTop: t.spacing.sm, paddingTop: t.spacing.sm, borderTopWidth: 1, borderTopColor: t.background.surfaceRaised },

    emptyState: { alignItems: 'center', paddingTop: 100, gap: 12 },
    emptyIcon: { fontSize: 48, marginBottom: 8 },
    emptyTitle: { color: t.text.primary, fontSize: t.typography.size.title, fontWeight: t.typography.weight.bold },
    emptySub: { color: t.text.tertiary, fontSize: t.typography.size.caption, textAlign: 'center' },
});
