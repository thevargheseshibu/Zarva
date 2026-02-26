import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing } from '../../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../../design-system/typography';
import { useT } from '../../../hooks/useT';
import apiClient from '../../../services/api/client';
import PremiumHeader from '../../../components/PremiumHeader';
import MainBackground from '../../../components/MainBackground';
import PressableAnimated from '../../../design-system/components/PressableAnimated';

export default function TicketListScreen() {
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
            setTickets(res.data.data || []);
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
        let bg = colors.elevated;
        let c = colors.text.muted;
        const low = (status || '').toLowerCase();

        if (low === 'open') {
            bg = colors.accent.primary + '22';
            c = colors.accent.primary;
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
                    <ActivityIndicator size="large" color={colors.accent.primary} />
                </View>
            </MainBackground>
        );
    }

    return (
        <MainBackground>
            <PremiumHeader title={t('my_tickets', { defaultValue: 'My Tickets' })} onBack={() => navigation.goBack()} />

            <FlatList
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />}
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

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { padding: spacing[24], gap: spacing[16], paddingBottom: spacing[40] },

    empty: {
        alignItems: 'center',
        paddingTop: 80,
    },
    emptyIcon: { fontSize: 40, marginBottom: spacing[16] },
    emptyTxt: { color: colors.text.muted, fontSize: fontSize.body, textAlign: 'center' },

    card: {
        backgroundColor: colors.surface,
        padding: spacing[20],
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.accent.border + '22',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing[12],
    },
    ticketNumber: {
        color: colors.text.primary,
        fontSize: fontSize.body,
        fontWeight: fontWeight.bold,
        letterSpacing: 1,
    },
    badge: {
        paddingHorizontal: spacing[12],
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeTxt: {
        fontSize: fontSize.micro,
        fontWeight: fontWeight.bold,
        letterSpacing: 1,
    },
    cardInfo: { gap: 4 },
    type: {
        color: colors.text.secondary,
        fontSize: fontSize.small,
        fontWeight: fontWeight.medium,
    },
    jobId: {
        color: colors.accent.primary,
        fontSize: fontSize.small,
    },
    date: {
        color: colors.text.muted,
        fontSize: fontSize.small,
        marginTop: 4,
    }
});
