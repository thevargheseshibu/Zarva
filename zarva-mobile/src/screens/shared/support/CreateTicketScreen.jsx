import React, { useState } from 'react';
import { useTokens } from '../../../design-system';
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';


import { useT } from '../../../hooks/useT';
import apiClient from '../../../services/api/client';
import PremiumHeader from '../../../components/PremiumHeader';
import MainBackground from '../../../components/MainBackground';
import PremiumButton from '../../../components/PremiumButton';
import FadeInView from '../../../components/FadeInView';

export default function CreateTicketScreen() {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const navigation = useNavigation();
    const route = useRoute();
    const t = useT();

    // `job` is passed if it's a specific job issue. If undefined, it's a general inquiry.
    const job = route.params?.job;
    const isGeneral = !job;

    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!description.trim()) {
            Alert.alert(t('error', { defaultValue: 'Error' }), t('please_describe', { defaultValue: 'Please describe the issue.' }));
            return;
        }

        setLoading(true);
        try {
            const payload = {
                ticket_type: isGeneral ? 'general_chat' : 'job_dispute',
                job_id: job?.id || null,
                initial_message: description.trim()
            };

            const res = await apiClient.post('/api/support/tickets/create', payload);
            if (res.data?.success && res.data.data?.ticket_id) {
                // Navigate straight to chat and replace so back button goes to SupportHome
                navigation.replace('TicketChat', { ticketId: res.data.data.ticket_id });
            } else {
                throw new Error('Invalid response');
            }
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.response?.data?.message || t('failed_to_create_ticket', { defaultValue: 'Failed to create ticket. Please try again later.' });

            // Handle concurrency lockout
            if (err.response?.status === 403 || errorMsg.includes('concurrency') || errorMsg.includes('locked')) {
                Alert.alert(
                    t('action_blocked', { defaultValue: 'Action Blocked' }),
                    errorMsg
                );
            } else {
                Alert.alert(t('error_caps', { defaultValue: 'ERROR' }), errorMsg);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <MainBackground>
            <PremiumHeader
                title={isGeneral ? t('general_support', { defaultValue: 'General Support' }) : t('report_issue', { defaultValue: 'Report Issue' })}
                onBack={() => navigation.goBack()}
            />

            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : null}
            >
                <ScrollView contentContainerStyle={styles.scroll}>
                    <FadeInView delay={100}>
                        {job && (
                            <View style={styles.jobContext}>
                                <Text style={styles.jobLabel}>{t('job_reference', { defaultValue: 'JOB REFERENCE' })}</Text>
                                <Text style={styles.jobText}>
                                    {job.category?.toUpperCase() || 'JOB'} #{job.id}
                                </Text>
                            </View>
                        )}

                        <Text style={styles.prompt}>
                            {isGeneral
                                ? t('how_can_we_help_general', { defaultValue: 'How can we help you today?' })
                                : t('what_is_issue', { defaultValue: 'Please describe the issue with this job.' })
                            }
                        </Text>

                        <TextInput
                            style={styles.inputArea}
                            placeholder={t('describe_here', { defaultValue: 'Type your message here...' })}
                            placeholderTextColor={t.text.tertiary}
                            multiline
                            numberOfLines={6}
                            textAlignVertical="top"
                            value={description}
                            onChangeText={setDescription}
                            editable={!loading}
                            autoFocus
                        />
                    </FadeInView>
                </ScrollView>

                <FadeInView delay={200} style={styles.footer}>
                    <PremiumButton
                        title={loading ? t('submitting', { defaultValue: 'Submitting...' }) : t('create_ticket', { defaultValue: 'Create Ticket' })}
                        onPress={handleSubmit}
                        disabled={loading || description.trim().length === 0}
                    />
                </FadeInView>
            </KeyboardAvoidingView>
        </MainBackground>
    );
}

const createStyles = (t) => StyleSheet.create({
    keyboardView: { flex: 1 },
    scroll: { flexGrow: 1, padding: t.spacing['2xl'] },

    jobContext: {
        backgroundColor: t.background.surface,
        padding: t.spacing.lg,
        borderRadius: t.radius.lg,
        borderWidth: 1,
        borderColor: t.border.default + '22',
        marginBottom: t.spacing['2xl'],
        alignItems: 'center',
    },
    jobLabel: {
        color: t.text.tertiary,
        fontSize: t.typography.size.micro,
        fontWeight: t.typography.weight.bold,
        letterSpacing: 2,
        marginBottom: 4,
    },
    jobText: {
        color: t.brand.primary,
        fontSize: t.typography.size.body,
        fontWeight: t.typography.weight.bold,
        letterSpacing: 1,
    },

    prompt: {
        color: t.text.primary,
        fontSize: t.typography.size.title,
        fontWeight: t.typography.weight.bold,
        marginBottom: t.spacing.lg,
        letterSpacing: t.typography.tracking.title,
    },

    inputArea: {
        backgroundColor: t.background.surface,
        borderRadius: t.radius.xl,
        borderWidth: 1,
        borderColor: t.border.default + '44',
        padding: t.spacing[20],
        color: t.text.primary,
        fontSize: t.typography.size.body,
        lineHeight: 24,
        minHeight: 180,
    },

    footer: {
        padding: t.spacing['2xl'],
        paddingBottom: Platform.OS === 'ios' ? t.spacing[32] : t.spacing['2xl'],
        borderTopWidth: 1,
        borderTopColor: t.border.default + '11',
        backgroundColor: t.background.app,
    }
});
