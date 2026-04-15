import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TextInput } from 'react-native';
import { useTokens } from '@shared/design-system';
import PremiumHeader from '@shared/ui/PremiumHeader';
import MainBackground from '@shared/ui/MainBackground';
import PremiumButton from '@shared/ui/PremiumButton';
import { useWorkerWalletStore } from '@payment/workerWalletStore';
import * as walletApi from '@payment/api';

export default function AddBankAccountScreen({ navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    
    const { bankAccounts, fetchBankAccounts } = useWorkerWalletStore();
    const existing = bankAccounts[0] || {}; // We use a single unified row now

    const [loading, setLoading] = useState(false);
    
    // Bank Details
    const [holderName, setHolderName] = useState(existing.account_holder_name || '');
    const [ifsc, setIfsc] = useState(existing.ifsc_code || '');
    const [accountNo, setAccountNo] = useState(''); // Encrypted on server, leave blank to keep existing
    
    // UPI Details
    const [upi, setUpi] = useState(existing.upi_id || '');

    const handleSave = async () => {
        if (!upi && !ifsc) {
            Alert.alert("Required", "Please provide either Bank Account details or a UPI ID.");
            return;
        }

        setLoading(true);
        try {
            await walletApi.addBankAccount({
                id: existing.id || null,
                account_holder_name: holderName,
                account_number: accountNo || null, 
                ifsc_code: ifsc,
                upi_id: upi
            });
            Alert.alert("Success", "Payment methods saved successfully.");
            await fetchBankAccounts();
            navigation.goBack();
        } catch (err) {
            Alert.alert("Error", err.response?.data?.message || err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <MainBackground>
            <PremiumHeader title="Payment Methods" onBack={() => navigation.goBack()} />
            <ScrollView contentContainerStyle={styles.scroll}>
                
                <Text style={styles.sectionTitle}>1. UPI Transfer (Fastest)</Text>
                <View style={styles.card}>
                    <Text style={styles.label}>UPI ID</Text>
                    <TextInput 
                        style={styles.input} 
                        placeholder="e.g. username@okhdfcbank" 
                        placeholderTextColor={tTheme.text.tertiary}
                        value={upi} 
                        onChangeText={setUpi} 
                        autoCapitalize="none"
                    />
                </View>

                <Text style={styles.sectionTitle}>2. Direct Bank Transfer (IMPS/NEFT)</Text>
                <View style={styles.card}>
                    <Text style={styles.label}>Account Holder Name</Text>
                    <TextInput style={styles.input} placeholderTextColor={tTheme.text.tertiary} placeholder="Name on Bank Account" value={holderName} onChangeText={setHolderName} />
                    
                    <Text style={styles.label}>IFSC Code</Text>
                    <TextInput style={styles.input} placeholderTextColor={tTheme.text.tertiary} placeholder="e.g. SBIN0001234" value={ifsc} onChangeText={setIfsc} autoCapitalize="characters" />
                    
                    <Text style={styles.label}>Account Number</Text>
                    <TextInput 
                        style={styles.input} 
                        placeholder={existing.id && existing.ifsc_code ? "•••• •••• Saved (Type to override)" : "Enter Account Number"} 
                        placeholderTextColor={tTheme.text.tertiary}
                        value={accountNo} 
                        onChangeText={setAccountNo} 
                        keyboardType="numeric" 
                        secureTextEntry 
                    />
                </View>

                <PremiumButton title="Save Methods" onPress={handleSave} loading={loading} style={{ marginTop: 20 }} />
            </ScrollView>
        </MainBackground>
    );
}

const createStyles = (t) => StyleSheet.create({
    scroll: { padding: 24, paddingBottom: 100 },
    sectionTitle: { color: t.brand.primary, fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginTop: 20 },
    card: { backgroundColor: t.background.surfaceRaised, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: t.border.default + '33' },
    label: { color: t.text.secondary, fontSize: 12, marginBottom: 6 },
    input: { backgroundColor: t.background.surface, color: t.text.primary, padding: 14, borderRadius: 8, borderWidth: 1, borderColor: t.border.default + '22', marginBottom: 16, fontSize: 14 }
});
