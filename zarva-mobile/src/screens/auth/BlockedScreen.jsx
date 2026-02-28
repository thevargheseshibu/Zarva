/**
 * src/screens/auth/BlockedScreen.jsx
 *
 * Shown when users.is_blocked = true.
 * Force-refresh: 2026-02-28T19:05:00Z
 * Displays the block_reason and provides support escalation.
 */
import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView,
    Linking, TouchableOpacity
} from 'react-native';
import Animated, {
    useSharedValue, useAnimatedStyle,
    withSpring, withDelay, withRepeat, withSequence,
    withTiming, Easing, FadeInDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTokens } from '../../design-system';
import MainBackground from '../../components/MainBackground';
import { useAuthStore } from '../../stores/authStore';
import { useT } from '../../hooks/useT';
import apiClient from '../../services/api/client';
import { useNavigation } from '@react-navigation/native';

export default function BlockedScreen() {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const { user, logout } = useAuthStore();
    const navigation = useNavigation();
    const [reason, setReason] = useState(user?.block_reason || null);

    useEffect(() => {
        // Self-fetch to handle race condition: screen may mount before App.js async refresh
        if (reason) return;
        apiClient.get('/api/me')
            .then(res => {
                const r = res.data?.user?.block_reason;
                if (r) {
                    setReason(r);
                    useAuthStore.getState().setUser({ ...useAuthStore.getState().user, block_reason: r });
                }
            })
            .catch(() => {});
    }, []);

    const displayReason = reason || 'Account policy violation.';

    // Pulse animation for the icon ring
    const pulse = useSharedValue(1);
    const iconScale = useSharedValue(0);

    useEffect(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        iconScale.value = withDelay(300, withSpring(1, { damping: 12, stiffness: 160 }));
        pulse.value = withDelay(800, withRepeat(
            withSequence(
                withTiming(1.15, { duration: 900, easing: Easing.out(Easing.ease) }),
                withTiming(1,    { duration: 900, easing: Easing.in(Easing.ease) }),
            ),
            -1, true
        ));
    }, []);

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
    }));

    const iconStyle = useAnimatedStyle(() => ({
        transform: [{ scale: iconScale.value }],
    }));

    const [showContactOptions, setShowContactOptions] = useState(false);

    const handleChatAgent = () => {
        // Navigate to the existing support chat flow (CreateTicket → TicketChat)
        // Pre-fill with account appeal context so the agent knows the reason
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        navigation.navigate('CreateTicket', {
            prefillMessage: `Hi, my account has been suspended. Reason: "${displayReason}". I would like to appeal this decision.`,
            source: 'account_appeal',
        });
    };

    const handleEmail = () => {
        Linking.openURL(
            `mailto:customer.service@thezarva.co?subject=Account%20Suspension%20Appeal&body=Hello%2C%0A%0AMy%20account%20has%20been%20suspended.%20Reason%3A%20${encodeURIComponent(displayReason)}%0A%0APlease%20help%20me%20appeal%20this%20decision.`
        );
    };

    const handleWhatsApp = () => {
        Linking.openURL(
            `https://wa.me/9199999999?text=Hi%2C%20my%20Zarva%20account%20has%20been%20suspended.%20Reason%3A%20${encodeURIComponent(displayReason)}%20%E2%80%94%20I%20would%20like%20to%20appeal.`
        );
    };

    return (
        <MainBackground>
            <SafeAreaView style={styles.container}>
                <View style={styles.content}>

                    {/* ── Icon Block ── */}
                    <View style={styles.iconSection}>
                        <Animated.View style={[styles.outerRing, pulseStyle]} />
                        <Animated.View style={[styles.innerRing, pulseStyle, { animationDelay: '0.2s' }]} />
                        <Animated.View style={[styles.iconBox, iconStyle]}>
                            <Text style={styles.icon}>🚫</Text>
                        </Animated.View>
                    </View>

                    {/* ── Status Tag ── */}
                    <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.tagRow}>
                        <View style={styles.statusTag}>
                            <View style={styles.tagDot} />
                            <Text style={styles.tagText}>ACCOUNT SUSPENDED</Text>
                        </View>
                    </Animated.View>

                    {/* ── Headline ── */}
                    <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.headingBlock}>
                        <Text style={styles.title}>{t('account_suspended')}</Text>
                        <Text style={styles.sub}>{t('account_blocked_desc')}</Text>
                    </Animated.View>

                    {/* ── Reason Card ── */}
                    <Animated.View entering={FadeInDown.delay(650).springify()} style={styles.reasonCard}>
                        <View style={styles.reasonHeader}>
                            <View style={styles.warningDot} />
                            <Text style={styles.reasonHeaderTxt}>{t('blocked_reason_label')}</Text>
                        </View>
                        <View style={styles.reasonDivider} />
                        <Text style={styles.reasonText}>{displayReason}</Text>
                        <Text style={styles.reasonFootnote}>
                            If you believe this is an error, submit an appeal via our support channel.
                        </Text>
                    </Animated.View>

                    {/* ── Actions ── */}
                    <Animated.View entering={FadeInDown.delay(800).springify()} style={styles.actions}>

                        {/* Primary: Chat with Agent */}
                        <TouchableOpacity style={styles.appealBtn} onPress={handleChatAgent} activeOpacity={0.85}>
                            <Text style={styles.appealBtnIcon}>💬</Text>
                            <Text style={styles.appealBtnTxt}>Chat with Support Agent</Text>
                        </TouchableOpacity>

                        {/* Secondary: Email / WhatsApp expanded */}
                        {!showContactOptions ? (
                            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowContactOptions(true)} activeOpacity={0.8}>
                                <Text style={styles.secondaryBtnTxt}>📩  Email or WhatsApp</Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.contactOptionsRow}>
                                <TouchableOpacity style={styles.contactOption} onPress={handleEmail} activeOpacity={0.8}>
                                    <Text style={styles.contactOptionIcon}>✉️</Text>
                                    <Text style={styles.contactOptionTxt}>Email Us</Text>
                                </TouchableOpacity>
                                <View style={styles.optionDivider} />
                                <TouchableOpacity style={styles.contactOption} onPress={handleWhatsApp} activeOpacity={0.8}>
                                    <Text style={styles.contactOptionIcon}>💬</Text>
                                    <Text style={styles.contactOptionTxt}>WhatsApp</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        <TouchableOpacity onPress={logout} style={styles.logoutBtn} activeOpacity={0.7}>
                            <Text style={styles.logoutTxt}>{t('logout') || 'Sign Out'}</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>

                {/* ── Footer ── */}
                <View style={styles.footer}>
                    <Text style={styles.footerLine}>Zarva Trust & Safety</Text>
                </View>
            </SafeAreaView>
        </MainBackground>
    );
}

const createStyles = (t) => {
    const DANGER = t.status.error.base;
    const DANGER_DIM = 'rgba(239, 68, 68, 0.12)';
    const DANGER_BORDER = 'rgba(239, 68, 68, 0.25)';

    return StyleSheet.create({
    container: { flex: 1 },
    content: {
        flex: 1,
        paddingHorizontal: t.spacing[32],
        justifyContent: 'center',
        alignItems: 'center',
        gap: 28,
    },

    // ── Icon ──────────────────────────────────────────
    iconSection: {
        width: 120, height: 120,
        justifyContent: 'center', alignItems: 'center',
    },
    outerRing: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 60,
        borderWidth: 1,
        borderColor: DANGER_BORDER,
        backgroundColor: DANGER_DIM,
    },
    innerRing: {
        position: 'absolute',
        width: 88, height: 88,
        borderRadius: 44,
        borderWidth: 1.5,
        borderColor: DANGER + '55',
        backgroundColor: DANGER_DIM,
    },
    iconBox: {
        width: 60, height: 60,
        borderRadius: 30,
        backgroundColor: DANGER + '18',
        borderWidth: 2,
        borderColor: DANGER + '55',
        justifyContent: 'center', alignItems: 'center',
    },
    icon: { fontSize: 28 },

    // ── Status Tag ────────────────────────────────────
    tagRow: { alignItems: 'center' },
    statusTag: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: DANGER + '15',
        borderRadius: t.radius.full,
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: DANGER_BORDER,
    },
    tagDot: {
        width: 6, height: 6, borderRadius: 3,
        backgroundColor: DANGER,
    },
    tagText: {
        color: DANGER,
        fontSize: 9,
        fontWeight: t.typography.weight.bold,
        letterSpacing: 2,
    },

    // ── Headline ──────────────────────────────────────
    headingBlock: { alignItems: 'center', gap: 10 },
    title: {
        color: t.text.primary,
        fontSize: 32,
        fontWeight: '900',
        letterSpacing: t.typography.tracking.title,
        textAlign: 'center',
    },
    sub: {
        color: t.text.tertiary,
        fontSize: 14,
        lineHeight: 22,
        textAlign: 'center',
        paddingHorizontal: 8,
    },

    // ── Reason Card ────────────────────────────────────
    reasonCard: {
        width: '100%',
        backgroundColor: t.background.surface,
        borderRadius: t.radius.xl,
        padding: 20,
        borderWidth: 1,
        borderColor: DANGER_BORDER,
        gap: 10,
        shadowColor: DANGER,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 6,
    },
    reasonHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
    },
    warningDot: {
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: DANGER,
    },
    reasonHeaderTxt: {
        color: DANGER,
        fontSize: 9,
        fontWeight: t.typography.weight.bold,
        letterSpacing: 2,
    },
    reasonDivider: {
        height: 1,
        backgroundColor: DANGER + '22',
    },
    reasonText: {
        color: t.text.primary,
        fontSize: 15,
        fontWeight: t.typography.weight.bold,
        lineHeight: 22,
    },
    reasonFootnote: {
        color: t.text.tertiary,
        fontSize: 11,
        lineHeight: 17,
        fontStyle: 'italic',
    },

    // ── Actions ───────────────────────────────────────
    actions: { width: '100%', gap: 12 },
    appealBtn: {
        backgroundColor: DANGER,
        borderRadius: t.radius.lg,
        paddingVertical: 16,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: DANGER,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 14,
        elevation: 8,
    },
    appealBtnIcon: { fontSize: 16 },
    appealBtnTxt: {
        color: '#fff',
        fontSize: 14,
        fontWeight: t.typography.weight.bold,
        letterSpacing: 0.5,
    },

    // Secondary: Email or WhatsApp
    secondaryBtn: {
        backgroundColor: t.background.surface,
        borderRadius: t.radius.lg,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: DANGER_BORDER,
    },
    secondaryBtnTxt: {
        color: t.text.secondary,
        fontSize: 14,
        fontWeight: t.typography.weight.bold,
    },

    // Expanded contact options row
    contactOptionsRow: {
        flexDirection: 'row',
        backgroundColor: t.background.surface,
        borderRadius: t.radius.lg,
        borderWidth: 1,
        borderColor: DANGER_BORDER,
        overflow: 'hidden',
    },
    contactOption: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
        gap: 6,
    },
    contactOptionIcon: { fontSize: 18 },
    contactOptionTxt: {
        color: t.text.secondary,
        fontSize: 12,
        fontWeight: t.typography.weight.bold,
    },
    optionDivider: {
        width: 1,
        backgroundColor: DANGER_BORDER,
    },
    logoutBtn: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    logoutTxt: {
        color: t.text.tertiary,
        fontSize: 13,
        fontWeight: t.typography.weight.bold,
    },

    // ── Footer ────────────────────────────────────────
    footer: { paddingBottom: t.spacing['2xl'], alignItems: 'center' },
    footerLine: {
        color: t.text.tertiary,
        fontSize: 9,
        letterSpacing: 2,
        textTransform: 'uppercase',
        opacity: 0.4,
    },
});
};
