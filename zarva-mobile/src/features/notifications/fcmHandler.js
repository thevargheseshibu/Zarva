/**
 * src/features/notifications/fcmHandler.js
 * ZARVA FCM Message Handler
 *
 * This module is the single entry point for all incoming FCM payloads,
 * regardless of whether the app is in foreground, background, or quit state.
 *
 * It reads the `type` field from the FCM data payload and routes accordingly:
 *   - NEW_JOB_ALERT   → triggers job alert sound loop + shows bottom sheet
 *   - job_accepted    → refreshes customer job screen via store
 *   - job_started     → refreshes customer active session
 *   - job_completed   → navigates customer to bill review
 *   - chat_message    → increments chat badge in Firebase
 *   - generic         → appended to notification history only
 *
 * ZCAP: Business logic for worker alert acceptance lives in JobAlertService.
 *       Navigation is handled by navigationRef from src/app/RootNavigator.
 */
import { JobAlertService } from './JobAlertService';
import { useWorkerStore } from '@worker/store';
import { useNotificationStore } from './store';

/**
 * Route an incoming FCM payload to the appropriate feature handler.
 * Safe to call from foreground handler AND notification-open handler.
 *
 * @param {object} remoteMessage - Firebase RemoteMessage object
 * @param {object} [navigationRef] - React Navigation ref (optional, only needed for taps)
 */
export function handleFCMMessage(remoteMessage, navigationRef = null) {
  if (!remoteMessage) return;

  const data = remoteMessage?.data || {};
  const notification = remoteMessage?.notification || {};
  const type = data?.type;

  // Always append to notification history
  useNotificationStore.getState().addNotification({
    id: data?.notification_id || String(Date.now()),
    title: notification?.title || data?.title || '',
    body: notification?.body || data?.body || '',
    type,
    data,
    receivedAt: Date.now(),
  });

  switch (type) {
    // ── Worker: New Job Alert ───────────────────────────────────────────
    case 'NEW_JOB_ALERT': {
      const workerStore = useWorkerStore.getState();
      workerStore.setPendingJobAlert({
        id: data.job_id,
        category: data.category,
        categoryIcon: data.category_icon,
        distance: parseFloat(data.distance_km),
        earnings: parseInt(data.estimated_earnings, 10),
        area: data.customer_area,
        description: data.description_snippet,
        isEmergency: data.is_emergency === '1',
        acceptWindow: parseInt(data.accept_window_seconds, 10) || 30,
        wave: parseInt(data.wave_number, 10),
        timestamp: Date.now(),
      });
      JobAlertService.startAlertLoop().catch(console.warn);
      break;
    }

    // ── Customer: Job Accepted by Worker ────────────────────────────────
    case 'job_accepted': {
      // The customer's JobStatusDetailScreen listens to Firebase directly.
      // FCM here is just the wake-up call — no extra navigation needed
      // unless we need to deep-link from background/quit.
      if (navigationRef?.isReady() && data?.job_id) {
        navigationRef.navigate('JobStatusDetail', { jobId: data.job_id });
      }
      break;
    }

    // ── Customer: Job Started ───────────────────────────────────────────
    case 'job_started': {
      if (navigationRef?.isReady() && data?.job_id) {
        navigationRef.navigate('JobStatusDetail', { jobId: data.job_id });
      }
      break;
    }

    // ── Customer: Job Completed / Bill Ready ────────────────────────────
    case 'job_completed': {
      if (navigationRef?.isReady() && data?.job_id) {
        navigationRef.navigate('BillReview', { jobId: data.job_id });
      }
      break;
    }

    // ── Shared: Chat Message ─────────────────────────────────────────────
    case 'chat_message': {
      // Firebase real-time listener in ChatScreen handles unread badge natively.
      // If the user tapped the notification we can open the chat directly.
      if (navigationRef?.isReady() && data?.chat_id) {
        navigationRef.navigate('Chat', { chatId: data.chat_id });
      }
      break;
    }

    // ── Worker: Job Cancelled ────────────────────────────────────────────
    case 'job_cancelled': {
      // Clear any active job from the worker store
      const workerStore = useWorkerStore.getState();
      if (workerStore.activeJob?.id == data?.job_id) {
        workerStore.setActiveJob(null);
      }
      break;
    }

    // ── Support: Ticket Update ───────────────────────────────────────────
    case 'ticket_update': {
      if (navigationRef?.isReady() && data?.ticket_id) {
        navigationRef.navigate('TicketChat', { ticketId: data.ticket_id });
      }
      break;
    }

    default:
      // Generic notification — already appended to history above
      break;
  }
}
