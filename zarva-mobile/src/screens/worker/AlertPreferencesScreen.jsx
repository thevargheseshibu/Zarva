import React from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useWorkerStore } from '../../stores/workerStore';
import { colors, spacing, radius, shadows } from '../../design-system/tokens';
import { fontSize, fontWeight, tracking } from '../../design-system/typography';
import FadeInView from '../../components/FadeInView';
import Card from '../../components/Card';
import PressableAnimated from '../../design-system/components/PressableAnimated';

export default function AlertPreferencesScreen() {
    const { alertPreferences, updateAlertPrefs } = useWorkerStore();
    const navigation = useNavigation();

    const toggle = (key) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        updateAlertPrefs({ [key]: !alertPreferences[key] });
    };

    return (
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <PressableAnimated onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Text style={styles.headerBtnTxt}>←</Text>
                </PressableAnimated>
                <View>
                    <Text style={styles.headerSub}>NOTIFICATIONS</Text>
                    <Text style={styles.headerTitle}>Mission Alerts</Text>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <FadeInView delay={50}>
                    <Text style={styles.sectionLabel}>PREFERENCE CONFIGURATION</Text>
                    <Card style={styles.settingsCard}>
                        <View style={styles.settingRow}>
                            <View style={styles.rowIcon}>
                                <Text style={styles.iconTxt}>🔊</Text>
                            </View>
                            <View style={styles.rowInfo}>
                                <Text style={styles.rowTitle}>Acoustic Alerts</Text>
                                <Text style={styles.rowSub}>High-priority melody for incoming missions</Text>
                            </View>
                            <Switch
                                value={alertPreferences.soundEnabled}
                                onValueChange={() => toggle('soundEnabled')}
                                trackColor={{ false: colors.elevated, true: colors.accent.primary }}
                                thumbColor="#FFF"
                            />
                        </View>

                        <View style={styles.innerDivider} />

                        <View style={styles.settingRow}>
                            <View style={styles.rowIcon}>
                                <Text style={styles.iconTxt}>📳</Text>
                            </View>
                            <View style={styles.rowInfo}>
                                <Text style={styles.rowTitle}>Haptic Feedback</Text>
                                <Text style={styles.rowSub}>Tactile pulses during the mobilization phase</Text>
                            </View>
                            <Switch
                                value={alertPreferences.vibrationEnabled}
                                onValueChange={() => toggle('vibrationEnabled')}
                                trackColor={{ false: colors.elevated, true: colors.accent.primary }}
                                thumbColor="#FFF"
                            />
                        </View>

                        <View style={styles.innerDivider} />

                        <View style={styles.settingRow}>
                            <View style={styles.rowIcon}>
                                <Text style={styles.iconTxt}>🌙</Text>
                            </View>
                            <View style={styles.rowInfo}>
                                <Text style={styles.rowTitle}>Quiet Mode</Text>
                                <Text style={styles.rowSub}>Suppress all auditory and tactile alerts</Text>
                            </View>
                            <Switch
                                value={alertPreferences.dndMode}
                                onValueChange={() => toggle('dndMode')}
                                trackColor={{ false: colors.elevated, true: colors.accent.primary }}
                                thumbColor="#FFF"
                            />
                        </View>
                    </Card>
                </FadeInView>

                <FadeInView delay={250}>
                    <Card style={styles.tipCard}>
                        <Text style={styles.tipHeader}>💡 STRATEGIC ADVISORY</Text>
                        <Text style={styles.tipBody}>
                            Engaging both <Text style={styles.tipAccent}>Acoustic</Text> and <Text style={styles.tipAccent}>Haptic</Text> protocols maximizes your response velocity, ensuring priority access to premium marketplace opportunities.
                        </Text>
                    </Card>
                </FadeInView>

                <View style={styles.footer}>
                    <Text style={styles.footerTxt}>ZARVA PRO ALERTS • ENCRYPTED LAYER</Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
        paddingTop: 60,
        paddingHorizontal: spacing[24],
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        paddingBottom: spacing[16]
    },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
    headerBtnTxt: { color: colors.text.primary, fontSize: 20 },
    headerSub: { color: colors.accent.primary, fontSize: 8, fontWeight: fontWeight.bold, letterSpacing: 2 },
    headerTitle: { color: colors.text.primary, fontSize: 20, fontWeight: '900', letterSpacing: tracking.body },

    scrollContent: { padding: spacing[24], gap: 32, paddingBottom: 100 },

    sectionLabel: { color: colors.accent.primary, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 2, marginBottom: 12 },
    settingsCard: { padding: 4, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surface },
    settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
    rowIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.elevated, justifyContent: 'center', alignItems: 'center' },
    iconTxt: { fontSize: 16 },
    rowInfo: { flex: 1, gap: 2 },
    rowTitle: { color: colors.text.primary, fontSize: fontSize.caption, fontWeight: fontWeight.bold },
    rowSub: { color: colors.text.muted, fontSize: 10, fontWeight: fontWeight.medium },
    innerDivider: { height: 1, backgroundColor: colors.elevated, marginHorizontal: 16, opacity: 0.5 },

    tipCard: {
        padding: 24,
        backgroundColor: colors.accent.primary + '08',
        borderWidth: 1,
        borderColor: colors.accent.primary + '11',
        gap: 8
    },
    tipHeader: { color: colors.accent.primary, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1 },
    tipBody: { color: colors.text.muted, fontSize: 13, lineHeight: 22 },
    tipAccent: { color: colors.text.primary, fontWeight: fontWeight.bold },

    footer: { marginTop: 40, alignItems: 'center' },
    footerTxt: { color: colors.text.muted, fontSize: 8, fontWeight: fontWeight.bold, letterSpacing: 2 }
});
