import { registerRootComponent } from 'expo';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';

// Handle background/killed state FCM messages and store them for the UI to pick up on mount
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('[FCM Background] Message handled in background!', remoteMessage);
    if (remoteMessage.data?.type === 'NEW_JOB_ALERT') {
        const payload = {
            id: remoteMessage.data.job_id,
            category: remoteMessage.data.category,
            categoryIcon: remoteMessage.data.category_icon,
            distance: parseFloat(remoteMessage.data.distance_km),
            earnings: parseInt(remoteMessage.data.estimated_earnings),
            area: remoteMessage.data.customer_area,
            description: remoteMessage.data.description_snippet,
            isEmergency: remoteMessage.data.is_emergency === '1',
            acceptWindow: parseInt(remoteMessage.data.accept_window_seconds) || 30,
            wave: parseInt(remoteMessage.data.wave_number),
            timestamp: Date.now() // to handle time decay on reboot
        };
        await AsyncStorage.setItem('zarva:pending_job_alert', JSON.stringify(payload));
    }
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
