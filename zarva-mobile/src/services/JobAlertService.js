/**
 * src/services/JobAlertService.js
 * 
 * Handles push notifications, sound loops, and haptics for Uber-style job alerts.
 */
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useWorkerStore } from '../stores/workerStore';

// Configuration for looping sound/haptics
let soundObject = null;
let hapticInterval = null;

// NOTE: setNotificationHandler is intentionally NOT configured here.
// App.js globally sets this to avoid duplicate/conflicting handlers.

async function playAlertSound() {
    await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,   // plays even on silent mode — like Uber
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false
    });

    if (soundObject) {
        await soundObject.unloadAsync();
        soundObject = null;
    }

    const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' },
        { isLooping: true, volume: 1.0 }
    );

    return sound;
}

export const JobAlertService = {
    async init() {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') return false;

        // Note: Android Notification Channel is managed in App.js now
        return true;
    },

    async startAlertLoop() {
        const { alertPreferences } = useWorkerStore.getState();
        if (alertPreferences?.dndMode) return;

        // 1. Loop Sound
        if (alertPreferences?.soundEnabled !== false) {
            try {
                soundObject = await playAlertSound();
                await soundObject.playAsync();
            } catch (err) {
                console.warn('[JobAlert] Sound load failed (Check assets/sounds/job_alert.mp3)', err);
            }
        }

        // 2. Loop Haptics
        if (alertPreferences?.vibrationEnabled !== false) {
            if (hapticInterval) clearInterval(hapticInterval);

            // Initial sequence
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

            hapticInterval = setInterval(() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => { });
            }, 1000);
        }
    },

    async stopAlertLoop() {
        if (soundObject) {
            try {
                await soundObject.stopAsync();
                await soundObject.unloadAsync();
            } catch (e) { }
            soundObject = null;
        }
        if (hapticInterval) {
            clearInterval(hapticInterval);
            hapticInterval = null;
        }
    },

    // Handles incoming notification when app is in foreground or background
    handleIncomingNotification(notification) {
        const data = notification.request.content.data;
        if (data?.type === 'NEW_JOB_ALERT') {
            const workerStore = useWorkerStore.getState();

            // Store full raw job data exactly as passed from FCM payload and matching engine API, mapping naming convention cleanly
            workerStore.setPendingJobAlert({
                id: data.job_id,
                category: data.category,
                categoryIcon: data.category_icon,
                distance: parseFloat(data.distance_km),
                earnings: parseInt(data.estimated_earnings),
                area: data.customer_area,
                description: data.description_snippet,
                isEmergency: data.is_emergency === '1',
                acceptWindow: parseInt(data.accept_window_seconds) || 30,
                wave: parseInt(data.wave_number),
                timestamp: Date.now() // to handle time decay on reboot
            });

            // Only trigger the loop via "this.startAlertLoop()" otherwise lexical `this` binds incorrectly depending on event listener scope
            JobAlertService.startAlertLoop().catch(console.warn);
        }
    }
};
