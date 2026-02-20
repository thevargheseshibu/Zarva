import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { colors, spacing, radius } from '../../design-system/tokens';
import StatusPill from '../../components/StatusPill';
import GoldButton from '../../components/GoldButton';

export default function ActiveJobScreen({ route, navigation }) {
    const { jobId } = route.params || {};

    const [status, setStatus] = useState('assigned'); // Mock states: assigned -> worker_arrived -> in_progress -> pending_completion
    const [loading, setLoading] = useState(false);

    // Sub-view states
    const [startOtp, setStartOtp] = useState(['', '', '', '']);
    const [timerActive, setTimerActive] = useState(false);
    const [timeElapsed, setTimeElapsed] = useState(0);

    const job = {
        id: jobId || 'job-123',
        category: 'Plumber',
        customer: 'Ajay K',
        phone: '+919876543210',
        address: '404 Skyline Apartments, Seaport Airport Rd, Kakkanad',
        coordinates: '10.0261,76.3225',
        dist: '2.5',
        amount: '₹800'
    };

    useEffect(() => {
        let int;
        if (timerActive) {
            int = setInterval(() => setTimeElapsed(p => p + 1), 1000);
        }
        return () => clearInterval(int);
    }, [timerActive]);

    const handleCall = () => {
        Linking.openURL(`tel:${job.phone}`);
    };

    const handleNavigate = () => {
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${job.coordinates}`);
    };

    const handleArrived = () => {
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            setStatus('worker_arrived');
        }, 500);
    };

    const handleVerifyStartOtp = () => {
        const code = startOtp.join('');
        if (code.length !== 4) return;

        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            if (code === '1234') { // Mock success
                setStatus('in_progress');
                setTimerActive(true);
            } else {
                Alert.alert('Invalid Code', 'The code provided is incorrect. Please check with the customer.');
                setStartOtp(['', '', '', '']);
            }
        }, 600);
    };

    const handleMarkComplete = () => {
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            setTimerActive(false);
            setStatus('pending_completion');
        }, 600);
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const renderActionView = () => {
        if (status === 'assigned' || status === 'worker_en_route') {
            return (
                <View style={styles.actionBox}>
                    <Text style={styles.actionPrompt}>Head to the customer's location.</Text>
                    <GoldButton title="I've Arrived" onPress={handleArrived} disabled={loading} />
                </View>
            );
        }

        if (status === 'worker_arrived') {
            return (
                <View style={styles.actionBox}>
                    <Text style={styles.actionPrompt}>Ask Customer for START CODE</Text>
                    <Text style={styles.actionSub}>The customer's app shows a 4-digit code. Enter it to begin.</Text>

                    <View style={styles.otpRow}>
                        {[0, 1, 2, 3].map(i => (
                            <View key={i} style={[styles.otpBox, startOtp[i] && styles.otpBoxActive]}>
                                <Text style={styles.otpTxt}>{startOtp[i] || '—'}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Developer Mock Numpad for testing quickly */}
                    <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'center', marginBottom: 20 }}>
                        <TouchableOpacity onPress={() => setStartOtp(['1', '2', '3', '4'])} style={{ padding: 10, backgroundColor: colors.bg.surface }}>
                            <Text style={{ color: colors.text.primary }}>MOCK ENTER 1234</Text>
                        </TouchableOpacity>
                    </View>

                    <GoldButton
                        title="Begin Work"
                        disabled={startOtp.join('').length < 4 || loading}
                        onPress={handleVerifyStartOtp}
                    />
                </View>
            );
        }

        if (status === 'in_progress') {
            return (
                <View style={styles.actionBox}>
                    <Text style={styles.actionPrompt}>Work In Progress</Text>

                    <View style={styles.timerCircle}>
                        <Text style={styles.timerVal}>{formatTime(timeElapsed)}</Text>
                        <Text style={styles.timerLbl}>Elapsed</Text>
                    </View>

                    <GoldButton title="Mark Work Complete" onPress={handleMarkComplete} disabled={loading} />

                    <TouchableOpacity style={styles.disputeBtn}>
                        <Text style={styles.disputeTxt}>⚠️ Report Issue / Dispute</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (status === 'pending_completion') {
            return (
                <View style={styles.actionBox}>
                    <Text style={styles.actionPrompt}>Show this code to customer</Text>
                    <Text style={styles.actionSub}>Customer must enter this END OTP on their app to release payment.</Text>

                    <View style={styles.readOnlyOtpWrap}>
                        <Text style={styles.readOnlyOtpTxt}>8259</Text>
                    </View>

                    <Text style={styles.waitingTxt}>⏳ Waiting for customer to confirm...</Text>
                </View>
            );
        }
    };

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backTxt}>←</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Active Job</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                <View style={styles.topCard}>
                    <View style={styles.topRow}>
                        <Text style={styles.catTxt}>{job.category}</Text>
                        <StatusPill status={status} />
                    </View>

                    <Text style={styles.custName}>{job.customer}</Text>
                    <Text style={styles.addressTxt}>📍 {job.address}</Text>

                    <View style={styles.btnRow}>
                        <TouchableOpacity style={styles.roundBtn} onPress={handleCall}>
                            <Text style={styles.roundIcon}>📞</Text>
                            <Text style={styles.roundTxt}>Call</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.roundBtn, styles.navBtn]} onPress={handleNavigate}>
                            <Text style={styles.roundIcon}>🗺️</Text>
                            <Text style={styles.roundTxt}>Navigate</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {renderActionView()}

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: spacing.xl + 20, paddingHorizontal: spacing.sm, paddingBottom: spacing.sm,
    },
    backBtn: { padding: spacing.sm },
    backTxt: { color: colors.text.primary, fontSize: 24 },
    title: { color: colors.text.primary, fontSize: 20, fontWeight: '700' },

    content: { padding: spacing.lg, gap: spacing.xl },

    topCard: { backgroundColor: colors.bg.elevated, padding: spacing.xl, borderRadius: radius.lg, borderTopWidth: 2, borderTopColor: colors.gold.primary },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    catTxt: { color: colors.text.secondary, fontSize: 16, fontWeight: '700', textTransform: 'uppercase' },

    custName: { color: colors.text.primary, fontSize: 22, fontWeight: '800', marginTop: spacing.md },
    addressTxt: { color: colors.text.muted, fontSize: 15, lineHeight: 22, marginVertical: spacing.sm },

    btnRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
    roundBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
        paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.bg.surface,
        borderWidth: 1, borderColor: colors.bg.surface
    },
    navBtn: { backgroundColor: colors.gold.glow, borderColor: colors.gold.primary },
    roundIcon: { fontSize: 16 },
    roundTxt: { color: colors.text.primary, fontWeight: '600' },

    actionBox: { backgroundColor: colors.bg.surface, borderRadius: radius.lg, padding: spacing.xl },
    actionPrompt: { color: colors.text.primary, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: spacing.xs },
    actionSub: { color: colors.text.muted, fontSize: 13, textAlign: 'center', marginBottom: spacing.lg },

    otpRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginBottom: spacing.xl },
    otpBox: {
        width: 50, height: 60, borderRadius: radius.sm, backgroundColor: colors.bg.primary,
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.bg.elevated
    },
    otpBoxActive: { borderColor: colors.gold.primary },
    otpTxt: { color: colors.gold.primary, fontSize: 28, fontWeight: '800', fontFamily: 'Courier' },

    readOnlyOtpWrap: { backgroundColor: colors.bg.primary, padding: spacing.xl, borderRadius: radius.md, alignItems: 'center', marginVertical: spacing.md },
    readOnlyOtpTxt: { color: colors.gold.primary, fontSize: 48, fontWeight: '800', letterSpacing: 8, fontFamily: 'Courier', },
    waitingTxt: { color: colors.text.secondary, textAlign: 'center', marginTop: spacing.md, fontStyle: 'italic' },

    timerCircle: {
        width: 140, height: 140, borderRadius: 70, borderWidth: 4, borderColor: colors.gold.primary,
        alignSelf: 'center', justifyContent: 'center', alignItems: 'center', marginVertical: spacing.xl,
        backgroundColor: colors.bg.primary
    },
    timerVal: { color: colors.text.primary, fontSize: 32, fontWeight: '800', fontFamily: 'Courier' },
    timerLbl: { color: colors.text.muted, fontSize: 14, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },

    disputeBtn: { marginTop: spacing.xl, padding: spacing.md, alignItems: 'center' },
    disputeTxt: { color: colors.error, fontSize: 14, fontWeight: '600' }
});
