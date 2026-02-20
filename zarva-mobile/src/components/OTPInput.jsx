/**
 * src/components/OTPInput.jsx
 * 4-box OTP input: gold bottom border when active, mono 32px, auto-advance.
 */
import React, { useRef, useState } from 'react';
import {
    View,
    TextInput,
    StyleSheet,
    Platform,
} from 'react-native';
import { colors, radius, spacing } from '../design-system/tokens';

const BOX_COUNT = 4;

export default function OTPInput({ onComplete, value = '' }) {
    const inputs = useRef([]);
    const [otp, setOtp] = useState(Array(BOX_COUNT).fill(''));

    const handleChange = (text, index) => {
        const digit = text.replace(/[^0-9]/g, '').slice(-1);
        const next = [...otp];
        next[index] = digit;
        setOtp(next);

        if (digit && index < BOX_COUNT - 1) {
            inputs.current[index + 1]?.focus();
        }

        const full = next.join('');
        if (full.length === BOX_COUNT) onComplete?.(full);
    };

    const handleKeyPress = (e, index) => {
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            inputs.current[index - 1]?.focus();
        }
    };

    return (
        <View style={styles.row}>
            {otp.map((digit, i) => (
                <TextInput
                    key={i}
                    ref={(ref) => (inputs.current[i] = ref)}
                    style={[styles.box, digit && styles.filled]}
                    value={digit}
                    onChangeText={(text) => handleChange(text, i)}
                    onKeyPress={(e) => handleKeyPress(e, i)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                    caretHidden
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.sm,
    },
    box: {
        width: 56,
        height: 64,
        backgroundColor: colors.bg.surface,
        borderRadius: radius.sm,
        borderBottomWidth: 2,
        borderBottomColor: colors.text.muted,
        color: colors.text.primary,
        fontSize: 32,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        textAlign: 'center',
        fontWeight: '700',
    },
    filled: {
        borderBottomColor: colors.gold.primary,
    },
});
