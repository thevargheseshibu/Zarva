/**
 * src/screens/worker/AddBankAccountScreen.jsx
 * Add bank account: holder name, account number, IFSC.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTokens } from '../../design-system';
import { useT } from '../../hooks/useT';
import * as walletApi from '@payment/api';
import PremiumButton from '@shared/ui/PremiumButton';
import PressableAnimated from '../../design-system/components/PressableAnimated';

export default function AddBankAccountScreen({ navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const [holderName, setHolderName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [confirmAccount, setConfirmAccount] = useState('');
    const [ifsc, setIfsc] = useState('');
    const [bankName, setBankName] = useState('');
    const [setPrimary, setSetPrimary] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const isValid = holderName.trim() && accountNumber.replace(/\s/g, '').length >= 10 &&
        accountNumber.replace(/\s/g, '') === confirmAccount.replace(/\s/g, '') &&
        ifsc.trim().length >= 11;

    const handleSave = async () => {
        if (!isValid) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSubmitting(true);
        try {
            await walletApi.addBankAccount({
                account_holder_name: holderName.trim(),
                account_number: accountNumber.replace(/\s/g, ''),
                ifsc_code: ifsc.trim().toUpperCase(),
                bank_name: bankName.trim() || undefined,
                set_primary: setPrimary
            });
            Alert.alert(t('success'), t('bank_account_added'));
            navigation.goBack();
        } catch (err) {
            Alert.alert(t('error'), err?.response?.data?.message || err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <PressableAnimated onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Text style={styles.headerBtnTxt}>←</Text>
                </PressableAnimated>
                <Text style={styles.headerTitle}>{t('add_bank_account')}</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <Text style={styles.hint}>{t('penny_drop_hint')}</Text>

                <Text style={styles.label}>{t('account_holder_name')}</Text>
                <TextInput style={styles.input} value={holderName} onChangeText={setHolderName} placeholder={t('beneficiary_name')} placeholderTextColor={tTheme.text.tertiary} />

                <Text style={styles.label}>{t('account_number')}</Text>
                <TextInput style={styles.input} value={accountNumber} onChangeText={setAccountNumber} placeholder="1234567890" placeholderTextColor={tTheme.text.tertiary} keyboardType="number-pad" secureTextEntry />

                <Text style={styles.label}>{t('confirm_account_number')}</Text>
                <TextInput style={styles.input} value={confirmAccount} onChangeText={setConfirmAccount} placeholder="1234567890" placeholderTextColor={tTheme.text.tertiary} keyboardType="number-pad" secureTextEntry />

                <Text style={styles.label}>{t('ifsc_code')}</Text>
                <TextInput style={styles.input} value={ifsc} onChangeText={(v) => setIfsc(v.toUpperCase())} placeholder="HDFC0001234" placeholderTextColor={tTheme.text.tertiary} autoCapitalize="characters" />

                <Text style={styles.label}>{t('bank_name')} ({t('optional')})</Text>
                <TextInput style={styles.input} value={bankName} onChangeText={setBankName} placeholder="HDFC Bank" placeholderTextColor={tTheme.text.tertiary} />

                <TouchableOpacity style={styles.checkRow} onPress={() => { Haptics.selectionAsync(); setSetPrimary(!setPrimary); }}>
                    <Text style={styles.checkTxt}>{t('set_as_primary')}</Text>
                    <View style={[styles.checkbox, setPrimary && styles.checkboxActive]}><Text style={styles.checkMark}>{setPrimary ? '✓' : ''}</Text></View>
                </TouchableOpacity>

                <PremiumButton title={submitting ? t('saving') : t('save_and_verify')} onPress={handleSave} disabled={!isValid || submitting} style={styles.submitBtn} />
            </ScrollView>
        </View>
    );
}

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.app },
    header: { paddingTop: 60, paddingHorizontal: t.spacing['2xl'], paddingBottom: t.spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.background.surface, justifyContent: 'center', alignItems: 'center' },
    headerBtnTxt: { color: t.text.primary, fontSize: 20 },
    headerTitle: { color: t.text.primary, fontSize: 18, fontWeight: '700' },
    scroll: { padding: t.spacing['2xl'], paddingBottom: 120 },
    hint: { color: t.text.tertiary, fontSize: 12, marginBottom: 24, lineHeight: 18 },
    label: { color: t.text.secondary, fontSize: 14, marginBottom: 8 },
    input: { backgroundColor: t.background.surface, borderWidth: 1, borderColor: t.border, borderRadius: 12, padding: 16, color: t.text.primary, fontSize: 16, marginBottom: 20 },
    checkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
    checkTxt: { color: t.text.primary, fontSize: 16 },
    checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: t.border, justifyContent: 'center', alignItems: 'center' },
    checkboxActive: { borderColor: t.brand.primary, backgroundColor: t.brand.primary + '33' },
    checkMark: { color: t.brand.primary, fontWeight: 'bold' },
    submitBtn: {}
});
