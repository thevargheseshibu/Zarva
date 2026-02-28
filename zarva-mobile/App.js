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
import { View, ActivityIndicator, LogBox, Platform } from 'react-native';

LogBox.ignoreLogs([
  'setLayoutAnimationEnabledExperimental is currently a no-op in the New Architecture.',
  // RN Firebase legacy API deprecation warnings — safe to ignore until we migrate to v22
  'This method is deprecated (as well as all React Native Firebase namespaced API)',
  'ng-to-v22. Method called was onNotificationOpenedApp',
]);
import RootNavigator from './src/navigation/RootNavigator';
import { useLanguageStore } from './src/i18n';
import { ThemeProvider } from './src/design-system';
import apiClient from './src/services/api/client';
import { useJobStore } from './src/stores/jobStore';
import { useWorkerStore } from './src/stores/workerStore';
import { useAuthStore } from './src/stores/authStore';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { JobAlertService } from './src/services/JobAlertService';
import GlobalLoader from './src/components/GlobalLoader';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging, {
  getToken,
  onMessage,
  onNotificationOpenedApp,
  setBackgroundMessageHandler,
  getMessaging
} from '@react-native-firebase/messaging';

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
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Background/killed message handler is registered in index.js to ensure it runs
// as early as possible before the React application lifecycle starts.

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export default function App() {
  const { language, isLoaded, loadLanguage } = useLanguageStore();
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const [profileReady, setProfileReady] = React.useState(false);

  // 1. Initial Data Load
  React.useEffect(() => {
    // Only load if not already loaded to prevent flashes on hot-reload
    if (!isLoaded) {
      loadLanguage(language);
    }
    JobAlertService.init();
  }, []);

  // 2. Auth-Gated / Post-Load Logic (Rehydration)
  React.useEffect(() => {
    if (!isLoaded) return;

    // Refresh User Profile to ensure local state has latest name/dob/is_blocked/kyc_status
    if (isAuthenticated) {
      apiClient.get('/api/me')
        .then(res => {
          if (res.data?.user) {
            const current = useAuthStore.getState().user || {};
            useAuthStore.getState().setUser({ ...current, ...res.data.user });
          }
        })
        .catch(e => {
          // 403 = account blocked since last session; pull block_reason from response and update store
          if (e?.response?.status === 403) {
            const current = useAuthStore.getState().user || {};
            useAuthStore.getState().setUser({
              ...current,
              is_blocked: true,
              block_reason: e.response.data?.block_reason || current.block_reason || null,
            });
          }
          console.warn('[App.js] Profile refresh failed:', e.message);
        })
        .finally(() => setProfileReady(true));
    } else {
      setProfileReady(true); // Not logged in — render immediately
    }

    // Rehydrate minimizable active job queue
    apiClient.get('/api/me/jobs?status=active').then(res => {
      const job = res.data?.jobs?.[0] || res.data?.data?.[0];
      if (job) {
        const store = useJobStore.getState();
        store.setActiveJob({ id: job.id, category: job.category });
        store.setSearchPhase(job.status || 'searching');
        store.setCanMinimize(true);
        store.startListening(job.id);
      }
    }).catch(() => { });

    // Killed-State / Background Recovery
    AsyncStorage.getItem('zarva:pending_job_alert').then(data => {
      if (data) {
        try {
          const parsed = JSON.parse(data);
          const store = useWorkerStore.getState();
          store.setPendingJobAlert(parsed);
          JobAlertService.startAlertLoop().catch(console.warn);
          AsyncStorage.removeItem('zarva:pending_job_alert');
        } catch (e) {
          console.error('[KilledState] Recovery failed', e);
        }
      }
    }).catch(console.warn);
  }, [isLoaded]);

  // 3. FCM Token Sync (Reactive to Auth)
  React.useEffect(() => {
    if (!isLoaded || !isAuthenticated) return;

    const syncPushToken = async () => {
      try {
        console.log('[FCM] Checking permissions and token...');
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
          const { status: newStatus } = await Notifications.requestPermissionsAsync();
          if (newStatus !== 'granted') {
            console.warn('[FCM] Permission not granted');
            return;
          }
        }

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('job_alerts', {
            name: 'Job Alerts',
            description: 'Incoming job requests',
            importance: Notifications.AndroidImportance.MAX,
            sound: 'job_alert.mp3',
            vibrationPattern: [0, 500, 200, 500, 200, 500],
            enableVibrate: true,
            enableLights: true,
            lightColor: '#C9A84C',
          });
        }

        // Use RN Firebase modular API to get the token for consistency with listeners
        const token = await getToken(getMessaging());
        if (token) {
          console.log('[FCM] Syncing token with server:', token.slice(0, 10) + '...');
          await apiClient.put('/api/me/fcm-token', { fcm_token: token }).catch(() => { });
        }
      } catch (err) {
        if (err?.response?.status !== 401) {
          console.error('[FCM] Token sync failed:', err);
        }
      }
    };

    syncPushToken();
  }, [isLoaded, isAuthenticated]);

  // 4. FCM Message Listeners
  React.useEffect(() => {
    if (!isLoaded) return;

    const handleNewJob = (remoteMessage) => {
      console.log('[FCM] 🔔 NEW_JOB_ALERT received:', remoteMessage.data?.job_id);

      const authState = useAuthStore.getState();
      if (!authState.isAuthenticated || authState.user?.active_role !== 'worker') {
          console.log('[FCM] Ignoring NEW_JOB_ALERT: user not authenticated or not in worker role');
          return;
      }

      const data = remoteMessage.data;
      const alertPayload = {
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
        timestamp: Date.now()
      };

      AsyncStorage.setItem('zarva:pending_job_alert', JSON.stringify(alertPayload)).catch(() => { });

      const workerStore = useWorkerStore.getState();
      workerStore.setPendingJobAlert(alertPayload);
      JobAlertService.startAlertLoop().catch(console.warn);
    };

    const unsubscribeForeground = onMessage(getMessaging(), async remoteMessage => {
      if (remoteMessage.data?.type === 'NEW_JOB_ALERT') {
        handleNewJob(remoteMessage);
      }
    });

    const unsubscribeOpenedApp = onNotificationOpenedApp(getMessaging(), remoteMessage => {
      console.log('[FCM] 🔔 Tray tap detected');
      if (remoteMessage.data?.type === 'NEW_JOB_ALERT') {
        handleNewJob(remoteMessage);
      }
    });

    return () => {
      unsubscribeForeground();
      unsubscribeOpenedApp();
    };
  }, [isLoaded]);

  if (!isLoaded || !profileReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0F', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#CFA34B" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="light" />
            <RootNavigator />
            <GlobalLoader />
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
