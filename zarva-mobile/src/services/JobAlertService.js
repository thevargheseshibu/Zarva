/**
 * src/services/JobAlertService.js
 * 
 * Handles push notifications, sound loops, and haptics for Uber-style job alerts.
 */
import * as Notifications from 'expo-notifications';
import { createAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useWorkerStore } from '../stores/workerStore';

// Configuration for looping sound/haptics
let soundObject = null;
let hapticInterval = null;

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false, // We handle custom sound looping ourselves
        shouldSetBadge: true,
    }),
});

export const JobAlertService = {
    async init() {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') return false;

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('job_alerts', {
                name: 'Job Alerts',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
                sound: 'job_alert.mp3', // Requires file in /res/raw or assets
            });
        }

        return true;
    },

    async startAlertLoop() {
        const { alertPreferences } = useWorkerStore.getState();
        if (alertPreferences.dndMode) return;

        // 1. Loop Sound
        if (alertPreferences.soundEnabled) {
            try {
                if (soundObject) {
                    soundObject.pause();
                    soundObject.remove();
                }
                soundObject = createAudioPlayer(require('../../assets/sounds/job_alert.mp3'));
                soundObject.loop = true;
                soundObject.play();
            } catch (err) {
                console.warn('[JobAlert] Sound load failed (Check assets/sounds/job_alert.mp3)', err);
            }
        }

        // 2. Loop Haptics
        if (alertPreferences.vibrationEnabled) {
            if (hapticInterval) clearInterval(hapticInterval);
            hapticInterval = setInterval(() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }, 1000);
        }
    },

    async stopAlertLoop() {
        if (soundObject) {
            try {
                soundObject.pause();
                soundObject.remove();
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

            // Set alert data in store to trigger BottomSheet
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
                wave: parseInt(data.wave_number)
            });

            this.startAlertLoop();
        }
    }
};
