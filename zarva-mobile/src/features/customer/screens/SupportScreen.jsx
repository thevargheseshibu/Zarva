import React from 'react';
import { useTokens } from '../../../design-system';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';


import { useT } from '../../../hooks/useT';
import MainBackground from '@shared/ui/MainBackground';
import PressableAnimated from '../../../design-system/components/PressableAnimated';
import FadeInView from '@shared/ui/FadeInView';
import PremiumHeader from '@shared/ui/PremiumHeader';

export default function SupportHomeScreen() {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const navigation = useNavigation();
    const t = useT();

    return (
        <MainBackground>
            <PremiumHeader
                title={t('support_disputes', { defaultValue: 'Support & Disputes' })}
                onBack={() => navigation.goBack()}
            />

            <View style={styles.content}>
                <FadeInView delay={100}>
                    <Text style={styles.subtitle}>
                        {t('how_can_we_help', { defaultValue: 'How can we help you today?' })}
                    </Text>
                    <Text style={styles.description}>
                        {t('help_desc', { defaultValue: 'Choose general chat for profile or app-related issues. Choose job issue to raise a dispute regarding a specific job.' })}
                    </Text>
                </FadeInView>

                <FadeInView delay={200} style={styles.optionsContainer}>
                    <PressableAnimated
                        style={styles.optionCard}
                        onPress={() => navigation.navigate('CreateTicket')}
                    >
                        <View style={styles.iconCircle}>
                            <Text style={styles.iconTxt}>💬</Text>
                        </View>
                        <View style={styles.optionTextContainer}>
                            <Text style={styles.optionTitle}>{t('general_support', { defaultValue: 'General Support' })}</Text>
                            <Text style={styles.optionDesc}>{t('general_support_desc', { defaultValue: 'Chat with our admin for general inquiries.' })}</Text>
                        </View>
                        <Text style={styles.chevron}>›</Text>
                    </PressableAnimated>

                    <PressableAnimated
                        style={styles.optionCard}
                        onPress={() => navigation.navigate('SelectJob')}
                    >
                        <View style={styles.iconCircle}>
                            <Text style={styles.iconTxt}>⚠️</Text>
                        </View>
                        <View style={styles.optionTextContainer}>
                            <Text style={styles.optionTitle}>{t('job_issue', { defaultValue: 'Issue with a Job' })}</Text>
                            <Text style={styles.optionDesc}>{t('job_issue_desc', { defaultValue: 'Report a problem or dispute a specific job.' })}</Text>
                        </View>
                        <Text style={styles.chevron}>›</Text>
                    </PressableAnimated>
                </FadeInView>

                <FadeInView delay={300} style={{ marginTop: 24 }}>
                    <PressableAnimated
                        style={[styles.optionCard, styles.historyCard]}
                        onPress={() => navigation.navigate('TicketList')}
                    >
                        <View style={[styles.iconCircle, { backgroundColor: tTheme.background.surface }]}>
                            <Text style={styles.iconTxt}>📋</Text>
                        </View>
                        <View style={styles.optionTextContainer}>
                            <Text style={styles.optionTitle}>{t('my_tickets', { defaultValue: 'My Tickets' })}</Text>
                            <Text style={styles.optionDesc}>{t('my_tickets_desc', { defaultValue: 'View past and ongoing support requests.' })}</Text>
                        </View>
                        <Text style={styles.chevron}>›</Text>
                    </PressableAnimated>
                </FadeInView>
            </View>
        </MainBackground>
    );
}

const createStyles = (t) => StyleSheet.create({
    content: {
        flex: 1,
        padding: t.spacing['2xl'],
        paddingTop: t.spacing[32],
    },
    subtitle: {
        color: t.text.primary,
        fontSize: t.typography.size.title,
        fontWeight: t.typography.weight.bold,
        marginBottom: t.spacing.sm,
        letterSpacing: t.typography.tracking.title,
    },
    description: {
        color: t.text.secondary,
        fontSize: t.typography.size.body,
        lineHeight: 24,
        marginBottom: t.spacing[32],
    },
    optionsContainer: {
        gap: t.spacing.lg,
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: t.background.surface,
        padding: t.spacing[20],
        borderRadius: 20,
        borderWidth: 1,
        borderColor: t.border.default + '22',
    },
    historyCard: {
        backgroundColor: t.background.surfaceRaised,
        borderColor: t.background.surfaceRaised,
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: t.background.surfaceRaised,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: t.spacing.lg,
    },
    iconTxt: {
        fontSize: 24,
    },
    optionTextContainer: {
        flex: 1,
    },
    optionTitle: {
        color: t.text.primary,
        fontSize: t.typography.size.body,
        fontWeight: t.typography.weight.bold,
        marginBottom: 4,
    },
    optionDesc: {
        color: t.text.tertiary,
        fontSize: t.typography.size.small,
        lineHeight: 18,
    },
    chevron: {
        color: t.brand.primary,
        fontSize: 28,
        fontWeight: '200',
        marginLeft: t.spacing.sm,
    }
});
