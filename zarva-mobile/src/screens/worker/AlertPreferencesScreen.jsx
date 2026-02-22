/**
 * src/screens/worker/AlertPreferencesScreen.jsx
 */
import React from 'react';
import { View, Text, StyleSheet, Switch, ScrollView } from 'react-native';
import { useWorkerStore } from '../../stores/workerStore';
import { colors, spacing, radius } from '../../design-system/tokens';

export default function AlertPreferencesScreen() {
    const { alertPreferences, updateAlertPrefs } = useWorkerStore();

    const toggle = (key) => {
        updateAlertPrefs({ [key]: !alertPreferences[key] });
    };

    return (
        <ScrollView style={styles.screen}>
            <View style={styles.header}>
                <Text style={styles.title}>Job Alert Settings</Text>
                <Text style={styles.subtitle}>Customize how you get notified about new job requests near you.</Text>
            </View>

            <View style={styles.section}>
                <View style={styles.row}>
                    <View style={styles.info}>
                        <Text style={styles.label}>Alert Sound</Text>
                        <Text style={styles.desc}>Play a looping sound for new jobs</Text>
                    </View>
                    <Switch
                        value={alertPreferences.soundEnabled}
                        onValueChange={() => toggle('soundEnabled')}
                        trackColor={{ false: colors.bg.surface, true: colors.gold.primary }}
                        thumbColor="#fff"
                    />
                </View>

                <View style={[styles.row, styles.border]}>
                    <View style={styles.info}>
                        <Text style={styles.label}>Vibration</Text>
                        <Text style={styles.desc}>Pulse haptics during the job offer</Text>
                    </View>
                    <Switch
                        value={alertPreferences.vibrationEnabled}
                        onValueChange={() => toggle('vibrationEnabled')}
                        trackColor={{ false: colors.bg.surface, true: colors.gold.primary }}
                        thumbColor="#fff"
                    />
                </View>

                <View style={[styles.row, styles.border]}>
                    <View style={styles.info}>
                        <Text style={styles.label}>Do Not Disturb</Text>
                        <Text style={styles.desc}>Silence all job alerts (Still visible in list)</Text>
                    </View>
                    <Switch
                        value={alertPreferences.dndMode}
                        onValueChange={() => toggle('dndMode')}
                        trackColor={{ false: colors.bg.surface, true: colors.gold.primary }}
                        thumbColor="#fff"
                    />
                </View>
            </View>

            <View style={styles.tipBox}>
                <Text style={styles.tipTitle}>💡 Tip for Workers</Text>
                <Text style={styles.tipText}>
                    Keeping sound and vibration ON helps you respond faster and secure jobs before other professionals in your area.
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary },
    header: { padding: spacing.xl, paddingTop: spacing.xl * 2 },
    title: { color: colors.text.primary, fontSize: 24, fontWeight: '800', marginBottom: spacing.xs },
    subtitle: { color: colors.text.muted, fontSize: 14, lineHeight: 20 },

    section: {
        backgroundColor: colors.bg.surface,
        marginHorizontal: spacing.lg,
        borderRadius: radius.lg,
        paddingHorizontal: spacing.md
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.lg
    },
    border: { borderTopWidth: 1, borderTopColor: colors.bg.primary },
    info: { flex: 1, pr: spacing.md },
    label: { color: colors.text.primary, fontSize: 16, fontWeight: '700', marginBottom: 2 },
    desc: { color: colors.text.muted, fontSize: 12 },

    tipBox: {
        margin: spacing.xl,
        padding: spacing.lg,
        backgroundColor: colors.gold.glow,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.gold.primary,
        opacity: 0.8
    },
    tipTitle: { color: colors.gold.primary, fontSize: 14, fontWeight: '800', marginBottom: spacing.xs },
    tipText: { color: colors.text.primary, fontSize: 13, lineHeight: 18 }
});
