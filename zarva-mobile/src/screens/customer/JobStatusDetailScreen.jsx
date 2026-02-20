import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { colors, spacing, radius } from '../../design-system/tokens';
import Card from '../../components/Card';
import OTPInput from '../../components/OTPInput';
import GoldButton from '../../components/GoldButton';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../../utils/firebase';

export default function JobStatusDetailScreen({ route, navigation }) {
    const { jobId } = route.params || { jobId: 'mock-123' };

    // DEV MOCK: hardcoded status progression for UI testing
    const [status, setStatus] = useState('assigned'); // 'searching', 'assigned', 'worker_arrived', 'in_progress', 'pending_completion', 'completed'
    const [mockWorker, setMockWorker] = useState({
        name: 'Rahul R', rating: 4.8, category: 'Plumber', phone: '+91 9876543210',
        photo: 'https://i.pravatar.cc/150?img=11'
    });

    // Firebase REAL-TIME UPDATES
    useEffect(() => {
        const jobRef = ref(db, `active_jobs/${jobId}`);
        const listener = onValue(jobRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                if (data.status) {
                    setStatus(data.status);
                }
                if (data.worker) {
                    setMockWorker(data.worker);
                }
            }
        });

        return () => off(jobRef, 'value', listener);
    }, [jobId]);

    // Timeline logic
    const STAGES = ['searching', 'assigned', 'worker_arrived', 'in_progress', 'pending_completion'];
    const currentIdx = STAGES.indexOf(status) === -1 ? STAGES.length : STAGES.indexOf(status);

    const renderTick = (label, index) => {
        const isPast = index < currentIdx;
        const isCurrent = index === currentIdx;
        const isPending = index > currentIdx;

        let dotColor = colors.bg.surface;
        if (isPast) dotColor = colors.success;
        if (isCurrent) dotColor = colors.gold.primary;

        return (
            <View key={label} style={styles.tickRow}>
                <View style={styles.tickCol}>
                    <View style={[styles.dot, { backgroundColor: dotColor }]} />
                    {index < STAGES.length - 1 && (
                        <View style={[styles.line, { backgroundColor: isPast ? colors.success : colors.bg.surface }]} />
                    )}
                </View>
                <Text style={[
                    styles.tickLabel,
                    isPast && styles.tickLabelPast,
                    isCurrent && styles.tickLabelCurrent
                ]}>
                    {label.replace('_', ' ').toUpperCase()}
                </Text>
            </View>
        );
    };

    return (
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backTxt}>←</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Job #{jobId.substring(0, 6).toUpperCase()}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Timeline */}
                <Card style={styles.timelineCard}>
                    {STAGES.map((s, i) => renderTick(s, i))}
                </Card>

                {/* Worker Info Card */}
                {currentIdx >= 1 && status !== 'no_worker_found' && (
                    <Card style={styles.workerCard}>
                        <Image source={{ uri: mockWorker.photo }} style={styles.wPhoto} />
                        <View style={styles.wInfo}>
                            <Text style={styles.wName}>{mockWorker.name}</Text>
                            <Text style={styles.wMeta}>⭐ {mockWorker.rating} • {mockWorker.category}</Text>
                        </View>
                        <TouchableOpacity style={styles.callBtn}>
                            <Text style={styles.callIcon}>📞</Text>
                        </TouchableOpacity>
                    </Card>
                )}

                {/* Dynamic Action Area based on Status */}

                {status === 'worker_arrived' && (
                    <Card glow style={styles.actionCard}>
                        <Text style={styles.actionTitle}>Share Start Code</Text>
                        <Text style={styles.actionSub}>Give this 4-digit code to {mockWorker.name} to begin the work timer.</Text>
                        <View style={styles.codeRow}>
                            {['4', '1', '9', '2'].map((n, i) => (
                                <View key={i} style={styles.codeBox}>
                                    <Text style={styles.codeDigit}>{n}</Text>
                                </View>
                            ))}
                        </View>
                    </Card>
                )}

                {status === 'pending_completion' && (
                    <Card glow style={styles.actionCard}>
                        <Text style={styles.actionTitle}>Verify Completion</Text>
                        <Text style={styles.actionSub}>Ask {mockWorker.name} for the End OTP to confirm the work is done and stop the timer.</Text>
                        <View style={{ marginTop: spacing.md }}>
                            <OTPInput
                                onComplete={(code) => {
                                    // Normally POST to /api/jobs/:id/verify-end-otp
                                    navigation.replace('Payment');
                                }}
                            />
                        </View>
                        <GoldButton
                            title="Confirm Completion"
                            style={{ marginTop: spacing.lg }}
                            onPress={() => navigation.replace('Payment')}
                        />
                    </Card>
                )}

                {status === 'in_progress' && (
                    <View style={styles.inProgressWrap}>
                        <Card glow style={styles.ipCard}>
                            <Text style={styles.ipTitle}>Work in Progress</Text>
                            <Text style={styles.ipTimer}>00:45:12</Text>
                            <Text style={styles.ipSub}>Timer is currently running</Text>
                        </Card>
                        <TouchableOpacity style={styles.reportBtn}>
                            <Text style={styles.reportTxt}>⚠️ Report Issue</Text>
                        </TouchableOpacity>
                    </View>
                )}

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: spacing.xl + 20, paddingHorizontal: spacing.sm, paddingBottom: spacing.lg,
        borderBottomWidth: 1, borderBottomColor: colors.bg.surface
    },
    backBtn: { padding: spacing.sm },
    backTxt: { color: colors.text.primary, fontSize: 24 },
    title: { color: colors.text.primary, fontSize: 18, fontWeight: '700', fontFamily: 'Courier', letterSpacing: 1 },

    content: { padding: spacing.lg, gap: spacing.lg },

    // Timeline
    timelineCard: { padding: spacing.xl },
    tickRow: { flexDirection: 'row', gap: spacing.md, minHeight: 40 },
    tickCol: { alignItems: 'center', width: 20 },
    dot: { width: 12, height: 12, borderRadius: 6, zIndex: 2 },
    line: { width: 2, flex: 1, marginVertical: -4, zIndex: 1 },
    tickLabel: { color: colors.text.muted, fontSize: 14, fontWeight: '500', marginTop: -2 },
    tickLabelPast: { color: colors.text.primary },
    tickLabelCurrent: { color: colors.gold.primary, fontWeight: '700' },

    // Worker Card
    workerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
    wPhoto: { width: 50, height: 50, borderRadius: 25 },
    wInfo: { flex: 1 },
    wName: { color: colors.text.primary, fontSize: 18, fontWeight: '700' },
    wMeta: { color: colors.text.secondary, fontSize: 13, marginTop: 2 },
    callBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: colors.bg.surface, justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: colors.gold.primary + '44'
    },
    callIcon: { fontSize: 20 },

    // Actions
    actionCard: { padding: spacing.xl, borderColor: colors.gold.primary, borderWidth: 1, alignItems: 'center' },
    actionTitle: { color: colors.gold.primary, fontSize: 20, fontWeight: '800' },
    actionSub: { color: colors.text.secondary, fontSize: 13, textAlign: 'center', marginTop: spacing.sm },

    codeRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
    codeBox: {
        width: 56, height: 64, backgroundColor: colors.bg.surface,
        borderRadius: radius.md, justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: colors.gold.primary
    },
    codeDigit: { color: colors.gold.primary, fontSize: 32, fontFamily: 'Courier', fontWeight: '800' },

    // In progress
    inProgressWrap: { gap: spacing.md },
    ipCard: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.bg.surface },
    ipTitle: { color: colors.text.primary, fontSize: 18, fontWeight: '700' },
    ipTimer: { color: colors.gold.primary, fontSize: 36, fontFamily: 'Courier', fontWeight: '800' },
    ipSub: { color: colors.text.muted, fontSize: 13 },
    reportBtn: { alignSelf: 'center', padding: spacing.md },
    reportTxt: { color: colors.error, fontWeight: '600' }
});
