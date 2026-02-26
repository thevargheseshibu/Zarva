import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated, Easing, ActivityIndicator } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius } from '../design-system/tokens';
import { useWorkerStore } from '../stores/workerStore';
import apiClient from '../services/api/client';
import { JobAlertService } from '../services/JobAlertService';

// To animate SVG circle
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const CIRCLE_RADIUS = 24;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

export default function JobAlertBottomSheet({ navigation }) {
    const bottomSheetRef = useRef(null);
    const { pendingJobAlert, clearPendingJobAlert, isAlertVisible } = useWorkerStore();

    // UI states
    const [timeLeft, setTimeLeft] = useState(30);
    const [status, setStatus] = useState('idle'); // 'idle' | 'accepting' | 'success' | 'taken'
    const [errorMsg, setErrorMsg] = useState('');

    // Animations
    const strokeAnim = useRef(new Animated.Value(0)).current; // 0 = full, 1 = empty
    const scaleAnim = useRef(new Animated.Value(1)).current; // For the pulsing countdown

    // When alert is injected, reset states and open sheet
    useEffect(() => {
        if (pendingJobAlert && isAlertVisible) {
            const now = Date.now();
            const elapsed = Math.floor((now - (pendingJobAlert.timestamp || now)) / 1000);
            const initialWindow = pendingJobAlert.acceptWindow || 30;
            const remaining = Math.max(0, initialWindow - elapsed);

            setStatus('idle');
            setTimeLeft(remaining);
            setErrorMsg('');

            strokeAnim.setValue(elapsed / initialWindow);
            Animated.timing(strokeAnim, {
                toValue: 1,
                duration: remaining * 1000,
                easing: Easing.linear,
                useNativeDriver: true
            }).start();

            if (remaining === 0) {
                handleDecline(true);
            }
        } else {
            JobAlertService.stopAlertLoop();
        }
    }, [pendingJobAlert, isAlertVisible]);

    // Timer Tick
    useEffect(() => {
        if (!pendingJobAlert || status !== 'idle') return;

        if (timeLeft <= 0) {
            handleDecline(true); // Timeout decline
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                const newTime = prev - 1;
                // Severe warnings under 5 seconds
                if (newTime <= 5 && newTime > 0) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    Animated.sequence([
                        Animated.timing(scaleAnim, { toValue: 1.15, duration: 150, useNativeDriver: true }),
                        Animated.timing(scaleAnim, { toValue: 1.0, duration: 150, useNativeDriver: true })
                    ]).start();
                }
                return newTime;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, pendingJobAlert, status]);


    const handleAccept = async () => {
        if (!pendingJobAlert?.id || status !== 'idle') return;

        setStatus('accepting');
        JobAlertService.stopAlertLoop();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        try {
            await apiClient.post(`/api/worker/jobs/${pendingJobAlert.id}/accept`);
            setStatus('success');

            setTimeout(() => {
                bottomSheetRef.current?.close();
                const tempId = pendingJobAlert.id;
                clearPendingJobAlert();
                if (navigation) {
                    navigation.replace('ActiveJob', { jobId: tempId });
                }
            }, 600);

        } catch (error) {
            if (error.response?.status === 409) {
                setStatus('taken');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                setTimeout(() => {
                    bottomSheetRef.current?.close();
                    clearPendingJobAlert();
                }, 2000);
            } else {
                setStatus('idle');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                setErrorMsg(error.response?.data?.message || 'Failed to accept job. Try again.');
            }
        }
    };

    const handleDecline = async (isTimeout = false) => {
        if (!pendingJobAlert?.id || status === 'accepting' || status === 'success') return;

        setStatus('declining');
        JobAlertService.stopAlertLoop();
        if (!isTimeout) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        try {
            await apiClient.post(`/api/worker/jobs/${pendingJobAlert.id}/decline`, {
                reason: isTimeout ? 'timeout' : 'manual'
            });
        } catch (e) {
            console.error("[Alert] Failed to decline job", e);
        } finally {
            bottomSheetRef.current?.close();
            clearPendingJobAlert();
        }
    };

    // Derived UI Colors
    let ringColor = colors.accent.primary;
    if (timeLeft <= 10 && timeLeft > 5) ringColor = '#FFB830'; // Amber
    if (timeLeft <= 5) ringColor = '#FF3D5E'; // Red

    const strokeDashoffset = strokeAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, CIRCLE_CIRCUMFERENCE]
    });

    return (
        <BottomSheet
            ref={bottomSheetRef}
            snapPoints={['68%']}
            index={isAlertVisible && pendingJobAlert ? 0 : -1}
            enablePanDownToClose={status === 'idle'}
            onClose={() => {
                if (status === 'idle') handleDecline();
            }}
            backgroundStyle={styles.sheetBackground}
            handleIndicatorStyle={styles.handle}
            backdropComponent={() => isAlertVisible ? (
                <View style={StyleSheet.absoluteFillObject} pointerEvents="auto">
                    <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFillObject} />
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.7)' }]} />
                </View>
            ) : null}
            animationConfigs={{ damping: 12, stiffness: 180 }}
        >
            <BottomSheetView style={styles.container}>
                {pendingJobAlert ? (<>
                    {/* Header */}
                    <View style={[styles.headerRow, status === 'taken' && styles.headerFlash]}>
                        <View style={styles.headerLeft}>
                            <View style={styles.iconCircle}>
                                <Text style={styles.catIcon}>{pendingJobAlert.categoryIcon || '🛠️'}</Text>
                            </View>
                            <View>
                                <Text style={styles.catTitle}>{pendingJobAlert.category}</Text>
                                <Text style={styles.subtext}>New job request near you</Text>
                            </View>
                        </View>

                        {/* Countdown Ring */}
                        <Animated.View style={[styles.ringContainer, { transform: [{ scale: scaleAnim }] }]}>
                            <Svg width="56" height="56" viewBox="0 0 56 56">
                                <Circle cx="28" cy="28" r={CIRCLE_RADIUS} stroke="rgba(255,255,255,0.1)" strokeWidth="4" fill="none" />
                                <AnimatedCircle
                                    cx="28" cy="28" r={CIRCLE_RADIUS}
                                    stroke={ringColor} strokeWidth="4"
                                    strokeDasharray={CIRCLE_CIRCUMFERENCE}
                                    strokeDashoffset={strokeDashoffset}
                                    strokeLinecap="round" fill="none"
                                    rotation="-90" origin="28, 28"
                                />
                            </Svg>
                            <Text style={[styles.timerTxt, { color: ringColor }]}>{timeLeft}</Text>
                        </Animated.View>
                    </View>

                    {/* Job Details */}
                    <View style={styles.detailsBlock}>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>📍 Distance</Text>
                            <Text style={styles.distValue}>{pendingJobAlert.distance} km away</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>🏠 Area</Text>
                            <Text style={styles.areaValue}>{pendingJobAlert.area || 'Unknown Area'}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>💰 Estimated</Text>
                            <Text style={styles.earningsValue}>₹ {pendingJobAlert.earnings}</Text>
                        </View>
                        {pendingJobAlert.isEmergency && (
                            <View style={styles.emergencyPill}>
                                <Text style={styles.emergencyTxt}>🚨 EMERGENCY</Text>
                            </View>
                        )}
                    </View>

                    {/* Snippet */}
                    {pendingJobAlert.description ? (
                        <View style={styles.snippetBlock}>
                            <Text style={styles.snippetTitle}>Details</Text>
                            <Text style={styles.snippetText} numberOfLines={2}>"{pendingJobAlert.description}"</Text>
                        </View>
                    ) : null}

                    {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

                    {/* Actions */}
                    <View style={styles.actionContainer}>
                        {status === 'taken' ? (
                            <View style={styles.takenBlock}>
                                <Text style={styles.takenTxt}>Job was taken by another worker</Text>
                            </View>
                        ) : (
                            <>
                                <TouchableOpacity
                                    style={styles.declineBtn}
                                    onPress={() => handleDecline(false)}
                                    disabled={status !== 'idle'}
                                >
                                    <Text style={styles.declineTxt}>Decline</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.acceptBtn, status === 'accepting' && styles.acceptLoading]}
                                    onPress={handleAccept}
                                    disabled={status !== 'idle'}
                                    activeOpacity={0.8}
                                >
                                    {status === 'accepting' ? (
                                        <ActivityIndicator color="#0F0F1A" />
                                    ) : status === 'success' ? (
                                        <View style={styles.checkWrap}>
                                            <Text style={styles.checkIcon}>✓</Text>
                                        </View>
                                    ) : (
                                        <Text style={styles.acceptTxt}>Accept</Text>
                                    )}
                                </TouchableOpacity>
                            </>
                        )}
                    </View>

                </>) : null}
            </BottomSheetView>
        </BottomSheet>
    );
}

const styles = StyleSheet.create({
    sheetBackground: { backgroundColor: '#0F0F1A', borderTopWidth: 2, borderTopColor: colors.accent.primary },
    handle: { backgroundColor: colors.accent.primary, width: 40 },
    container: { flex: 1, padding: 24, justifyContent: 'space-between' },

    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    headerFlash: { backgroundColor: 'rgba(255, 61, 94, 0.1)', borderRadius: 12 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    iconCircle: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
    catIcon: { fontSize: 24 },
    catTitle: { color: '#FFF', fontSize: 20, fontWeight: '800', fontFamily: 'Syne' },
    subtext: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2 },

    ringContainer: { justifyContent: 'center', alignItems: 'center', width: 56, height: 56 },
    timerTxt: { position: 'absolute', fontSize: 18, fontWeight: '800', fontFamily: 'Courier' },

    detailsBlock: { backgroundColor: 'rgba(255,255,255,0.03)', padding: 20, borderRadius: 16, gap: 16, marginBottom: 20 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    detailLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' },
    distValue: { color: colors.accent.primary, fontSize: 15, fontFamily: 'Courier', fontWeight: '700' },
    areaValue: { color: '#FFF', fontSize: 15, fontWeight: '600' },
    earningsValue: { color: colors.accent.primary, fontSize: 22, fontFamily: 'Courier', fontWeight: '800' },

    emergencyPill: { alignSelf: 'flex-start', backgroundColor: '#FF3D5E22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginTop: 4 },
    emergencyTxt: { color: '#FF3D5E', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

    snippetBlock: { marginBottom: 20 },
    snippetTitle: { color: 'rgba(255,255,255,0.4)', fontSize: 12, textTransform: 'uppercase', marginBottom: 6, fontWeight: '700' },
    snippetText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 20, fontStyle: 'italic' },

    errorText: { color: '#FF3D5E', textAlign: 'center', marginBottom: 10, fontSize: 13 },

    actionContainer: { flexDirection: 'row', gap: 16, height: 60, marginTop: 'auto', paddingBottom: 10 },
    declineBtn: { flex: 1, backgroundColor: 'rgba(255,61,94,0.1)', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    declineTxt: { color: '#FF3D5E', fontSize: 16, fontWeight: '700' },

    acceptBtn: { flex: 1, backgroundColor: colors.accent.primary, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    acceptLoading: { flex: undefined, width: 60, alignSelf: 'center', marginLeft: 'auto', marginRight: 'auto' }, // Compress to pill
    acceptTxt: { color: '#0F0F1A', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },

    takenBlock: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    takenTxt: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },

    checkWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#0F0F1A', justifyContent: 'center', alignItems: 'center' },
    checkIcon: { color: colors.accent.primary, fontSize: 18, fontWeight: '900' }
});
