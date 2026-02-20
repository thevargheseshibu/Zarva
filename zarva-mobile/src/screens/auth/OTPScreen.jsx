import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../../design-system/tokens';
import OTPInput from '../../components/OTPInput';
import GoldButton from '../../components/GoldButton';

export default function OTPScreen({ navigation, route }) {
    const { phone } = route.params || {};
    const [otp, setOtp] = React.useState('');

    return (
        <View style={styles.screen}>
            <Text style={styles.title}>Verify OTP</Text>
            <Text style={styles.sub}>Enter the 4-digit code sent to{'\n'}+91 {phone}</Text>
            <OTPInput onComplete={setOtp} />
            <GoldButton
                title="Verify"
                disabled={otp.length < 4}
                onPress={() => navigation.navigate('RoleSelection')}
                style={{ marginTop: spacing.xl }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary, padding: spacing.xl, justifyContent: 'center', gap: spacing.lg },
    title: { color: colors.text.primary, fontSize: 26, fontWeight: '700' },
    sub: { color: colors.text.secondary, fontSize: 14, lineHeight: 22 },
});
