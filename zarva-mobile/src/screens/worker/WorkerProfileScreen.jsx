import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, ScrollView, TextInput, Alert } from 'react-native';
import { colors, spacing } from '../../design-system/tokens';
import { useAuthStore } from '../../stores/authStore';
import { useWorkerStore } from '../../stores/workerStore';
import apiClient from '../../services/api/client';

export default function WorkerProfileScreen({ navigation }) {
    const { user, logout } = useAuthStore();
    const { isOnline, setOnline } = useWorkerStore();

    const [pincodes, setPincodes] = useState(user?.profile?.service_pincodes || []);
    const [newPincode, setNewPincode] = useState('');

    useEffect(() => {
        if (user?.profile?.service_pincodes) {
            setPincodes(typeof user.profile.service_pincodes === 'string' ? JSON.parse(user.profile.service_pincodes) : user.profile.service_pincodes);
        }
    }, [user?.profile?.service_pincodes]);

    const handleAddPincode = async () => {
        if (newPincode.trim().length < 6) return Alert.alert('Error', 'Invalid Pincode length.');
        if (pincodes.includes(newPincode.trim())) return;

        const updated = [...pincodes, newPincode.trim()];
        setPincodes(updated);
        setNewPincode('');

        try {
            await apiClient.put('/api/worker/onboard/profile', { service_pincodes: JSON.stringify(updated) });
        } catch (e) {
            console.error('Failed to sync pincode', e);
        }
    };

    const handleRemovePincode = async (code) => {
        const updated = pincodes.filter(p => p !== code);
        setPincodes(updated);

        try {
            await apiClient.put('/api/worker/onboard/profile', { service_pincodes: JSON.stringify(updated) });
        } catch (e) {
            console.error('Failed to remove pincode', e);
        }
    };

    const handleToggleOnline = async (val) => {
        setOnline(val); // optimistic update
        try {
            await apiClient.put('/api/worker/availability', { is_online: val });
        } catch (e) {
            console.error('Failed to sync online status', e);
            setOnline(!val); // rollback
            Alert.alert('Error', 'Failed to update online status.');
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.screen}>
            <Text style={styles.title}>Worker Profile</Text>
            <Text style={styles.phone}>{user?.phone || 'Worker'}</Text>

            <View style={styles.metricsBox}>
                <Text style={styles.metric}>Subscription: <Text style={{ color: colors.gold.primary }}>{user?.profile?.subscription_status || 'Free'}</Text></Text>
                <Text style={styles.metric}>Jobs Completed: <Text style={{ color: colors.gold.primary }}>{user?.profile?.total_jobs || user?.profile?.worker_total_jobs || 0}</Text></Text>
                <Text style={styles.metric}>Rating: <Text style={{ color: colors.gold.primary }}>⭐ {Number(user?.profile?.average_rating || 0).toFixed(1)}</Text></Text>
            </View>

            <View style={styles.onlineRow}>
                <Text style={styles.onlineLabel}>
                    {isOnline ? '🟢 Online' : '🔴 Offline'}
                </Text>
                <Switch
                    value={isOnline}
                    onValueChange={handleToggleOnline}
                    thumbColor={isOnline ? colors.gold.primary : colors.text.muted}
                    trackColor={{ false: colors.bg.surface, true: colors.gold.glow }}
                />
            </View>

            <View style={styles.pincodesSection}>
                <Text style={styles.sectionTitle}>Service Pincodes</Text>
                <View style={styles.pinInputRow}>
                    <TextInput
                        style={styles.pinInput}
                        placeholder="Add Pincode..."
                        placeholderTextColor={colors.text.muted}
                        value={newPincode}
                        onChangeText={setNewPincode}
                        keyboardType="numeric"
                        maxLength={6}
                    />
                    <TouchableOpacity style={styles.addBtn} onPress={handleAddPincode}>
                        <Text style={styles.addTxt}>Add</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.chipsContainer}>
                    {pincodes.map(pin => (
                        <View key={pin} style={styles.chip}>
                            <Text style={styles.chipTxt}>{pin}</Text>
                            <TouchableOpacity onPress={() => handleRemovePincode(pin)} style={{ paddingLeft: 4 }}>
                                <Text style={{ color: colors.text.muted }}>×</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            </View>

            <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('AlertPreferences')}>
                <Text style={styles.settingsTxt}>🔔 Alert Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logout} onPress={logout}>
                <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    screen: { flexGrow: 1, backgroundColor: colors.bg.primary, padding: spacing.xl, alignItems: 'center', paddingTop: 80 },
    title: { color: colors.text.primary, fontSize: 24, fontWeight: '700' },
    phone: { color: colors.text.secondary, fontSize: 16 },

    metricsBox: { marginTop: spacing.md, backgroundColor: colors.bg.surface, padding: spacing.md, borderRadius: 12, width: '100%', alignItems: 'center' },
    metric: { color: colors.text.primary, fontSize: 15, fontWeight: '600', marginVertical: 4 },

    onlineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
    onlineLabel: { color: colors.text.primary, fontSize: 16 },

    pincodesSection: { width: '100%', marginTop: spacing.xl },
    sectionTitle: { color: colors.text.primary, fontSize: 16, fontWeight: '700', marginBottom: spacing.sm },
    pinInputRow: { flexDirection: 'row', gap: spacing.sm },
    pinInput: { flex: 1, backgroundColor: colors.bg.surface, color: colors.text.primary, padding: spacing.md, borderRadius: 8 },
    addBtn: { backgroundColor: colors.gold.primary, paddingHorizontal: spacing.xl, justifyContent: 'center', borderRadius: 8 },
    addTxt: { color: colors.bg.primary, fontWeight: '700' },
    chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md },
    chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.surface, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.gold.primary + '55' },
    chipTxt: { color: colors.gold.primary, fontWeight: '600', marginRight: 6 },

    logout: { marginTop: 40, borderWidth: 1, borderColor: colors.error, borderRadius: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    logoutText: { color: colors.error, fontWeight: '600' },
    settingsBtn: { marginTop: 24, backgroundColor: colors.bg.surface, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: 12, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: colors.bg.surface },
    settingsTxt: { color: colors.text.primary, fontSize: 16, fontWeight: '700' }
});
