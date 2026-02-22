import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { colors, spacing, radius } from '../design-system/tokens';
import { useWorkerStore } from '../stores/workerStore';
import apiClient from '../services/api/client';
import GoldButton from './GoldButton';

export default function JobAlertBottomSheet({ navigation }) {
    const bottomSheetRef = useRef(null);
    const { pendingJobAlert, setPendingJobAlert, isOnline } = useWorkerStore();
    const [loading, setLoading] = useState(false);
    const [timeLeft, setTimeLeft] = useState(25);

    useEffect(() => {
        if (pendingJobAlert && isOnline) {
            bottomSheetRef.current?.expand();
            setTimeLeft(25); // Start 25 second decline countdown
        } else {
            bottomSheetRef.current?.close();
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
        if (!pendingJobAlert?.jobId) return;
        setLoading(true);
        try {
            await apiClient.post(`/api/worker/jobs/${pendingJobAlert.jobId}/accept`);
            Alert.alert("Job Accepted!", "You can now proceed to the customer location.");
            setPendingJobAlert(null);
            if (navigation) {
                // navigate to active job screen 
                navigation.navigate('ActiveJob', { jobId: pendingJobAlert.jobId });
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
        if (!pendingJobAlert?.jobId) return;
        setLoading(true);
        try {
            await apiClient.post(`/api/worker/jobs/${pendingJobAlert.jobId}/decline`);
            if (!isAuto) {
                Alert.alert("Declined", "You have rejected this job offer.");
            }
        } catch (e) {
            console.error("Failed to decline job", e);
        } finally {
            setLoading(false);
            setPendingJobAlert(null);
        }
    };

    if (!pendingJobAlert) return null;

    return (
        <BottomSheet
            ref={bottomSheetRef}
            snapPoints={['45%']}
            index={0}
            enablePanDownToClose={false}
            backgroundStyle={{ backgroundColor: colors.bg.elevated }}
            handleIndicatorStyle={{ backgroundColor: colors.text.muted }}
        >
            <BottomSheetView style={styles.container}>
                <View style={styles.pulseContainer}>
                    <Text style={styles.pulseIcon}>⚡</Text>
                </View>

                <Text style={styles.title}>New Job Alert!</Text>

                <View style={styles.detailsBox}>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>📍 Distance:</Text>
                        <Text style={styles.detailValue}>{pendingJobAlert.distanceKm ? `${pendingJobAlert.distanceKm} km away` : 'Calculating...'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>🔧 Service:</Text>
                        <Text style={styles.detailValue}>{pendingJobAlert.category || 'Standard'}</Text>
                    </View>
                </View>

                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.declineBtn} onPress={() => handleDecline(false)} disabled={loading}>
                        <Text style={styles.declineTxt}>Decline ({timeLeft}s)</Text>
                    </TouchableOpacity>

                    <View style={{ flex: 1.5 }}>
                        <GoldButton
                            title="ACCEPT JOB"
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
    container: {
        flex: 1,
        padding: spacing.xl,
        alignItems: 'center',
    },
    pulseContainer: {
        width: 60, height: 60, borderRadius: 30,
        backgroundColor: colors.gold.glow,
        justifyContent: 'center', alignItems: 'center',
        marginBottom: spacing.md
    },
    pulseIcon: { fontSize: 24 },
    title: {
        color: colors.text.primary,
        fontSize: 24, fontWeight: '800', fontFamily: 'Sohne',
        marginBottom: spacing.lg
    },
    detailsBox: {
        width: '100%',
        backgroundColor: colors.bg.surface,
        borderRadius: radius.lg,
        padding: spacing.lg,
        gap: spacing.md,
        marginBottom: spacing.xl
    },
    detailRow: {
        flexDirection: 'row', justifyContent: 'space-between'
    },
    detailLabel: {
        color: colors.text.muted, fontSize: 16, fontWeight: '600'
    },
    detailValue: {
        color: colors.gold.primary, fontSize: 16, fontWeight: '800'
    },
    actionRow: {
        flexDirection: 'row', width: '100%', gap: spacing.md
    },
    declineBtn: {
        flex: 1,
        borderWidth: 1, borderColor: colors.danger,
        borderRadius: radius.md,
        justifyContent: 'center', alignItems: 'center'
    },
    declineTxt: {
        color: colors.danger, fontSize: 16, fontWeight: '700'
    }
});
