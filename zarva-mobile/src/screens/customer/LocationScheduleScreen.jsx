import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { colors, spacing, radius } from '../../design-system/tokens';
import GoldButton from '../../components/GoldButton';

export default function LocationScheduleScreen({ route, navigation }) {
    const { category, label, answers, basePrice } = route.params || {};

    const [address, setAddress] = useState('');
    const [scheduleType, setScheduleType] = useState('now'); // 'now' or 'later'
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [loading, setLoading] = useState(false);

    const handleConfirm = () => {
        setLoading(true);
        // Normally: apiClient.post('/api/jobs', { category, answers, location: address, schedule: scheduleType === 'now' ? 'ASAP' : `${date} ${time}` })
        setTimeout(() => {
            setLoading(false);
            navigation.navigate('Searching', { category, jobId: `job-${Date.now()}` });
        }, 600);
    };

    const isReady = address.trim().length > 5 && (scheduleType === 'now' || (date && time));

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backTxt}>←</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Location & Schedule</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Location Section */}
                <Text style={styles.sectionTitle}>Service Location</Text>
                <Card style={styles.card}>
                    <Text style={styles.label}>House/Flat No, Apartment, Street</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. 404, Skyline Apartments, Kakkanad..."
                        placeholderTextColor={colors.text.muted}
                        value={address}
                        onChangeText={setAddress}
                        multiline
                    />
                    <TouchableOpacity style={styles.gpsBtn}>
                        <Text style={styles.gpsTxt}>📍 Use Current Location</Text>
                    </TouchableOpacity>
                </Card>

                {/* Schedule Section */}
                <Text style={styles.sectionTitle}>When do you need the service?</Text>
                <View style={styles.tabRow}>
                    <TouchableOpacity
                        style={[styles.tab, scheduleType === 'now' && styles.tabActive]}
                        onPress={() => setScheduleType('now')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.tabTxt, scheduleType === 'now' && styles.tabTxtActive]}>ASAP (Now)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, scheduleType === 'later' && styles.tabActive]}
                        onPress={() => setScheduleType('later')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.tabTxt, scheduleType === 'later' && styles.tabTxtActive]}>Schedule Later</Text>
                    </TouchableOpacity>
                </View>

                {scheduleType === 'later' && (
                    <Card style={styles.card}>
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Date</Text>
                                <TextInput
                                    style={styles.dateInput}
                                    placeholder="DD/MM/YYYY"
                                    placeholderTextColor={colors.text.muted}
                                    value={date}
                                    onChangeText={setDate}
                                />
                            </View>
                            <View style={{ width: spacing.md }} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Time</Text>
                                <TextInput
                                    style={styles.dateInput}
                                    placeholder="10:00 AM"
                                    placeholderTextColor={colors.text.muted}
                                    value={time}
                                    onChangeText={setTime}
                                />
                            </View>
                        </View>
                    </Card>
                )}

            </ScrollView>

            <View style={styles.footer}>
                <GoldButton
                    title="Confirm & Find Worker"
                    loading={loading}
                    disabled={!isReady}
                    onPress={handleConfirm}
                />
            </View>
        </View>
    );
}

// Inline Card component since we don't import the shared one to avoid dependency cycles if modified
const Card = ({ children, style }) => (
    <View style={[{ backgroundColor: colors.bg.surface, borderRadius: radius.lg, padding: spacing.lg }, style]}>
        {children}
    </View>
);

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: spacing.xl + 20, paddingHorizontal: spacing.sm, paddingBottom: spacing.lg,
        borderBottomWidth: 1, borderBottomColor: colors.bg.surface
    },
    backBtn: { padding: spacing.sm },
    backTxt: { color: colors.text.primary, fontSize: 24 },
    title: { color: colors.text.primary, fontSize: 20, fontWeight: '700' },

    content: { padding: spacing.lg, gap: spacing.lg },
    sectionTitle: { color: colors.text.primary, fontSize: 18, fontWeight: '700', marginTop: spacing.md },

    card: { gap: spacing.sm, backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.bg.surface },

    label: { color: colors.text.secondary, fontSize: 14, fontWeight: '600' },
    input: {
        backgroundColor: colors.bg.primary, borderRadius: radius.md,
        color: colors.text.primary, padding: spacing.md, fontSize: 15,
        minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.bg.surface
    },
    gpsBtn: { alignSelf: 'flex-start', marginTop: spacing.xs },
    gpsTxt: { color: colors.gold.primary, fontWeight: '600', fontSize: 14 },

    tabRow: { flexDirection: 'row', gap: spacing.sm },
    tab: {
        flex: 1, paddingVertical: spacing.md, alignItems: 'center',
        backgroundColor: colors.bg.surface, borderRadius: radius.lg,
        borderWidth: 1, borderColor: colors.bg.surface
    },
    tabActive: { backgroundColor: colors.gold.glow, borderColor: colors.gold.primary },
    tabTxt: { color: colors.text.secondary, fontSize: 16, fontWeight: '600' },
    tabTxtActive: { color: colors.gold.primary },

    row: { flexDirection: 'row', justifyContent: 'space-between' },
    dateInput: {
        backgroundColor: colors.bg.primary, borderRadius: radius.md,
        color: colors.text.primary, padding: spacing.md, fontSize: 15,
        borderWidth: 1, borderColor: colors.bg.surface, textAlign: 'center'
    },

    footer: { padding: spacing.lg, paddingBottom: spacing.xl * 2, borderTopWidth: 1, borderTopColor: colors.bg.surface }
});
