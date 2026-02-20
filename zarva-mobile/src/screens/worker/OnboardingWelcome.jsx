import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../../design-system/tokens';
import GoldButton from '../../components/GoldButton';

export default function OnboardingWelcome({ navigation }) {
    return (
        <View style={styles.screen}>
            <Text style={styles.title}>Welcome to ZARVA!</Text>
            <Text style={styles.sub}>Complete your profile to start accepting jobs.</Text>
            <GoldButton title="Get Started" onPress={() => navigation.navigate('OnboardingDocuments')} style={{ marginTop: spacing.xl }} />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary, padding: spacing.xl, justifyContent: 'center', gap: spacing.md },
    title: { color: colors.text.primary, fontSize: 28, fontWeight: '700' },
    sub: { color: colors.text.secondary, fontSize: 15 },
});
