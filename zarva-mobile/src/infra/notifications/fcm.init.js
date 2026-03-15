/**
 * src/infra/notifications/fcm.init.js
 * ZARVA FCM Initialisation — Push Notification Setup
 *
 * Responsibilities:
 *   1. Request notification permissions from the OS
 *   2. Retrieve the FCM device token and report it to the server
 *   3. Register the foreground message handler (in-app alert)
 *   4. Register the background / quit-state message handler
 *   5. Handle notification tap (opened-app events)
 *
 * ZCAP Mandate:
 *   - This file ONLY sets up the plumbing.
 *   - Message routing logic lives in src/features/notifications/fcmHandler.js
 *   - No business logic in this file.
 */
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { getSecureItem, saveSecureItem } from '@infra/storage/secureStore';
import { getEnv } from '@infra/config/env';

// ─── Channel IDs ─────────────────────────────────────────
const CHANNEL_ID = 'zarva_default';
const CHANNEL_JOBS = 'zarva_jobs';

// ─── 1. Create OS notification channels (Android) ────────
export async function createNotificationChannels() {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'General Notifications',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });
  await notifee.createChannel({
    id: CHANNEL_JOBS,
    name: 'Job Alerts',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });
}

// ─── 2. Request Permission ────────────────────────────────
export async function requestNotificationPermission() {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (!enabled) {
    console.warn('[FCM] Notification permission denied by user.');
  }
  return enabled;
}

// ─── 3. Get & Upload FCM Token ────────────────────────────
export async function registerFCMToken(apiClient) {
  try {
    const token = await messaging().getToken();
    if (!token) return;

    const stored = await getSecureItem('fcm_token');
    if (stored === token) return; // Token unchanged — skip upload

    const BASE_URL = getEnv('API_BASE_URL');
    await apiClient.post('/api/worker/fcm-token', { token });
    await saveSecureItem('fcm_token', token);

    console.log('[FCM] Token registered successfully.');
  } catch (err) {
    console.error('[FCM] Token registration failed:', err?.message);
  }
}

// ─── 4. Token Refresh Listener ───────────────────────────
export function watchTokenRefresh(apiClient) {
  return messaging().onTokenRefresh(async (newToken) => {
    try {
      await apiClient.post('/api/worker/fcm-token', { token: newToken });
      await saveSecureItem('fcm_token', newToken);
      console.log('[FCM] Token refreshed and re-registered.');
    } catch (err) {
      console.error('[FCM] Token refresh upload failed:', err?.message);
    }
  });
}

// ─── 5. Foreground Message Handler ───────────────────────
//   Displays a local notification when app is in the foreground.
//   The actual routing (navigate to job screen etc.) is in fcmHandler.js
export function registerForegroundHandler() {
  return messaging().onMessage(async (remoteMessage) => {
    const { notification, data } = remoteMessage;
    if (!notification) return;

    await notifee.displayNotification({
      title: notification.title,
      body: notification.body,
      android: {
        channelId: data?.type === 'job_alert' ? CHANNEL_JOBS : CHANNEL_ID,
        pressAction: { id: 'default' },
        smallIcon: 'ic_notification',
      },
      data: data || {},
    });
  });
}

// ─── 6. Background / Quit Handler ────────────────────────
//   Must be called OUTSIDE the React component tree (top-level in index.js)
export function registerBackgroundHandler() {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    // Background messages are auto-displayed by the OS.
    // We just log here — no UI work is safe in background.
    console.log('[FCM] Background message received:', remoteMessage?.data?.type);
  });
}

// ─── 7. Notification-Open (Tap) Handler ──────────────────
//   Called when user taps a notification and opens the app.
//   navigationRef must be set before calling this.
export function registerOpenedHandler(navigationRef) {
  // App opened from QUIT state by tapping notification
  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage?.data) {
        handleNavigationFromMessage(remoteMessage.data, navigationRef);
      }
    });

  // App opened from BACKGROUND state by tapping notification
  return messaging().onNotificationOpenedApp((remoteMessage) => {
    if (remoteMessage?.data) {
      handleNavigationFromMessage(remoteMessage.data, navigationRef);
    }
  });
}

// ─── Navigation Helper ────────────────────────────────────
function handleNavigationFromMessage(data, navigationRef) {
  if (!navigationRef?.isReady()) return;
  const { type, jobId } = data || {};

  switch (type) {
    case 'job_alert':
      // Worker sees a new job alert — navigate to job detail preview
      navigationRef.navigate('WorkerTabs');
      break;
    case 'job_accepted':
      // Customer sees their job was picked up
      if (jobId) navigationRef.navigate('JobStatusDetail', { jobId });
      break;
    case 'job_started':
      if (jobId) navigationRef.navigate('JobStatusDetail', { jobId });
      break;
    case 'job_completed':
      if (jobId) navigationRef.navigate('BillReview', { jobId });
      break;
    case 'chat_message':
      if (data.chatId) navigationRef.navigate('Chat', { chatId: data.chatId });
      break;
    default:
      console.log('[FCM] Unhandled notification type:', type);
  }
}

// ─── Master Bootstrap ─────────────────────────────────────
//   Call this once from App.js / providers.jsx on app mount.
export async function bootstrapFCM({ apiClient, navigationRef }) {
  await createNotificationChannels();
  const permitted = await requestNotificationPermission();
  if (!permitted) return;

  await registerFCMToken(apiClient);
  watchTokenRefresh(apiClient);
  const unsubForeground = registerForegroundHandler();
  const unsubOpened = registerOpenedHandler(navigationRef);

  // Return cleanup function for useEffect teardown
  return () => {
    unsubForeground();
    unsubOpened();
  };
}
