import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { colors, spacing } from '../../design-system/tokens';
import { useAuthStore } from '../../stores/authStore';
import { useWorkerStore } from '../../stores/workerStore';

export default function WorkerProfileScreen() {
    const { user, logout } = useAuthStore();
    const { isOnline, setOnline } = useWorkerStore();

    return (
        <View style={styles.screen}>
            <Text style={styles.title}>Worker Profile</Text>
            <Text style={styles.phone}>{user?.phone || 'Worker'}</Text>

            <View style={styles.onlineRow}>
                <Text style={styles.onlineLabel}>
                    {isOnline ? '🟢 Online' : '🔴 Offline'}
                </Text>
                <Switch
                    value={isOnline}
                    onValueChange={setOnline}
                    thumbColor={isOnline ? colors.gold.primary : colors.text.muted}
                    trackColor={{ false: colors.bg.surface, true: colors.gold.glow }}
                />
            </View>

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
    onlineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
    onlineLabel: { color: colors.text.primary, fontSize: 16 },
    logout: { marginTop: spacing.xl, borderWidth: 1, borderColor: colors.error, borderRadius: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    logoutText: { color: colors.error, fontWeight: '600' },
});
