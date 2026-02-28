import React, { useState } from 'react';
import { useTokens } from '../../../design-system';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';


import PremiumButton from '../../../components/PremiumButton';
import FadeInView from '../../../components/FadeInView';
import Card from '../../../components/Card';
import PressableAnimated from '../../../design-system/components/PressableAnimated';
import { useT } from '../../../hooks/useT';
import { useUIStore } from '../../../stores/uiStore';
import MainBackground from '../../../components/MainBackground';
import { LinearGradient } from 'expo-linear-gradient';

export default function OnboardingPayment({ data, onNext }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
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
        <MainBackground>
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
                                    {active && (
                                        <LinearGradient
                                            colors={['#FF4FA3', '#A855F7']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={StyleSheet.absoluteFill}
                                        />
                                    )}
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
                                placeholderTextColor={t.text.tertiary}
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
                                    placeholderTextColor={t.text.tertiary}
                                    autoCapitalize="words"
                                />
                            </Card>
                            <Card style={styles.inputCard}>
                                <TextInput
                                    style={styles.input}
                                    value={accountNo}
                                    onChangeText={setAccountNo}
                                    placeholder={t('account_number')}
                                    placeholderTextColor={t.text.tertiary}
                                    keyboardType="number-pad"
                                />
                            </Card>
                            <Card style={styles.inputCard}>
                                <TextInput
                                    style={styles.input}
                                    value={ifsc}
                                    onChangeText={t => setIfsc(t.toUpperCase().slice(0, 11))}
                                    placeholder={t('ifsc_code')}
                                    placeholderTextColor={t.text.tertiary}
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
                        onPress={() => {
                            if (!isValid) {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                                return;
                            }
                            handleNext();
                        }}
                    />
                </FadeInView>
            </ScrollView>
        </MainBackground>
    );
}

const createStyles = (t) => StyleSheet.create({
    scrollContent: { padding: t.spacing['2xl'], gap: t.spacing[32], paddingBottom: 60 },
    headerSub: { color: t.text.primary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 2 },
    title: { color: t.text.primary, fontSize: 32, fontWeight: '900', letterSpacing: t.typography.tracking.hero, marginTop: 4 },
    sub: { color: t.text.tertiary, fontSize: t.typography.size.body, lineHeight: 24, marginTop: 8 },

    section: { gap: 12 },
    label: { color: t.text.primary, fontSize: 12, fontWeight: t.typography.weight.bold, letterSpacing: 2 },

    tabContainer: {
        flexDirection: 'row',
        backgroundColor: t.background.surface,
        padding: 4,
        borderRadius: t.radius.lg,
        borderWidth: 1,
        borderColor: t.background.surface
    },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: t.radius.md, overflow: 'hidden' },
    tabActive: { backgroundColor: 'transparent', ...t.shadows.premium },
    tabTxt: { color: t.text.tertiary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1 },
    tabTxtActive: {
        color: 't.text.primary',
        textShadowColor: 'rgba(0,0,0,0.2)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4
    },

    inputCard: { backgroundColor: t.background.surface, padding: 4, borderWidth: 1, borderColor: t.background.surface },
    input: {
        paddingHorizontal: 16, paddingVertical: 14,
        color: t.text.primary, fontSize: t.typography.size.caption, fontWeight: t.typography.weight.semibold
    },

    bankForm: { gap: 12 },
    hintTxt: { color: t.text.tertiary, fontSize: 10, fontStyle: 'italic', paddingLeft: 4 },

    secureBadge: {
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: t.brand.primary + '08',
        borderRadius: t.radius.md,
        borderWidth: 1,
        borderColor: t.brand.primary + '11'
    },
    secureTxt: { color: t.brand.primary, fontSize: 10, fontWeight: t.typography.weight.bold, letterSpacing: 1 },

    footer: { marginTop: t.spacing.lg }
});
