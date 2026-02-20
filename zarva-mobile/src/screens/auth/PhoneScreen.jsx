import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../../design-system/tokens';
import GoldButton from '../../components/GoldButton';

export default function PhoneScreen({ navigation }) {
    const [phone, setPhone] = useState('');
    return (
        <View style={styles.screen}>
            <Text style={styles.title}>Enter your phone number</Text>
            <Text style={styles.sub}>We'll send a 4-digit OTP to verify your number.</Text>
            <View style={styles.inputRow}>
                <View style={styles.prefix}><Text style={styles.prefixText}>+91</Text></View>
                <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    maxLength={10}
                    placeholder="XXXXXXXXXX"
                    placeholderTextColor={colors.text.muted}
                />
            </View>
            <GoldButton
                title="Send OTP"
                disabled={phone.length < 10}
                onPress={() => navigation.navigate('OTP', { phone })}
                style={{ marginTop: spacing.xl }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary, padding: spacing.xl, justifyContent: 'center', gap: spacing.md },
    title: { color: colors.text.primary, fontSize: 26, fontWeight: '700' },
    sub: { color: colors.text.secondary, fontSize: 14 },
    inputRow: { flexDirection: 'row', borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.bg.surface, marginTop: spacing.md },
    prefix: { backgroundColor: colors.bg.surface, paddingHorizontal: spacing.md, justifyContent: 'center' },
    prefixText: { color: colors.text.primary, fontSize: 16, fontWeight: '600' },
    input: { flex: 1, backgroundColor: colors.bg.elevated, paddingHorizontal: spacing.md, color: colors.text.primary, fontSize: 18, height: 56 },
});
