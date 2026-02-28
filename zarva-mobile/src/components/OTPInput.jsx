/**
 * src/components/OTPInput.jsx
 * 4-box OTP input: gold bottom border when active, mono 32px, auto-advance.
 */
import React, { useRef, useState } from 'react';
import { useTokens } from '../design-system';
import {
    View,
    TextInput,
    StyleSheet,
    Platform,
} from 'react-native';


const BOX_COUNT = 4;

export default function OTPInput({ onComplete, onChange, value = '' }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const inputs = useRef([]);
    const [otp, setOtp] = useState(Array(BOX_COUNT).fill(''));

    const handleChange = (text, index) => {
        const digits = text.replace(/[^0-9]/g, '');

        // Handle Paste
        if (digits.length > 1) {
            const next = Array(BOX_COUNT).fill('');
            for (let j = 0; j < Math.min(digits.length, BOX_COUNT); j++) {
                next[j] = digits[j];
            }
            setOtp(next);
            onChange?.(next.join(''));

            const nextFocus = Math.min(digits.length, BOX_COUNT - 1);
            inputs.current[nextFocus]?.focus();

            const full = next.join('');
            if (full.length === BOX_COUNT) onComplete?.(full);
            return;
        }

        // Handle single keystroke
        const digit = digits.slice(-1);
        const next = [...otp];
        next[index] = digit;
        setOtp(next);
        onChange?.(next.join(''));

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
                    autoFocus={i === 0}
                />
            ))}
        </View>
    );
}

const createStyles = (t) => StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: t.spacing.sm,
    },
    box: {
        width: 56,
        height: 64,
        backgroundColor: t.background.surface,
        borderRadius: t.radius.md,
        borderBottomWidth: 2,
        borderBottomColor: t.text.tertiary,
        color: t.text.primary,
        fontSize: 32,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        textAlign: 'center',
        fontWeight: '700',
    },
    filled: {
        borderBottomColor: t.brand.primary,
    },
});
