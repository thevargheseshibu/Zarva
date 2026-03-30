/**
 * src/features/notifications/hooks/useAlertNavigation.js
 * Navigation helper for FCM-triggered job alerts.
 *
 * Determines where to route the worker after accepting a new job alert,
 * and handles routing for other notification types (chat, ticket, etc.)
 * using the shared navigationRef so it works from outside React trees.
 */
import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';

/**
 * In-component hook: uses React Navigation's useNavigation.
 * Use this inside screens and components.
 */
export function useAlertNavigation() {
  const navigation = useNavigation();

  /**
   * Navigate to the ActiveJob screen after the worker accepts a job.
   * @param {string|number} jobId
   */
  const goToActiveJob = useCallback(
    (jobId) => {
      navigation.navigate('ActiveJob', { jobId });
    },
    [navigation]
  );

  /**
   * Navigate to a chat room.
   * @param {string} chatId
   */
  const goToChat = useCallback(
    (chatId) => {
      navigation.navigate('Chat', { chatId });
    },
    [navigation]
  );

  /**
   * Navigate to a support ticket chat.
   * @param {string} ticketId
   */
  const goToTicket = useCallback(
    (ticketId) => {
      navigation.navigate('TicketChat', { ticketId });
    },
    [navigation]
  );

  /**
   * Navigate to the job status detail screen (customer-side).
   * @param {string|number} jobId
   */
  const goToJobStatus = useCallback(
    (jobId) => {
      navigation.navigate('JobStatusDetail', { jobId });
    },
    [navigation]
  );

  /**
   * Navigate to bill review (customer, after job completes).
   * @param {string|number} jobId
   */
  const goToBillReview = useCallback(
    (jobId) => {
      navigation.navigate('BillReview', { jobId });
    },
    [navigation]
  );

  return {
    goToActiveJob,
    goToChat,
    goToTicket,
    goToJobStatus,
    goToBillReview,
  };
}

/**
 * Standalone utility: routes to the correct screen based on FCM data payload.
 * Use this outside of components (e.g., in fcm.init.js notification-tap handler).
 *
 * @param {object} data - FCM data payload
 * @param {object} navigationRef - React Navigation ref
 */
export function routeFromFCMData(data, navigationRef) {
  if (!navigationRef?.isReady() || !data?.type) return;

  const { type, job_id, chat_id, ticket_id } = data;

  switch (type) {
    case 'NEW_JOB_ALERT':
      navigationRef.navigate('WorkerTabs');
      break;
    case 'job_accepted':
    case 'job_started':
      if (job_id) navigationRef.navigate('JobStatusDetail', { jobId: job_id });
      break;
    case 'job_completed':
      if (job_id) navigationRef.navigate('BillReview', { jobId: job_id });
      break;
    case 'chat_message':
      const targetJobId = job_id || chat_id;
      if (targetJobId) navigationRef.navigate('Chat', { jobId: targetJobId });
      break;
    case 'ticket_update':
      if (ticket_id) navigationRef.navigate('TicketChat', { ticketId: ticket_id });
      break;
    default:
      break;
  }
}
