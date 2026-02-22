import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { colors, spacing, radius } from '../design-system/tokens';
import { useWorkerStore } from '../stores/workerStore';
import apiClient from '../services/api/client';
import GoldButton from './GoldButton';
import { JobAlertService } from '../services/JobAlertService';
import { formatDistance } from '../utils/distance';
import StatusPill from './StatusPill';

export default function JobAlertBottomSheet({ navigation }) {
    const bottomSheetRef = useRef(null);
    const { pendingJobAlert, setPendingJobAlert, isOnline } = useWorkerStore();
    const [loading, setLoading] = useState(false);
    const [timeLeft, setTimeLeft] = useState(25);

    useEffect(() => {
        if (pendingJobAlert && isOnline) {
            bottomSheetRef.current?.expand();
            setTimeLeft(pendingJobAlert.acceptWindow || 30);
        } else {
            bottomSheetRef.current?.close();
            JobAlertService.stopAlertLoop();
            if (pendingJobAlert && !isOnline) {
                setPendingJobAlert(null); // Clear alert if worker goes offline
            }
        }
    }, [pendingJobAlert, isOnline]);

    useEffect(() => {
        if (!pendingJobAlert) return;

        if (timeLeft <= 0) {
            handleDecline(true); // Auto-decline when timer expires
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft(prev => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, pendingJobAlert]);

    const handleAccept = async () => {
        if (!pendingJobAlert?.id) return;
        setLoading(true);
        try {
            await JobAlertService.stopAlertLoop();
            await apiClient.post(`/api/worker/jobs/${pendingJobAlert.id}/accept`);
            setPendingJobAlert(null);
            if (navigation) {
                navigation.replace('ActiveJob', { jobId: pendingJobAlert.id });
            }
        } catch (error) {
            if (error.response?.status === 409) {
                Alert.alert("Missed it!", "Another worker already accepted this job or it was cancelled.");
            } else {
                Alert.alert("Error", process.env.EXPO_PUBLIC_DEV_MODE ? error.message : "Failed to accept job");
            }
            setPendingJobAlert(null);
        } finally {
            setLoading(false);
        }
    };

    const handleDecline = async (isAuto = false) => {
        if (!pendingJobAlert?.id) return;
        setLoading(true);
        try {
            await JobAlertService.stopAlertLoop();
            await apiClient.post(`/api/worker/jobs/${pendingJobAlert.id}/decline`);
        } catch (e) {
            console.error("Failed to decline job", e);
        } finally {
            setLoading(false);
            setPendingJobAlert(null);
            bottomSheetRef.current?.close();
        }
    };

    if (!pendingJobAlert) return null;

    return (
        <BottomSheet
            ref={bottomSheetRef}
            snapPoints={['55%']}
            index={-1}
            enablePanDownToClose={false}
            backgroundStyle={{ backgroundColor: colors.bg.elevated }}
            handleIndicatorStyle={{ backgroundColor: colors.text.muted }}
        >
            <BottomSheetView style={styles.container}>
                <View style={styles.headerRow}>
                    <View style={styles.catGroup}>
                        <View style={styles.catIconBox}>
                            <Text style={styles.catIcon}>{pendingJobAlert.categoryIcon || '🛠️'}</Text>
                        </View>
                        <View>
                            <Text style={styles.catLabel}>{pendingJobAlert.category}</Text>
                            <Text style={styles.areaLabel}>📍 {pendingJobAlert.area}</Text>
                        </View>
                    </View>
                    {pendingJobAlert.isEmergency && <StatusPill status="emergency" label="EMERGENCY" />}
                </View>

                <View style={styles.earningsCard}>
                    <Text style={styles.earningsLabel}>ESTIMATED EARNINGS</Text>
                    <Text style={styles.earningsValue}>₹{pendingJobAlert.earnings}</Text>
                </View>

                <View style={styles.infoGrid}>
                    <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Distance</Text>
                        <Text style={[styles.infoValue, { color: pendingJobAlert.distance < 1 ? '#4ADE80' : colors.text.primary }]}>
                            {formatDistance(pendingJobAlert.distance)}
                        </Text>
                    </View>
                    <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Response Time</Text>
                        <Text style={[styles.infoValue, { color: timeLeft < 10 ? colors.danger : colors.text.primary }]}>
                            {timeLeft}s
                        </Text>
                    </View>
                </View>

                {pendingJobAlert.description ? (
                    <Text style={styles.descTxt} numberOfLines={2}>"{pendingJobAlert.description}"</Text>
                ) : null}

                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.declineBtn} onPress={() => handleDecline(false)} disabled={loading}>
                        <Text style={styles.declineTxt}>Ignore</Text>
                    </TouchableOpacity>

                    <View style={{ flex: 2.5 }}>
                        <GoldButton
                            title="ACCEPT & START"
                            onPress={handleAccept}
                            loading={loading}
                        />
                    </View>
                </View>
            </BottomSheetView>
        </BottomSheet>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: spacing.xl },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
    catGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    catIconBox: { width: 50, height: 50, borderRadius: radius.md, backgroundColor: colors.bg.surface, justifyContent: 'center', alignItems: 'center' },
    catIcon: { fontSize: 24 },
    catLabel: { color: colors.text.primary, fontSize: 18, fontWeight: '800' },
    areaLabel: { color: colors.text.muted, fontSize: 13, marginTop: 2 },

    earningsCard: {
        backgroundColor: colors.bg.surface,
        padding: spacing.lg,
        borderRadius: radius.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.gold.glow,
        marginBottom: spacing.lg
    },
    earningsLabel: { color: colors.gold.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
    earningsValue: { color: colors.text.primary, fontSize: 32, fontWeight: '900', fontFamily: 'Courier' },

    infoGrid: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
    infoItem: { flex: 1, backgroundColor: colors.bg.surface, padding: spacing.md, borderRadius: radius.md, alignItems: 'center' },
    infoLabel: { color: colors.text.muted, fontSize: 12, marginBottom: 4 },
    infoValue: { color: colors.text.primary, fontSize: 16, fontWeight: '800' },

    descTxt: { color: colors.text.muted, fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginBottom: spacing.xl },

    actionRow: { flexDirection: 'row', width: '100%', gap: spacing.md, marginTop: 'auto', paddingBottom: spacing.sm },
    declineBtn: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    declineTxt: { color: colors.text.muted, fontSize: 16, fontWeight: '700' }
});
