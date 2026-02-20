/**
 * src/screens/worker/onboarding/OnboardingPayment.jsx
 * Step 3: UPI / Bank tab switch + relevant input fields.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, radius } from '../../../design-system/tokens';
import GoldButton from '../../../components/GoldButton';

export default function OnboardingPayment({ data, onNext }) {
    const [method, setMethod] = useState('upi');
    const [upi, setUpi] = useState(data.upi || '');
    const [accountNo, setAccountNo] = useState(data.account_number || '');
    const [ifsc, setIfsc] = useState(data.ifsc || '');
    const [holderName, setHolderName] = useState(data.holder_name || '');

    const isValid = method === 'upi'
        ? upi.includes('@')
        : accountNo.length >= 8 && ifsc.length === 11 && holderName.length >= 2;

    const handleNext = () => {
        const payload = method === 'upi'
            ? { payment_method: 'upi', upi }
            : { payment_method: 'bank', account_number: accountNo, ifsc, holder_name: holderName };
        onNext(payload);
    };

    return (
        <ScrollView contentContainerStyle={styles.screen}>
            <Text style={styles.title}>Payment Setup</Text>
            <Text style={styles.sub}>How should we pay you for completed jobs?</Text>

            {/* Tab Switch */}
            <View style={styles.tabs}>
                {['upi', 'bank'].map(m => (
                    <TouchableOpacity
                        key={m}
                        style={[styles.tab, method === m && styles.tabActive]}
                        onPress={() => setMethod(m)}
                    >
                        <Text style={[styles.tabText, method === m && styles.tabTextActive]}>
                            {m === 'upi' ? '📱 UPI' : '🏦 Bank Account'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {method === 'upi' ? (
                <View style={styles.fieldGroup}>
                    <Text style={styles.label}>UPI ID</Text>
                    <TextInput
                        style={styles.input}
                        value={upi}
                        onChangeText={setUpi}
                        placeholder="yourname@upi"
                        placeholderTextColor={colors.text.muted}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />
                </View>
            ) : (
                <>
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Account Holder Name</Text>
                        <TextInput style={styles.input} value={holderName} onChangeText={setHolderName}
                            placeholder="As on bank records" placeholderTextColor={colors.text.muted} autoCapitalize="words" />
                    </View>
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Account Number</Text>
                        <TextInput style={styles.input} value={accountNo} onChangeText={setAccountNo}
                            placeholder="XXXXXXXXXXXXXXXX" placeholderTextColor={colors.text.muted} keyboardType="number-pad" />
                    </View>
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>IFSC Code</Text>
                        <TextInput style={styles.input} value={ifsc}
                            onChangeText={t => setIfsc(t.toUpperCase().slice(0, 11))}
                            placeholder="SBIN0001234" placeholderTextColor={colors.text.muted} autoCapitalize="characters" />
                    </View>
                </>
            )}

            <GoldButton title="Continue" disabled={!isValid} onPress={handleNext} style={{ marginTop: spacing.xl }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    screen: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
    title: { color: colors.text.primary, fontSize: 24, fontWeight: '700' },
    sub: { color: colors.text.secondary, fontSize: 14 },
    tabs: {
        flexDirection: 'row', backgroundColor: colors.bg.elevated,
        borderRadius: radius.lg, padding: 4, gap: 4,
    },
    tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center' },
    tabActive: { backgroundColor: colors.gold.primary },
    tabText: { color: colors.text.muted, fontWeight: '600', fontSize: 14 },
    tabTextActive: { color: colors.text.inverse },
    fieldGroup: { gap: spacing.xs },
    label: { color: colors.text.secondary, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
    input: {
        backgroundColor: colors.bg.elevated, borderRadius: radius.md,
        paddingHorizontal: spacing.md, paddingVertical: 14,
        color: colors.text.primary, fontSize: 16, borderWidth: 1, borderColor: colors.bg.surface,
    },
});
