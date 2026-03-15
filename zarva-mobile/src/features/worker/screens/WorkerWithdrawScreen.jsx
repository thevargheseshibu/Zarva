/**
 * src/screens/worker/WorkerWithdrawScreen.jsx
 * Initiate withdrawal: amount, bank account, confirm.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useTokens } from '@shared/design-system';
import { useT } from '@shared/i18n/useTranslation';
import { useWorkerWalletStore } from '@payment/workerWalletStore';
import { paiseToINR } from '../../utils/paiseToINR';
import PremiumButton from '@shared/ui/PremiumButton';
import PressableAnimated from '@shared/design-system/components/PressableAnimated';

export default function WorkerWithdrawScreen({ navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const { availablePaise, bankAccounts, fetchBalance, fetchBankAccounts, requestWithdrawal } = useWorkerWalletStore();
    const [amount, setAmount] = useState('');
    const [selectedAccountId, setSelectedAccountId] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useFocusEffect(
        useCallback(() => {
            fetchBalance();
            fetchBankAccounts();
            return () => {};
        }, [fetchBalance, fetchBankAccounts])
    );

    const MIN_WITHDRAWAL_PAISE = 100_000; // ₹1,000 minimum
    const amountPaise = Math.round(parseFloat(String(amount || 0).replace(/[^0-9.]/g, '')) * 100) || 0;
    const isValid = amountPaise >= MIN_WITHDRAWAL_PAISE && amountPaise <= availablePaise && selectedAccountId;
    const verifiedAccounts = (bankAccounts || []);

    const handleConfirm = async () => {
        if (!isValid) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
            t('confirm_withdrawal'),
            t('withdrawal_confirm_msg').replace('{{amount}}', paiseToINR(amountPaise)).replace('{{time}}', t('usually_2_hours')),
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('confirm'),
                    onPress: async () => {
                        setSubmitting(true);
                        try {
                            await requestWithdrawal(amountPaise, selectedAccountId);
                            setAmount('');
                            setSelectedAccountId(null);
                            Alert.alert(t('success'), t('withdrawal_initiated'));
                            navigation.goBack();
                        } catch (err) {
                            Alert.alert(t('error'), err?.response?.data?.message || err.message);
                        } finally {
                            setSubmitting(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <PressableAnimated onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Text style={styles.headerBtnTxt}>←</Text>
                </PressableAnimated>
                <Text style={styles.headerTitle}>{t('withdraw')}</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>{t('available_balance')}</Text>
                <Text style={styles.amount}>{paiseToINR(availablePaise)}</Text>

                <Text style={styles.inputLabel}>{t('amount_to_withdraw')}</Text>
                <Text style={styles.minHint}>{t('min_withdrawal_hint')}</Text>
                <TextInput
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0.00"
                    placeholderTextColor={tTheme.text.tertiary}
                    keyboardType="decimal-pad"
                />

                <Text style={styles.inputLabel}>{t('select_bank_account')}</Text>
                {verifiedAccounts.length === 0 ? (
                    <TouchableOpacity style={styles.addAccount} onPress={() => navigation.navigate('AddBankAccount', { returnTo: 'WorkerWithdraw' })}>
                        <Text style={styles.addAccountTxt}>{t('add_bank_account')}</Text>
                    </TouchableOpacity>
                ) : (
                    verifiedAccounts.map((acc) => (
                        <TouchableOpacity
                            key={acc.id}
                            style={[styles.accountCard, selectedAccountId === acc.id && styles.accountCardSelected]}
                            onPress={() => {
                                Haptics.selectionAsync();
                                setSelectedAccountId(acc.id);
                            }}
                        >
                            <Text style={styles.accountName}>{acc.account_holder_name}</Text>
                            <Text style={styles.accountDetail}>{acc.ifsc_code} • ••••••••</Text>
                        </TouchableOpacity>
                    ))
                )}

                <Text style={styles.hint}>{t('estimated_arrival')}: {t('usually_2_hours')}</Text>

                <PremiumButton
                    title={submitting ? t('processing') : t('withdraw')}
                    onPress={handleConfirm}
                    disabled={!isValid || submitting}
                    style={styles.submitBtn}
                />
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
    label: { color: t.text.tertiary, fontSize: 12 },
    amount: { color: t.text.primary, fontSize: 28, fontWeight: '800', marginBottom: 24 },
    inputLabel: { color: t.text.secondary, fontSize: 14, marginBottom: 8 },
    minHint: { color: t.text.tertiary, fontSize: 12, marginBottom: 4 },
    input: { backgroundColor: t.background.surface, borderWidth: 1, borderColor: t.border, borderRadius: 12, padding: 16, color: t.text.primary, fontSize: 18, marginBottom: 24 },
    accountCard: { backgroundColor: t.background.surface, borderWidth: 1, borderColor: t.border, borderRadius: 12, padding: 16, marginBottom: 12 },
    accountCardSelected: { borderColor: t.brand.primary },
    accountName: { color: t.text.primary, fontSize: 16, fontWeight: '600' },
    accountDetail: { color: t.text.tertiary, fontSize: 12, marginTop: 4 },
    addAccount: { backgroundColor: t.brand.primary + '22', borderWidth: 1, borderColor: t.brand.primary, borderRadius: 12, padding: 16, marginBottom: 12 },
    addAccountTxt: { color: t.brand.primary, textAlign: 'center', fontWeight: '600' },
    hint: { color: t.text.tertiary, fontSize: 12, marginTop: 12, marginBottom: 24 },
    submitBtn: {}
});
