import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../../design-system/tokens';
import { useAuthStore } from '../../stores/authStore';

const ROLES = [
    { role: 'customer', icon: '🏠', title: 'I need a service', sub: 'Book home services' },
    { role: 'worker', icon: '🔧', title: 'I provide a service', sub: 'Earn by doing jobs' },
];

export default function RoleSelection() {
    const [selected, setSelected] = React.useState(null);
    const login = useAuthStore(s => s.login);

    const handleConfirm = () => {
        if (!selected) return;
        // In production: API call to persist role, then login with real token
        login({ role: selected, active_role: selected, onboarding_complete: true }, 'mock-jwt-token');
    };

    return (
        <View style={styles.screen}>
            <Text style={styles.title}>How will you use ZARVA?</Text>
            {ROLES.map((r) => (
                <TouchableOpacity
                    key={r.role}
                    style={[styles.card, selected === r.role && styles.selected]}
                    onPress={() => setSelected(r.role)}
                >
                    <Text style={styles.icon}>{r.icon}</Text>
                    <View>
                        <Text style={styles.ctitle}>{r.title}</Text>
                        <Text style={styles.csub}>{r.sub}</Text>
                    </View>
                </TouchableOpacity>
            ))}
            {selected && (
                <TouchableOpacity style={styles.confirm} onPress={handleConfirm}>
                    <Text style={styles.confirmText}>Continue as {selected}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary, padding: spacing.xl, justifyContent: 'center', gap: spacing.md },
    title: { color: colors.text.primary, fontSize: 26, fontWeight: '700', marginBottom: spacing.sm },
    card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.bg.elevated, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.bg.surface },
    selected: { borderColor: colors.gold.primary, backgroundColor: colors.gold.glow },
    icon: { fontSize: 32 },
    ctitle: { color: colors.text.primary, fontSize: 17, fontWeight: '600' },
    csub: { color: colors.text.secondary, fontSize: 13, marginTop: 2 },
    confirm: { backgroundColor: colors.gold.primary, borderRadius: radius.lg, height: 56, justifyContent: 'center', alignItems: 'center', marginTop: spacing.md },
    confirmText: { color: colors.text.inverse, fontWeight: '700', fontSize: 16, textTransform: 'capitalize' },
});
