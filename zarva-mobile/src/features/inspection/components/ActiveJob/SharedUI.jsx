import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';

export function FadeInView({ children, delay = 0, style = {} }) {
    const opacity = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(opacity, {
            toValue: 1,
            duration: 400,
            delay,
            useNativeDriver: true,
        }).start();
    }, [delay]);

    return <Animated.View style={[{ opacity }, style]}>{children}</Animated.View>;
}

export function EndOtpDigits({ code = null, theme }) {
    if (!code) return null;
    return (
        <View style={{ flexDirection: 'row', gap: 12, marginVertical: 20 }}>
            {code.split('').map((digit, idx) => (
                <View key={idx} style={{
                    width: 56, height: 68, borderRadius: 16,
                    backgroundColor: theme.background.surfaceRaised,
                    justifyContent: 'center', alignItems: 'center',
                    borderWidth: 2, borderColor: theme.status.success.base + '44'
                }}>
                    <Text style={{
                        color: theme.status.success.base, fontSize: 32, fontWeight: '900'
                    }}>{digit}</Text>
                </View>
            ))}
        </View>
    );
}
