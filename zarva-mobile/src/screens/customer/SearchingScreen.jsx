import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, BackHandler, Alert, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing } from '../../design-system/tokens';
import RadarAnimation from '../../components/RadarAnimation';
import apiClient from '../../services/api/client';
import { useJobStore } from '../../stores/jobStore';

export default function SearchingScreen({ route, navigation }) {
    const { category, jobId } = route.params || { category: 'electrician', jobId: 'mock-123' };
    const [nearbyCount, setNearbyCount] = useState(5);
    const [countdown, setCountdown] = useState(5);

    const { searchPhase, canMinimize, setCanMinimize, stopListening } = useJobStore();

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

    // Navigate out when assigned
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
                    '',
                    [
                        { text: 'Stay', style: 'cancel' },
                        {
                            text: 'Go Home',
                            style: 'destructive',
                            onPress: async () => {
                                stopListening(); // Stop global store listener
                                try {
                                    await apiClient.post(`/api/jobs/${jobId}/cancel`);
                                } catch (e) { console.error('Failed to cancel job in searching', e); }
                                navigation.replace('CustomerHome');
                            }
                        }
                    ]
                );
                return true;
            };
            BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
        }, [jobId, navigation, stopListening])
    );

    const handleMinimize = () => {
        navigation.replace('CustomerHome');
    };

    return (
        <View style={styles.screen}>
            <View style={styles.content}>
                <RadarAnimation size={120} />
                <Text style={styles.title}>Finding a nearby {category}...</Text>
                <Text style={styles.sub}>Checking {nearbyCount} workers nearby</Text>
            </View>

            <View style={styles.bottomArea}>
                {!canMinimize ? (
                    <View style={styles.minimizePill}>
                        <Text style={styles.minimizeText}>You can minimize this in {countdown}...</Text>
                    </View>
                ) : (
                    <TouchableOpacity style={styles.ghostBtn} onPress={handleMinimize}>
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
    title: { color: colors.text.primary, fontSize: 24, fontWeight: '700', textAlign: 'center', fontFamily: 'Sohne' },
    sub: { color: colors.gold.primary, fontSize: 16, fontWeight: '600' },
    bottomArea: { position: 'absolute', bottom: spacing.xl * 2, left: 0, right: 0, alignItems: 'center' },
    minimizePill: { backgroundColor: colors.bg.elevated, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 20 },
    minimizeText: { color: colors.text.muted, fontSize: 14, fontWeight: '500' },
    ghostBtn: { padding: spacing.md },
    ghostBtnText: { color: colors.gold.primary, fontSize: 16, fontWeight: '600', textDecorationLine: 'underline' }
});
