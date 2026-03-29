import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTokens } from '@shared/design-system';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';


import { useT } from '@shared/i18n/useTranslation';
import apiClient from '@infra/api/client';
import PremiumHeader from '@shared/ui/PremiumHeader';
import MainBackground from '@shared/ui/MainBackground';
import PressableAnimated from '@shared/design-system/components/PressableAnimated';

export default function TicketListScreen() {
    const tTheme = useTokens();
    const styles = useMemo(() => createStyles(tTheme), [tTheme]);
    const navigation = useNavigation();
    const t = useT();

    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const loadTickets = async () => {
        try {
            setError(null);
            const res = await apiClient.get('/api/support/tickets');
            setTickets(res.data?.tickets || []);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load tickets');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadTickets();
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadTickets();
    }, []);

    const parseDate = (d) => {
        if (!d) return '';
        const dt = new Date(d);
        return dt.toLocaleDateString() + ' ' + dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const StatusBadge = ({ status }) => {
        let bg = t.background.surfaceRaised;
        let c = t.text.tertiary;
        const low = (status || '').toLowerCase();

        if (low === 'open') {
            bg = t.brand.primary + '22';
            c = t.brand.primary;
        } else if (low === 'resolved' || low === 'closed') {
            bg = '#4CAF5022';
            c = '#4CAF50';
        }

        return (
            <View style={[styles.badge, { backgroundColor: bg }]}>
                <Text style={[styles.badgeTxt, { color: c }]}>{String(status).toUpperCase()}</Text>
            </View>
        );
    };

    if (loading && !refreshing) {
        return (
            <MainBackground>
                <PremiumHeader title={t('my_tickets', { defaultValue: 'My Tickets' })} onBack={() => navigation.goBack()} />
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={t.brand.primary} />
                </View>
            </MainBackground>
        );
    }

    return (
        <MainBackground>
            <PremiumHeader title={t('my_tickets', { defaultValue: 'My Tickets' })} onBack={() => navigation.goBack()} />

            <FlatList
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.brand.primary} />}
                data={tickets}
                keyExtractor={item => item.id}
                ListEmptyComponent={() => (
                    <View style={styles.empty}>
                        <Text style={styles.emptyIcon}>📪</Text>
                        <Text style={styles.emptyTxt}>{t('no_tickets_found', { defaultValue: 'No active or past tickets found.' })}</Text>
                    </View>
                )}
                renderItem={({ item }) => (
                    <PressableAnimated
                        style={styles.card}
                        onPress={() => navigation.navigate('TicketChat', { ticketId: item.id })}
                    >
                        <View style={styles.cardHeader}>
                            <Text style={styles.ticketNumber}>{item.ticket_number}</Text>
                            <StatusBadge status={item.status} />
                        </View>

                        <View style={styles.cardInfo}>
                            <Text style={styles.type}>
                                {item.ticket_type === 'general_chat' ? 'General Inquiry' : 'Job Dispute'}
                            </Text>
                            {item.job_id && <Text style={styles.jobId}>Job: {item.job_id}</Text>}
                            <Text style={styles.date}>{parseDate(item.created_at)}</Text>
                        </View>
                    </PressableAnimated>
                )}
            />
        </MainBackground>
    );
}

const createStyles = (t) => StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { padding: t.spacing['2xl'], gap: t.spacing.lg, paddingBottom: t.spacing[40] },

    empty: {
        alignItems: 'center',
        paddingTop: 80,
    },
    emptyIcon: { fontSize: 40, marginBottom: t.spacing.lg },
    emptyTxt: { color: t.text.tertiary, fontSize: t.typography.size.body, textAlign: 'center' },

    card: {
        backgroundColor: t.background.surface,
        padding: t.spacing[20],
        borderRadius: 16,
        borderWidth: 1,
        borderColor: t.border.default + '22',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: t.spacing.md,
    },
    ticketNumber: {
        color: t.text.primary,
        fontSize: t.typography.size.body,
        fontWeight: t.typography.weight.bold,
        letterSpacing: 1,
    },
    badge: {
        paddingHorizontal: t.spacing.md,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeTxt: {
        fontSize: t.typography.size.micro,
        fontWeight: t.typography.weight.bold,
        letterSpacing: 1,
    },
    cardInfo: { gap: 4 },
    type: {
        color: t.text.secondary,
        fontSize: t.typography.size.small,
        fontWeight: t.typography.weight.medium,
    },
    jobId: {
        color: t.brand.primary,
        fontSize: t.typography.size.small,
    },
    date: {
        color: t.text.tertiary,
        fontSize: t.typography.size.small,
        marginTop: 4,
    }
});
