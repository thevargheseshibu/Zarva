import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../../design-system/tokens';
import GoldButton from '../../components/GoldButton';
import { useAuthStore } from '../../stores/authStore';

export default function OnboardingDocuments() {
    const { user, login, token } = useAuthStore();

    const handleComplete = () => {
        // Mark onboarding complete → RootNavigator will switch to WorkerNavigator
        login({ ...user, onboarding_complete: true }, token);
    };

    return (
        <View style={styles.screen}>
            <Text style={styles.title}>Upload Documents</Text>
            <Text style={styles.sub}>ID proof and certifications required.</Text>
            <GoldButton title="Submit & Continue" onPress={handleComplete} style={{ marginTop: spacing.xl }} />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary, padding: spacing.xl, justifyContent: 'center', gap: spacing.md },
    title: { color: colors.text.primary, fontSize: 24, fontWeight: '700' },
    sub: { color: colors.text.secondary, fontSize: 14 },
});
