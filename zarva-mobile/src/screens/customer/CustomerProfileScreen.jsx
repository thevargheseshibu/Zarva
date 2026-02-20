import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing } from '../../design-system/tokens';
import { useAuthStore } from '../../stores/authStore';

export default function CustomerProfileScreen() {
    const { user, logout } = useAuthStore();
    return (
        <View style={styles.screen}>
            <Text style={styles.title}>Profile</Text>
            <Text style={styles.phone}>{user?.phone || 'Customer'}</Text>
            <TouchableOpacity style={styles.logout} onPress={logout}>
                <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary, padding: spacing.xl, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
    title: { color: colors.text.primary, fontSize: 24, fontWeight: '700' },
    phone: { color: colors.text.secondary, fontSize: 16 },
    logout: { marginTop: spacing.xl, borderWidth: 1, borderColor: colors.error, borderRadius: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    logoutText: { color: colors.error, fontWeight: '600' },
});
