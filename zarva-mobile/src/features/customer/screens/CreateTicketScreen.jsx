import React, { useState, useEffect } from 'react';
import { useTokens } from '@shared/design-system';
import {
    View, Text, StyleSheet, TextInput, KeyboardAvoidingView,
    Platform, ScrollView, Alert, ActivityIndicator, TouchableOpacity
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import { useT } from '@shared/i18n/useTranslation';
import { useAuthStore } from '@auth/store';
import apiClient from '@infra/api/client';
import PremiumHeader from '@shared/ui/PremiumHeader';
import MainBackground from '@shared/ui/MainBackground';
import PremiumButton from '@shared/ui/PremiumButton';
import FadeInView from '@shared/ui/FadeInView';

export default function CreateTicketScreen() {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const navigation = useNavigation();
    const route = useRoute();
    const t = useT();
    const { user } = useAuthStore();

    // `job` param: passed when user picked a specific job from SelectJobScreen
    // `forced_type`: 'general_chat' passed from SupportHomeScreen directly
    const job = route.params?.job || null;
    const forcedType = route.params?.ticket_type || null;

    const isGeneral = !job;

    const [ticketType, setTicketType] = useState(forcedType || (isGeneral ? 'general_chat' : null));
    const [category, setCategory] = useState(null);
    const [categories, setCategories] = useState([]);
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingCats, setLoadingCats] = useState(false);

    // Fetch dispute categories for the user's role
    useEffect(() => {
        if (!isGeneral) {
            setLoadingCats(true);
            const role = user?.active_role || user?.role || 'customer';
            apiClient.get(`/api/support/categories?role=${role}`)
                .then(res => {
                    if (res.data?.categories) setCategories(res.data.categories);
                })
                .catch(() => {})
                .finally(() => setLoadingCats(false));
        }
    }, [isGeneral]);

    const handleSubmit = async () => {
        if (!description.trim()) {
            Alert.alert('Missing Info', 'Please describe the issue.');
            return;
        }
        if (!ticketType) {
            Alert.alert('Select Type', 'Please select what kind of ticket this is.');
            return;
        }
        if (ticketType === 'job_dispute' && !category) {
            Alert.alert('Select Category', 'Please select a dispute category.');
            return;
        }

        setLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const payload = {
                ticket_type: ticketType,
                job_id: job?.id || null,
                category: category || null,
                description: description.trim()
            };

            const res = await apiClient.post('/api/support/tickets/create', payload);
            if (res.data?.ticket_id) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                navigation.replace('TicketChat', { ticketId: res.data.ticket_id });
            } else {
                throw new Error('Unexpected server response');
            }
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to create ticket. Please try again.';
            const status = err.response?.status;
            if (status === 409 || msg.includes('already have') || msg.includes('locked')) {
                Alert.alert('Action Blocked', msg);
            } else {
                Alert.alert('Error', msg);
            }
        } finally {
            setLoading(false);
        }
    };

    const isDisputeMode = ticketType === 'job_dispute';
    const canSubmit = description.trim().length > 0 && !!ticketType && (!isDisputeMode || !!category);

    return (
        <MainBackground>
            <PremiumHeader
                title={isGeneral ? 'General Support' : 'Report Issue'}
                onBack={() => navigation.goBack()}
            />

            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : null}
            >
                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

                    {/* Job Context Card */}
                    {job && (
                        <FadeInView delay={50}>
                            <View style={styles.jobContextCard}>
                                <Text style={styles.jobContextLabel}>JOB REFERENCE</Text>
                                <Text style={styles.jobContextCategory}>{job.category?.toUpperCase() || 'SERVICE'}</Text>
                                <Text style={styles.jobContextStatus}>Status: {job.status?.replace(/_/g, ' ')}</Text>
                            </View>
                        </FadeInView>
                    )}

                    {/* Ticket Type Selector (only for job tickets) */}
                    {!isGeneral && !forcedType && (
                        <FadeInView delay={100}>
                            <Text style={styles.sectionLabel}>What would you like to do?</Text>
                            <View style={styles.typeRow}>
                                <TouchableOpacity
                                    style={[styles.typeCard, ticketType === 'job_query' && styles.typeCardActive]}
                                    onPress={() => { setTicketType('job_query'); setCategory(null); }}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.typeIcon}>💬</Text>
                                    <Text style={[styles.typeTitle, ticketType === 'job_query' && styles.typeTitleActive]}>Ask a Question</Text>
                                    <Text style={styles.typeSub}>Clarification, not a dispute</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.typeCard, ticketType === 'job_dispute' && styles.typeCardActive, ticketType === 'job_dispute' && styles.typeCardDispute]}
                                    onPress={() => setTicketType('job_dispute')}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.typeIcon}>⚠️</Text>
                                    <Text style={[styles.typeTitle, ticketType === 'job_dispute' && styles.typeTitleActive]}>Raise Dispute</Text>
                                    <Text style={styles.typeSub}>Formal complaint — admin mediates</Text>
                                </TouchableOpacity>
                            </View>
                        </FadeInView>
                    )}

                    {/* Category Picker (only for formal disputes) */}
                    {isDisputeMode && (
                        <FadeInView delay={150}>
                            <Text style={styles.sectionLabel}>Dispute Category</Text>
                            {loadingCats ? (
                                <ActivityIndicator color={tTheme.brand.primary} />
                            ) : (
                                <View style={styles.categoriesGrid}>
                                    {categories.map(cat => (
                                        <TouchableOpacity
                                            key={cat.category_key}
                                            style={[styles.catChip, category === cat.category_key && styles.catChipActive]}
                                            onPress={() => setCategory(cat.category_key)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={[styles.catChipTxt, category === cat.category_key && styles.catChipTxtActive]}>
                                                {cat.category_name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </FadeInView>
                    )}

                    {/* Description Input */}
                    <FadeInView delay={200}>
                        <Text style={styles.sectionLabel}>
                            {isGeneral ? 'How can we help you?' : 'Describe the issue in detail'}
                        </Text>
                        <TextInput
                            style={styles.inputArea}
                            placeholder="Type your message here..."
                            placeholderTextColor={tTheme.text.tertiary}
                            multiline
                            numberOfLines={6}
                            textAlignVertical="top"
                            value={description}
                            onChangeText={setDescription}
                            editable={!loading}
                            autoFocus={isGeneral}
                        />
                    </FadeInView>
                </ScrollView>

                <FadeInView delay={250} style={styles.footer}>
                    <PremiumButton
                        title={loading ? 'Submitting...' : isGeneral ? 'Start Chat' : isDisputeMode ? 'Submit Dispute' : 'Submit Query'}
                        onPress={handleSubmit}
                        disabled={loading || !canSubmit}
                        loading={loading}
                    />
                </FadeInView>
            </KeyboardAvoidingView>
        </MainBackground>
    );
}

const createStyles = (t) => StyleSheet.create({
    keyboardView: { flex: 1 },
    scroll: { flexGrow: 1, padding: t.spacing['2xl'], gap: t.spacing['2xl'] },

    jobContextCard: {
        backgroundColor: t.background.surface,
        padding: t.spacing.lg,
        borderRadius: t.radius.xl,
        borderWidth: 1,
        borderColor: t.brand.primary + '33',
        alignItems: 'center',
    },
    jobContextLabel: {
        color: t.text.tertiary,
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 2,
        marginBottom: 4,
    },
    jobContextCategory: {
        color: t.brand.primary,
        fontSize: t.typography.size.cardTitle,
        fontWeight: '900',
        letterSpacing: 1,
    },
    jobContextStatus: {
        color: t.text.secondary,
        fontSize: 12,
        marginTop: 4,
        textTransform: 'capitalize',
    },

    sectionLabel: {
        color: t.text.secondary,
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 1.5,
        marginBottom: t.spacing.md,
    },

    typeRow: { flexDirection: 'row', gap: t.spacing.md },
    typeCard: {
        flex: 1,
        backgroundColor: t.background.surface,
        borderRadius: t.radius.xl,
        padding: t.spacing.lg,
        borderWidth: 1.5,
        borderColor: t.border.default + '22',
        gap: 4,
        ...t.shadows.small,
    },
    typeCardActive: { borderColor: t.brand.primary },
    typeCardDispute: { borderColor: '#FF5252' },
    typeIcon: { fontSize: 24, marginBottom: 4 },
    typeTitle: { color: t.text.secondary, fontSize: 13, fontWeight: '800' },
    typeTitleActive: { color: t.text.primary },
    typeSub: { color: t.text.tertiary, fontSize: 10, lineHeight: 14 },

    categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
    catChip: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: t.radius.full,
        backgroundColor: t.background.surface,
        borderWidth: 1,
        borderColor: t.border.default + '33',
    },
    catChipActive: { backgroundColor: t.brand.primary + '18', borderColor: t.brand.primary },
    catChipTxt: { color: t.text.secondary, fontSize: 12, fontWeight: '700' },
    catChipTxtActive: { color: t.brand.primary },

    inputArea: {
        backgroundColor: t.background.surface,
        borderRadius: t.radius.xl,
        borderWidth: 1,
        borderColor: t.border.default + '44',
        padding: t.spacing[20],
        color: t.text.primary,
        fontSize: t.typography.size.body,
        lineHeight: 24,
        minHeight: 160,
    },

    footer: {
        padding: t.spacing['2xl'],
        paddingBottom: Platform.OS === 'ios' ? t.spacing[32] : t.spacing['2xl'],
        borderTopWidth: 1,
        borderTopColor: t.border.default + '11',
        backgroundColor: t.background.app,
    },
});
