import React, { useState, useEffect } from 'react';
import { useTokens } from '../../../design-system';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';


import { useT } from '../../../hooks/useT';
import apiClient from '../../../services/api/client';
import PremiumHeader from '../../../components/PremiumHeader';
import MainBackground from '../../../components/MainBackground';
import PressableAnimated from '../../../design-system/components/PressableAnimated';

export default function SelectJobScreen() {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const navigation = useNavigation();
    const t = useT();

    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchJobs = async () => {
            try {
                // Fetch user's job history
                const res = await apiClient.get('/api/jobs');
                setJobs(res.data.data || []);
            } catch (err) {
                setError(t('failed_to_load_jobs', { defaultValue: 'Failed to load jobs.' }));
            } finally {
                setLoading(false);
            }
        };
        fetchJobs();
    }, []);

    const parseShortDate = (d) => {
        if (!d) return '';
        const dt = new Date(d);
        return dt.toLocaleDateString();
    };

    if (loading) {
        return (
            <MainBackground>
                <PremiumHeader title={t('select_job', { defaultValue: 'Select a Job' })} onBack={() => navigation.goBack()} />
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={t.brand.primary} />
                </View>
            </MainBackground>
        );
    }

    return (
        <MainBackground>
            <PremiumHeader title={t('select_job', { defaultValue: 'Select a Job' })} onBack={() => navigation.goBack()} />

            <View style={styles.content}>
                <Text style={styles.prompt}>
                    {t('which_job_issue', { defaultValue: 'Which job did you experience an issue with?' })}
                </Text>

                <FlatList
                    data={jobs}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={() => (
                        <View style={styles.empty}>
                            <Text style={styles.emptyIcon}>📋</Text>
                            <Text style={styles.emptyTxt}>{t('no_job_history', { defaultValue: 'You have no job history.' })}</Text>

                            <PressableAnimated
                                style={[styles.card, { marginTop: 24, padding: 16 }]}
                                onPress={() => navigation.replace('CreateTicket')}
                            >
                                <Text style={[styles.cardTitle, { textAlign: 'center' }]}>
                                    {t('go_to_general_chat', { defaultValue: 'Go to General Chat instead' })}
                                </Text>
                            </PressableAnimated>
                        </View>
                    )}
                    renderItem={({ item }) => (
                        <PressableAnimated
                            style={styles.card}
                            onPress={() => navigation.navigate('CreateTicket', { job: item })}
                        >
                            <View style={styles.cardTop}>
                                <Text style={styles.cardTitle}>{item.category?.toUpperCase() || 'JOB'}</Text>
                                <Text style={styles.cardStatus}>{item.status?.toUpperCase()}</Text>
                            </View>
                            <View style={styles.cardBottom}>
                                <Text style={styles.cardId}>ID: {item.id}</Text>
                                <Text style={styles.cardDate}>{parseShortDate(item.created_at)}</Text>
                            </View>
                            <Text style={styles.chevron}>›</Text>
                        </PressableAnimated>
                    )}
                />
            </View>
        </MainBackground>
    );
}

const createStyles = (t) => StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { flex: 1 },
    prompt: {
        color: t.text.secondary,
        fontSize: t.typography.size.body,
        marginHorizontal: t.spacing['2xl'],
        marginTop: t.spacing['2xl'],
        marginBottom: t.spacing.lg,
    },
    list: {
        paddingHorizontal: t.spacing['2xl'],
        paddingBottom: t.spacing[40],
        gap: t.spacing.md,
    },

    empty: {
        alignItems: 'center',
        paddingTop: 60,
    },
    emptyIcon: { fontSize: 40, marginBottom: t.spacing.lg },
    emptyTxt: { color: t.text.tertiary, fontSize: t.typography.size.body, textAlign: 'center' },

    card: {
        backgroundColor: t.background.surface,
        padding: t.spacing.lg,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: t.border.default + '22',
        position: 'relative'
    },
    cardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
        paddingRight: 24
    },
    cardTitle: {
        color: t.text.primary,
        fontSize: t.typography.size.body,
        fontWeight: t.typography.weight.bold,
        letterSpacing: 1
    },
    cardStatus: {
        color: t.brand.primary,
        fontSize: t.typography.size.micro,
        fontWeight: t.typography.weight.bold,
        letterSpacing: 1
    },
    cardBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingRight: 24
    },
    cardId: {
        color: t.text.tertiary,
        fontSize: t.typography.size.small
    },
    cardDate: {
        color: t.text.tertiary,
        fontSize: t.typography.size.small
    },
    chevron: {
        position: 'absolute',
        right: 16,
        top: '50%',
        color: t.brand.primary,
        fontSize: 24,
        fontWeight: '200',
        transform: [{ translateY: -12 }]
    }
});
