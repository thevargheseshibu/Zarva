import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, shadows } from '../../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../../design-system/typography';
import PremiumButton from '../../../components/PremiumButton';
import FadeInView from '../../../components/FadeInView';
import Card from '../../../components/Card';
import PressableAnimated from '../../../design-system/components/PressableAnimated';
import { useT } from '../../../hooks/useT';

export default function OnboardingPayment({ data, onNext }) {
    const t = useT();
    const [method, setMethod] = useState('upi');
    const [upi, setUpi] = useState(data.upi || '');
    const [accountNo, setAccountNo] = useState(data.account_number || '');
    const [ifsc, setIfsc] = useState(data.ifsc || '');
    const [holderName, setHolderName] = useState(data.holder_name || '');

    const isValid = method === 'upi'
        ? upi.includes('@') && upi.length > 3
        : accountNo.length >= 8 && ifsc.length === 11 && holderName.length >= 2;

    const handleMethodChange = (m) => {
        setMethod(m);
        Haptics.selectionAsync();
    };

    const handleNext = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const payload = method === 'upi'
            ? { payment_method: 'upi', upi }
            : { payment_method: 'bank', account_number: accountNo, ifsc, holder_name: holderName };
        onNext(payload);
    };

    return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <FadeInView delay={50}>
                <Text style={styles.headerSub}>{t('step_04')}</Text>
                <Text style={styles.title}>{t('settlement_link')}</Text>
                <Text style={styles.sub}>{t('settlement_link_desc')}</Text>
            </FadeInView>

            <FadeInView delay={150} style={styles.section}>
                <Text style={styles.label}>{t('settlement_mode')}</Text>
                <View style={styles.tabContainer}>
                    {['upi', 'bank'].map(m => {
                        const active = method === m;
                        return (
                            <TouchableOpacity
                                key={m}
                                style={[styles.tab, active && styles.tabActive]}
                                onPress={() => handleMethodChange(m)}
                            >
                                <Text style={[styles.tabTxt, active && styles.tabTxtActive]}>
                                    {m === 'upi' ? t('upi_interface') : t('bank_transfer')}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </FadeInView>

            {method === 'upi' ? (
                <FadeInView delay={250} style={styles.section}>
                    <Text style={styles.label}>{t('vpa')}</Text>
                    <Card style={styles.inputCard}>
                        <TextInput
                            style={styles.input}
                            value={upi}
                            onChangeText={setUpi}
                            placeholder={t('username_upi')}
                            placeholderTextColor={colors.text.muted}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </Card>
                    <Text style={styles.hintTxt}>{t('upi_hint')}</Text>
                </FadeInView>
            ) : (
                <FadeInView delay={250} style={styles.section}>
                    <Text style={styles.label}>{t('banking_coordinates')}</Text>
                    <View style={styles.bankForm}>
                        <Card style={styles.inputCard}>
                            <TextInput
                                style={styles.input}
                                value={holderName}
                                onChangeText={setHolderName}
                                placeholder={t('beneficiary_name')}
                                placeholderTextColor={colors.text.muted}
                                autoCapitalize="words"
                            />
                        </Card>
                        <Card style={styles.inputCard}>
                            <TextInput
                                style={styles.input}
                                value={accountNo}
                                onChangeText={setAccountNo}
                                placeholder={t('account_number')}
                                placeholderTextColor={colors.text.muted}
                                keyboardType="number-pad"
                            />
                        </Card>
                        <Card style={styles.inputCard}>
                            <TextInput
                                style={styles.input}
                                value={ifsc}
                                onChangeText={t => setIfsc(t.toUpperCase().slice(0, 11))}
                                placeholder={t('ifsc_code')}
                                placeholderTextColor={colors.text.muted}
                                autoCapitalize="characters"
                            />
                        </Card>
                    </View>
                    <Text style={styles.hintTxt}>{t('bank_hint')}</Text>
                </FadeInView>
            )}

            <FadeInView delay={450} style={styles.secureBadge}>
                <Text style={styles.secureTxt}>{t('encrypted_link')}</Text>
            </FadeInView>

            <FadeInView delay={550} style={styles.footer}>
                <PremiumButton
                    title={t('initialize_settlement')}
                    disabled={!isValid}
                    onPress={handleNext}
                />
            </FadeInView>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollContent: { padding: spacing[24], gap: spacing[32], paddingBottom: 60 },
    headerSub: { color: colors.accent.primary, fontSize: 8, fontWeight: fontWeight.bold, letterSpacing: 2 },
    title: { color: colors.text.primary, fontSize: 32, fontWeight: '900', letterSpacing: tracking.hero, marginTop: 4 },
    sub: { color: colors.text.muted, fontSize: fontSize.body, lineHeight: 24, marginTop: 8 },

    section: { gap: 12 },
    label: { color: colors.accent.primary, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 2 },

    tabContainer: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        padding: 4,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.surface
    },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: radius.md },
    tabActive: { backgroundColor: colors.elevated, ...shadows.premium },
    tabTxt: { color: colors.text.muted, fontSize: 8, fontWeight: fontWeight.bold, letterSpacing: 1 },
    tabTxtActive: { color: colors.accent.primary },

    inputCard: { backgroundColor: colors.surface, padding: 4, borderWidth: 1, borderColor: colors.surface },
    input: {
        paddingHorizontal: 16, paddingVertical: 14,
        color: colors.text.primary, fontSize: fontSize.caption, fontWeight: fontWeight.semibold
    },

    bankForm: { gap: 12 },
    hintTxt: { color: colors.text.muted, fontSize: 10, fontStyle: 'italic', paddingLeft: 4 },

    secureBadge: {
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: colors.accent.primary + '08',
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.accent.primary + '11'
    },
    secureTxt: { color: colors.accent.primary, fontSize: 8, fontWeight: fontWeight.bold, letterSpacing: 1 },

    footer: { marginTop: spacing[16] }
});
