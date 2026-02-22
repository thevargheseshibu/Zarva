/**
 * App.js — ZARVA Mobile entry point
 *
 * Wraps the entire app in:
 *   - GestureHandlerRootView  (required for bottom sheets / gestures)
 *   - QueryClientProvider     (react-query)
 *   - SafeAreaProvider        (safe area insets)
 *   - RootNavigator           (auth-gated navigation)
 */
import 'react-native-gesture-handler';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, LogBox } from 'react-native';

LogBox.ignoreLogs([
  'setLayoutAnimationEnabledExperimental is currently a no-op in the New Architecture.',
]);
import RootNavigator from './src/navigation/RootNavigator';
import { useLanguageStore } from './src/i18n';
import apiClient from './src/services/api/client';
import { useJobStore } from './src/stores/jobStore';
import { useWorkerStore } from './src/stores/workerStore';
import { useAuthStore } from './src/stores/authStore';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { JobAlertService } from './src/services/JobAlertService';

// Define Background Location Task
const LOCATION_TASK_NAME = 'background-location-task';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[Background Location] Error:', error);
    return;
  }
  if (data) {
    const { locations } = data;
    const [location] = locations;
    if (location) {
      const { latitude, longitude } = location.coords;
      const isOnline = useWorkerStore.getState().isOnline;
      const isAuthenticated = useAuthStore.getState().isAuthenticated;

      if (isOnline && isAuthenticated) {
        await apiClient.put('/api/worker/location', {
          lat: latitude,
          lng: longitude
        }).catch(e => console.warn('BG Location sync failed', e));
      }
    }
  }
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export default function App() {
  const { language, isLoaded, loadLanguage } = useLanguageStore();

  React.useEffect(() => {
    loadLanguage(language);
    JobAlertService.init();
  }, [language]);

  React.useEffect(() => {
    if (isLoaded) {
      // Rehydrate minimizable active job queue on app reopen
      apiClient.get('/api/me/jobs?status=active').then(res => {
        const job = res.data?.jobs?.[0] || res.data?.data?.[0]; // Support multiple payload styles
        if (job) {
          const store = useJobStore.getState();
          store.setActiveJob({ id: job.id, category: job.category });
          store.setSearchPhase(job.status || 'searching');
          store.setCanMinimize(true);
          store.startListening(job.id);
        }
      }).catch(err => { /* Soft ignore on Unauth instances */ });

      // Worker: Re-hydrate Push Token & Install Foreground Message Receivers
      const registerForPushNotificationsAsync = async () => {
        try {
          const { status: existingStatus } = await Notifications.getPermissionsAsync();
          let finalStatus = existingStatus;
          if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
          }
          if (finalStatus !== 'granted') return;

          // Request native OS token (FCM/APNs) to route past Expo explicitly for our Node.js Match Engine
          const tokenData = await Notifications.getDevicePushTokenAsync();
          const isAuthenticated = useAuthStore.getState().isAuthenticated;

          if (tokenData && tokenData.data && isAuthenticated) {
            await apiClient.put('/api/me/fcm-token', { fcm_token: tokenData.data });
          }
        } catch (err) {
          // If we still get a 401, ignore it as the user might be logging out
          if (err?.response?.status !== 401) {
            console.log('[Push] Failed to init or sync token', err);
          }
        }
      };

      registerForPushNotificationsAsync();

      // 5. Native Receivers delegating to JobAlertService
      const notificationListener = {
        current: Notifications.addNotificationReceivedListener(notification => {
          JobAlertService.handleIncomingNotification(notification);
        })
      };

      const responseListener = {
        current: Notifications.addNotificationResponseReceivedListener(response => {
          JobAlertService.handleIncomingNotification(response.notification);
        })
      };

      return () => {
        if (notificationListener.current) notificationListener.current.remove();
        if (responseListener.current) responseListener.current.remove();
      };
    }
  }, [isLoaded]);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0F', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#CFA34B" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" backgroundColor="#0A0A0F" />
          <RootNavigator />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
