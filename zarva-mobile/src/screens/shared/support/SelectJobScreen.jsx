import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing } from '../../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../../design-system/typography';
import { useT } from '../../../hooks/useT';
import apiClient from '../../../services/api/client';
import PremiumHeader from '../../../components/PremiumHeader';
import MainBackground from '../../../components/MainBackground';
import PressableAnimated from '../../../design-system/components/PressableAnimated';

export default function SelectJobScreen() {
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
                    <ActivityIndicator size="large" color={colors.accent.primary} />
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

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { flex: 1 },
    prompt: {
        color: colors.text.secondary,
        fontSize: fontSize.body,
        marginHorizontal: spacing[24],
        marginTop: spacing[24],
        marginBottom: spacing[16],
    },
    list: {
        paddingHorizontal: spacing[24],
        paddingBottom: spacing[40],
        gap: spacing[12],
    },

    empty: {
        alignItems: 'center',
        paddingTop: 60,
    },
    emptyIcon: { fontSize: 40, marginBottom: spacing[16] },
    emptyTxt: { color: colors.text.muted, fontSize: fontSize.body, textAlign: 'center' },

    card: {
        backgroundColor: colors.surface,
        padding: spacing[16],
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.accent.border + '22',
        position: 'relative'
    },
    cardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
        paddingRight: 24
    },
    cardTitle: {
        color: colors.text.primary,
        fontSize: fontSize.body,
        fontWeight: fontWeight.bold,
        letterSpacing: 1
    },
    cardStatus: {
        color: colors.accent.primary,
        fontSize: fontSize.micro,
        fontWeight: fontWeight.bold,
        letterSpacing: 1
    },
    cardBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingRight: 24
    },
    cardId: {
        color: colors.text.muted,
        fontSize: fontSize.small
    },
    cardDate: {
        color: colors.text.muted,
        fontSize: fontSize.small
    },
    chevron: {
        position: 'absolute',
        right: 16,
        top: '50%',
        color: colors.accent.primary,
        fontSize: 24,
        fontWeight: '200',
        transform: [{ translateY: -12 }]
    }
});
