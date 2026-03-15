import React, { useState, useEffect } from 'react';
import { useTokens } from '../../../design-system';
import { View, Text, StyleSheet, SectionList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import { useT } from '../../../hooks/useT';
import apiClient from '@infra/api/client';
import PremiumHeader from '../../@shared/ui/PremiumHeader';
import MainBackground from '../../@shared/ui/MainBackground';
import FadeInView from '../../@shared/ui/FadeInView';

const STATUS_COLORS = {
    assigned: '#3B82F6',
    worker_en_route: '#8B5CF6',
    in_progress: '#10B981',
    completed: '#6B7280',
    cancelled: '#EF4444',
    disputed: '#F59E0B',
    default: '#6B7280',
};

function JobCard({ job, onPress }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const statusColor = STATUS_COLORS[job.status] || STATUS_COLORS.default;
    const date = job.created_at ? new Date(job.created_at).toLocaleDateString() : '';

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
            <View style={styles.cardLeft}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <View>
                    <Text style={styles.cardCategory}>{job.category?.toUpperCase() || 'SERVICE'}</Text>
                    <Text style={styles.cardDate}>{date}</Text>
                    {job.customer_address ? (
                        <Text style={styles.cardAddr} numberOfLines={1}>{job.customer_address}</Text>
                    ) : null}
                </View>
            </View>
            <View style={styles.cardRight}>
                <Text style={[styles.statusBadge, { color: statusColor }]}>
                    {job.status?.replace(/_/g, ' ').toUpperCase()}
                </Text>
                <Text style={styles.chevron}>›</Text>
            </View>
        </TouchableOpacity>
    );
}

export default function SelectJobScreen() {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const navigation = useNavigation();
    const t = useT();

    const [sections, setSections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchJobs = async () => {
            try {
                const res = await apiClient.get('/api/support/eligible-jobs');
                const current = res.data?.current || [];
                const history = res.data?.history || [];

                const newSections = [];
                if (current.length > 0) newSections.push({ title: 'Current Jobs', data: current });
                if (history.length > 0) newSections.push({ title: 'Past Jobs', data: history });
                setSections(newSections);
            } catch (err) {
                setError('Failed to load jobs. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        fetchJobs();
    }, []);

    const handleSelectJob = (job) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate('CreateTicket', { job });
    };

    if (loading) {
        return (
            <MainBackground>
                <PremiumHeader title="Select a Job" onBack={() => navigation.goBack()} />
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={tTheme.brand.primary} />
                </View>
            </MainBackground>
        );
    }

    return (
        <MainBackground>
            <PremiumHeader title="Select a Job" onBack={() => navigation.goBack()} />

            {error ? (
                <View style={styles.center}>
                    <Text style={styles.errorTxt}>{error}</Text>
                </View>
            ) : sections.length === 0 ? (
                <FadeInView style={styles.empty}>
                    <Text style={styles.emptyIcon}>📋</Text>
                    <Text style={styles.emptyTitle}>No Jobs Found</Text>
                    <Text style={styles.emptyDesc}>You don't have any job history yet. For general inquiries, use General Support.</Text>
                    <TouchableOpacity
                        style={styles.generalBtn}
                        onPress={() => navigation.navigate('CreateTicket', { ticket_type: 'general_chat' })}
                    >
                        <Text style={styles.generalBtnTxt}>Go to General Support →</Text>
                    </TouchableOpacity>
                </FadeInView>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    renderSectionHeader={({ section: { title } }) => (
                        <Text style={styles.sectionHeader}>{title.toUpperCase()}</Text>
                    )}
                    renderItem={({ item }) => (
                        <JobCard job={item} onPress={() => handleSelectJob(item)} />
                    )}
                />
            )}
        </MainBackground>
    );
}

const createStyles = (t) => StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorTxt: { color: t.status?.error?.base || '#EF4444', fontSize: 14 },

    list: { padding: t.spacing['2xl'], paddingBottom: 60, gap: t.spacing.md },
    sectionHeader: {
        color: t.text.tertiary,
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 2,
        marginTop: t.spacing.lg,
        marginBottom: t.spacing.sm,
        marginLeft: 4,
    },

    card: {
        backgroundColor: t.background.surface,
        borderRadius: t.radius.xl,
        padding: t.spacing.lg,
        borderWidth: 1,
        borderColor: t.border.default + '22',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...t.shadows?.small,
    },
    cardLeft: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, flex: 1 },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    cardCategory: {
        color: t.text.primary,
        fontSize: t.typography.size.body,
        fontWeight: t.typography.weight.bold,
        letterSpacing: 0.5,
    },
    cardDate: { color: t.text.tertiary, fontSize: 11, marginTop: 2 },
    cardAddr: { color: t.text.secondary, fontSize: 11, marginTop: 2, maxWidth: 200 },

    cardRight: { alignItems: 'flex-end', gap: 4 },
    statusBadge: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
    chevron: { color: t.brand.primary, fontSize: 24, fontWeight: '200' },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.spacing['2xl'] },
    emptyIcon: { fontSize: 48, marginBottom: t.spacing.lg },
    emptyTitle: { color: t.text.primary, fontSize: 20, fontWeight: '900', marginBottom: 8 },
    emptyDesc: { color: t.text.secondary, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: t.spacing['2xl'] },
    generalBtn: {
        paddingVertical: 14,
        paddingHorizontal: t.spacing['2xl'],
        borderRadius: t.radius.full,
        borderWidth: 1.5,
        borderColor: t.brand.primary,
    },
    generalBtnTxt: { color: t.brand.primary, fontWeight: '800', fontSize: 14 },
});
