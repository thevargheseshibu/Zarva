import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, BackHandler, Alert, TouchableOpacity, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing } from '../../design-system/tokens';
import RadarAnimation from '../../components/RadarAnimation';
import apiClient from '../../services/api/client';
import { useJobStore } from '../../stores/jobStore';

export default function SearchingScreen({ route, navigation }) {
    const { category, jobId } = route.params || { category: 'electrician', jobId: 'mock-123' };
    const [countdown, setCountdown] = useState(5);
    const [waveLog, setWaveLog] = useState([]);
    const flashAnim = useRef(new Animated.Value(0)).current;

    const { searchPhase, canMinimize, setCanMinimize, stopListening, clearActiveJob, waveNumber, waveStatus } = useJobStore();

    useEffect(() => {
        navigation.setOptions({ gestureEnabled: false });
    }, [navigation]);

    // 5-second minimization lock
    useEffect(() => {
        if (canMinimize) return;
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setCanMinimize(true);
        }
    }, [countdown, canMinimize, setCanMinimize]);

    // Navigate when worker assigned
    useEffect(() => {
        if (searchPhase === 'assigned') {
            navigation.replace('JobStatusDetail', { jobId });
        }
    }, [searchPhase, navigation, jobId]);

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                Alert.alert(
                    'Cancel search?',
                    'This will cancel your job request.',
                    [
                        { text: 'Stay', style: 'cancel' },
                        {
                            text: 'Cancel Job',
                            style: 'destructive',
                            onPress: async () => {
                                stopListening();
                                clearActiveJob();
                                try {
                                    await apiClient.post(`/api/jobs/${jobId}/cancel`);
                                } catch (e) { console.error('Failed to cancel job in searching', e); }
                                navigation.replace('CustomerTabs');
                            }
                        }
                    ]
                );
                return true;
            };
            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [jobId, navigation, stopListening, clearActiveJob])
    );

    const handleGoHome = async () => {
        stopListening();
        clearActiveJob();
        navigation.replace('CustomerTabs');
    };

    // ── No worker found — terminal state ─────────────────────────────────────
    if (searchPhase === 'no_worker_found') {
        return (
            <View style={styles.screen}>
                <View style={styles.content}>
                    <Text style={styles.noWorkerIcon}>😔</Text>
                    <Text style={styles.noWorkerTitle}>No Workers Available</Text>
                    <Text style={styles.noWorkerSub}>
                        We couldn't find an available {category} near you right now.
                        Please try again in a few minutes.
                    </Text>
                    <TouchableOpacity style={styles.homeBtn} onPress={handleGoHome}>
                        <Text style={styles.homeBtnText}>Go Back Home</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <View style={styles.content}>
                <RadarAnimation size={120} />
                <Text style={styles.title}>Finding a nearby {category}...</Text>
                <Text style={styles.sub}>Searching for available workers (Wave {waveNumber}/3)</Text>
            </View>

            <View style={styles.bottomArea}>
                {!canMinimize ? (
                    <View style={styles.minimizePill}>
                        <Text style={styles.minimizeText}>You can minimize this in {countdown}...</Text>
                    </View>
                ) : (
                    <TouchableOpacity style={styles.ghostBtn} onPress={() => navigation.replace('CustomerTabs')}>
                        <Text style={styles.ghostBtnText}>Minimize — continue in background</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary, justifyContent: 'center' },
    content: { alignItems: 'center', gap: spacing.lg, padding: spacing.xl },
    title: { color: colors.text.primary, fontSize: 24, fontWeight: '700', textAlign: 'center' },
    sub: { color: colors.gold.primary, fontSize: 16, fontWeight: '600' },
    bottomArea: { position: 'absolute', bottom: spacing.xl * 2, left: 0, right: 0, alignItems: 'center' },
    minimizePill: { backgroundColor: colors.bg.elevated, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 20 },
    minimizeText: { color: colors.text.muted, fontSize: 14, fontWeight: '500' },
    ghostBtn: { padding: spacing.md },
    ghostBtnText: { color: colors.gold.primary, fontSize: 16, fontWeight: '600', textDecorationLine: 'underline' },

    // No worker found state
    noWorkerIcon: { fontSize: 56, marginBottom: spacing.sm },
    noWorkerTitle: { color: colors.text.primary, fontSize: 24, fontWeight: '800', textAlign: 'center' },
    noWorkerSub: { color: colors.text.muted, fontSize: 15, textAlign: 'center', lineHeight: 24, paddingHorizontal: spacing.xl },
    homeBtn: {
        marginTop: spacing.xl, backgroundColor: colors.gold.glow,
        paddingHorizontal: spacing.xl * 2, paddingVertical: spacing.md,
        borderRadius: 30, borderWidth: 1, borderColor: colors.gold.primary
    },
    homeBtnText: { color: colors.gold.primary, fontSize: 16, fontWeight: '700' }
});
