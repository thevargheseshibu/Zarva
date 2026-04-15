import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useTokens } from '@shared/design-system';
import { useT } from '@shared/i18n/useTranslation';
import { useWorkerWalletStore } from '@payment/workerWalletStore';
import { paiseToINR } from '@shared/utils/paiseToINR';
import PremiumButton from '@shared/ui/PremiumButton';
import PressableAnimated from '@shared/design-system/components/PressableAnimated';
import MainBackground from '@shared/ui/MainBackground';

export default function WorkerWithdrawScreen({ navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const { availablePaise, pendingPaise, bankAccounts, fetchBalance, fetchBankAccounts, requestWithdrawal } = useWorkerWalletStore();
    
    const [amount, setAmount] = useState('');
    const [selectedMethod, setSelectedMethod] = useState(null); // 'upi' or 'bank'
    const [submitting, setSubmitting] = useState(false);

    useFocusEffect(
        useCallback(() => {
            fetchBalance();
            fetchBankAccounts();
            return () => {};
        }, [fetchBalance, fetchBankAccounts])
    );

    // ⭐ AUTO-SELECT METHOD: If they only have one method, pick it automatically
    useEffect(() => {
        if (bankAccounts.length > 0 && !selectedMethod) {
            const acc = bankAccounts[0];
            if (acc.upi_id && !acc.ifsc_code) setSelectedMethod('upi');
            else if (acc.ifsc_code && !acc.upi_id) setSelectedMethod('bank');
            else if (acc.upi_id) setSelectedMethod('upi'); // Default to UPI if both exist
        }
    }, [bankAccounts]);

    const MIN_WITHDRAWAL_PAISE = 100_000; // ₹1,000
    const amountPaise = Math.round(parseFloat(String(amount || 0).replace(/[^0-9.]/g, '')) * 100) || 0;
    
    // Logic for button states
    const isAmountValid = amountPaise >= MIN_WITHDRAWAL_PAISE;
    const isBalanceSufficient = amountPaise <= availablePaise;
    const isMethodSelected = !!selectedMethod;
    const isValid = isAmountValid && isBalanceSufficient && isMethodSelected;

    const account = bankAccounts[0] || {}; 
    const hasUPI = !!account.upi_id;
    const hasBank = !!account.ifsc_code;

    // ⭐ DYNAMIC BUTTON TEXT: Tell the user EXACTLY why they can't click
    const getButtonTitle = () => {
        if (submitting) return "Processing...";
        if (!isMethodSelected) return "Select Payout Method";
        if (amountPaise === 0) return "Enter Amount";
        if (!isAmountValid) return "Min. Withdrawal ₹1,000";
        if (!isBalanceSufficient) return "Insufficient Balance";
        return "Submit Request";
    };

    const handleConfirm = async () => {
        if (!isValid) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
            "Confirm Transfer",
            `Amount: ${paiseToINR(amountPaise)}\nMethod: ${selectedMethod.toUpperCase()}\nStatus: Will be marked as 'Processing' until admin clears it.`,
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('confirm'),
                    onPress: async () => {
                        setSubmitting(true);
                        try {
                            await requestWithdrawal(amountPaise, account.id, selectedMethod);
                            Alert.alert('Success', 'Withdrawal request is now processing.');
                            navigation.goBack();
                        } catch (err) {
                            Alert.alert('Error', err?.response?.data?.message || err.message);
                        } finally {
                            setSubmitting(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <MainBackground>
            <View style={styles.header}>
                <PressableAnimated onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Text style={styles.headerBtnTxt}>←</Text>
                </PressableAnimated>
                <Text style={styles.headerTitle}>{t('withdraw', { defaultValue: 'Withdraw' })}</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>{t('available_balance', { defaultValue: 'Available Balance' })}</Text>
                <Text style={styles.amount}>{paiseToINR(availablePaise)}</Text>
                
                {pendingPaise > 0 && (
                    <View style={styles.warningBox}>
                        <Text style={styles.warningTxt}>Note: You currently have a payout of {paiseToINR(pendingPaise)} processing.</Text>
                    </View>
                )}

                <Text style={styles.inputLabel}>{t('amount_to_withdraw', { defaultValue: 'Amount' })}</Text>
                <TextInput
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="e.g. 1500"
                    placeholderTextColor={tTheme.text.tertiary}
                    keyboardType="decimal-pad"
                />

                <View style={styles.rowBetween}>
                    <Text style={styles.inputLabel}>Payout Method</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('AddBankAccount', { returnTo: 'WorkerWithdraw' })}>
                        <Text style={styles.editBtn}>Edit Methods</Text>
                    </TouchableOpacity>
                </View>

                {!hasUPI && !hasBank ? (
                    <TouchableOpacity style={styles.addAccount} onPress={() => navigation.navigate('AddBankAccount', { returnTo: 'WorkerWithdraw' })}>
                        <Text style={styles.addAccountTxt}>+ Add Payment Method</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={{ gap: 12, marginBottom: 24 }}>
                        {hasUPI && (
                            <TouchableOpacity 
                                style={[styles.methodCard, selectedMethod === 'upi' && styles.methodSelected]} 
                                onPress={() => setSelectedMethod('upi')}
                            >
                                <View style={styles.radio}><View style={selectedMethod === 'upi' && styles.radioFilled} /></View>
                                <View>
                                    <Text style={styles.methodTitle}>UPI Transfer</Text>
                                    <Text style={styles.methodDesc}>{account.upi_id}</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                        {hasBank && (
                            <TouchableOpacity 
                                style={[styles.methodCard, selectedMethod === 'bank' && styles.methodSelected]} 
                                onPress={() => setSelectedMethod('bank')}
                            >
                                <View style={styles.radio}><View style={selectedMethod === 'bank' && styles.radioFilled} /></View>
                                <View>
                                    <Text style={styles.methodTitle}>Bank Account (IMPS)</Text>
                                    <Text style={styles.methodDesc}>{account.bank_name || 'Bank'} • {account.ifsc_code}</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                <PremiumButton 
                    title={getButtonTitle()} 
                    onPress={handleConfirm} 
                    disabled={!isValid || submitting} 
                />
            </ScrollView>
        </MainBackground>
    );
}

const createStyles = (t) => StyleSheet.create({
    header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.background.surface, justifyContent: 'center', alignItems: 'center' },
    headerBtnTxt: { color: t.text.primary, fontSize: 20 },
    headerTitle: { color: t.text.primary, fontSize: 18, fontWeight: '700' },
    scroll: { padding: 24, paddingBottom: 120 },
    label: { color: t.text.tertiary, fontSize: 12 },
    amount: { color: t.text.primary, fontSize: 36, fontWeight: '900', marginBottom: 24 },
    warningBox: { backgroundColor: t.status.warning.base + '22', padding: 12, borderRadius: 8, marginBottom: 24 },
    warningTxt: { color: t.status.warning.base, fontSize: 12, fontWeight: 'bold' },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
    inputLabel: { color: t.text.secondary, fontSize: 14 },
    editBtn: { color: t.brand.primary, fontSize: 12, fontWeight: 'bold' },
    input: { backgroundColor: t.background.surface, borderWidth: 1, borderColor: t.border.default + '33', borderRadius: 12, padding: 16, color: t.text.primary, fontSize: 18, marginBottom: 32 },
    methodCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.background.surface, borderWidth: 1, borderColor: t.border.default + '22', borderRadius: 12, padding: 16 },
    methodSelected: { borderColor: t.brand.primary, backgroundColor: t.brand.primary + '11' },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: t.border.default + '66', marginRight: 16, justifyContent: 'center', alignItems: 'center' },
    radioFilled: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.brand.primary },
    methodTitle: { color: t.text.primary, fontSize: 14, fontWeight: '600' },
    methodDesc: { color: t.text.tertiary, fontSize: 12, marginTop: 2 },
    addAccount: { backgroundColor: t.brand.primary + '22', borderWidth: 1, borderColor: t.brand.primary, borderRadius: 12, padding: 16, marginBottom: 24 },
    addAccountTxt: { color: t.brand.primary, textAlign: 'center', fontWeight: '600' }
});
