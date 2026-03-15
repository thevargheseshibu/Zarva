
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Linking } from 'react-native';
import { useTokens } from '@shared/design-system';

import PremiumButton from '@shared/ui/PremiumButton';
import MainBackground from '@shared/ui/MainBackground';
import { useAuthStore } from '@auth/store';
import { useT } from '@shared/i18n/useTranslation';

export default function VerificationPendingScreen() {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const logout = useAuthStore(state => state.logout);

    const handleWhatsAppSupport = () => {
        Linking.openURL('https://wa.me/91XXXXXXXXXX'); // Replace with actual support number
    };

    return (
        <MainBackground>
            <SafeAreaView style={styles.container}>
                <View style={styles.content}>
                    <View style={styles.iconContainer}>
                        <Text style={styles.icon}>⏳</Text>
                    </View>

                    <Text style={styles.title}>{t('profile_under_review') || 'Profile Under Review'}</Text>
                    <Text style={styles.description}>
                        {t('pending_review_long_desc') || "We've received your application! Our team is currently verifying your documents and profile details. This typically takes 24-48 hours."}
                    </Text>

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>{t('what_happens_next') || 'What happens next?'}</Text>
                        <View style={styles.step}>
                            <View style={styles.dot} />
                            <Text style={styles.stepText}>{t('step_document_check') || 'Our team verifies your identity documents.'}</Text>
                        </View>
                        <View style={styles.step}>
                            <View style={styles.dot} />
                            <Text style={styles.stepText}>{t('step_background_check') || 'We perform internal security & background checks.'}</Text>
                        </View>
                        <View style={styles.step}>
                            <View style={styles.dot} />
                            <Text style={styles.stepText}>{t('step_notification') || 'You will receive a notification once approved!'}</Text>
                        </View>
                    </View>

                    <View style={styles.actions}>
                        <PremiumButton
                            title={t('contact_support') || 'Contact Support'}
                            onPress={handleWhatsAppSupport}
                            variant="secondary"
                        />
                        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
                            <Text style={styles.logoutText}>{t('logout') || 'Logout'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Zarva Professional Registry</Text>
                </View>
            </SafeAreaView>
        </MainBackground>
    );
}

const createStyles = (t) => StyleSheet.create({
    container: { flex: 1 },
    content: { flex: 1, padding: 38, justifyContent: 'center', alignItems: 'center' },
    iconContainer: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: t.background.surfaceRaised,
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 38,
        borderWidth: 1, borderColor: t.border.default + '33'
    },
    icon: { fontSize: 40 },
    title: {
        color: t.text.primary, fontSize: 24,
        fontWeight: t.typography.weight.bold, textAlign: 'center',
        marginBottom: 20
    },
    description: {
        color: t.text.secondary, fontSize: 15,
        textAlign: 'center', lineHeight: 22,
        marginBottom: 38, paddingHorizontal: 20
    },
    card: {
        width: '100%', backgroundColor: t.background.surface,
        borderRadius: t.radius.xl, padding: 30,
        borderWidth: 1, borderColor: t.border.default + '11',
        marginBottom: 48
    },
    cardTitle: {
        color: t.brand.primary, fontSize: 13,
        fontWeight: t.typography.weight.bold, letterSpacing: 1,
        marginBottom: 20, textTransform: 'uppercase'
    },
    step: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, gap: 10 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.brand.primary, marginTop: 7 },
    stepText: { color: t.text.primary, fontSize: 14, lineHeight: 20, flex: 1 },
    actions: { width: '100%', gap: 20 },
    logoutBtn: { paddingVertical: 20, alignItems: 'center' },
    logoutText: { color: t.text.tertiary, fontSize: 14, fontWeight: t.typography.weight.medium },
    footer: { paddingBottom: 38, alignItems: 'center' },
    footerText: { color: t.text.tertiary, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }
});
