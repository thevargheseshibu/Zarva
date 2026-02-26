import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing } from '../../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../../design-system/typography';
import { useT } from '../../../hooks/useT';
import MainBackground from '../../../components/MainBackground';
import PressableAnimated from '../../../design-system/components/PressableAnimated';
import FadeInView from '../../../components/FadeInView';
import PremiumHeader from '../../../components/PremiumHeader';

export default function SupportHomeScreen() {
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
                        <View style={[styles.iconCircle, { backgroundColor: colors.surface }]}>
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

const styles = StyleSheet.create({
    content: {
        flex: 1,
        padding: spacing[24],
        paddingTop: spacing[32],
    },
    subtitle: {
        color: colors.text.primary,
        fontSize: fontSize.title,
        fontWeight: fontWeight.bold,
        marginBottom: spacing[8],
        letterSpacing: tracking.title,
    },
    description: {
        color: colors.text.secondary,
        fontSize: fontSize.body,
        lineHeight: 24,
        marginBottom: spacing[32],
    },
    optionsContainer: {
        gap: spacing[16],
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: spacing[20],
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.accent.border + '22',
    },
    historyCard: {
        backgroundColor: colors.elevated,
        borderColor: colors.elevated,
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.elevated,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing[16],
    },
    iconTxt: {
        fontSize: 24,
    },
    optionTextContainer: {
        flex: 1,
    },
    optionTitle: {
        color: colors.text.primary,
        fontSize: fontSize.body,
        fontWeight: fontWeight.bold,
        marginBottom: 4,
    },
    optionDesc: {
        color: colors.text.muted,
        fontSize: fontSize.small,
        lineHeight: 18,
    },
    chevron: {
        color: colors.accent.primary,
        fontSize: 28,
        fontWeight: '200',
        marginLeft: spacing[8],
    }
});
