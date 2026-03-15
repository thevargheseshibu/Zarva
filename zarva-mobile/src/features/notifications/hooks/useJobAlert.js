/**
 * src/features/notifications/hooks/useJobAlert.js
 * Hook that exposes pending job alert state and action triggers
 * for consumption by WorkerNavigator and JobAlertBottomSheet.
 *
 * Reads from: useWorkerStore (pendingJobAlert, isAlertVisible, clearPendingJobAlert)
 * Triggers:   JobAlertService.stopAlertLoop on dismiss
 */
import { useCallback } from 'react';
import { useWorkerStore } from '@worker/store';
import { JobAlertService } from '../JobAlertService';
import apiClient from '@infra/api/client';

export function useJobAlert() {
  const pendingJobAlert = useWorkerStore((s) => s.pendingJobAlert);
  const isAlertVisible = useWorkerStore((s) => s.isAlertVisible);
  const clearPendingJobAlert = useWorkerStore((s) => s.clearPendingJobAlert);

  /**
   * Accept the current pending job.
   * Returns { success: boolean, jobId: string?, error: string? }
   */
  const acceptAlert = useCallback(async () => {
    if (!pendingJobAlert?.id) return { success: false, error: 'No alert active' };
    JobAlertService.stopAlertLoop();
    try {
      await apiClient.post(`/api/worker/jobs/${pendingJobAlert.id}/accept`);
      const jobId = pendingJobAlert.id;
      clearPendingJobAlert();
      return { success: true, jobId };
    } catch (err) {
      const status = err.response?.status;
      if (status === 409) {
        clearPendingJobAlert();
        return { success: false, error: 'taken' };
      }
      if (status === 410 || status === 404) {
        clearPendingJobAlert();
        return { success: false, error: 'expired' };
      }
      return { success: false, error: err.response?.data?.message || 'Failed to accept' };
    }
  }, [pendingJobAlert, clearPendingJobAlert]);

  /**
   * Decline the current pending job.
   * @param {boolean} isTimeout - true when called by the countdown timer
   */
  const declineAlert = useCallback(
    async (isTimeout = false) => {
      if (!pendingJobAlert?.id) return;
      JobAlertService.stopAlertLoop();
      try {
        await apiClient.post(`/api/worker/jobs/${pendingJobAlert.id}/decline`, {
          reason: isTimeout ? 'timeout' : 'manual',
        });
      } catch (e) {
        console.warn('[useJobAlert] decline error:', e?.message);
      } finally {
        clearPendingJobAlert();
      }
    },
    [pendingJobAlert, clearPendingJobAlert]
  );

  /**
   * Dismiss without calling the server (e.g., on unmount cleanup).
   */
  const dismissAlert = useCallback(() => {
    JobAlertService.stopAlertLoop();
    clearPendingJobAlert();
  }, [clearPendingJobAlert]);

  /**
   * Calculate how many seconds remain in the accept window.
   * Returns 0 if the window has expired.
   */
  const getRemainingSeconds = useCallback(() => {
    if (!pendingJobAlert) return 0;
    const elapsed = Math.floor((Date.now() - (pendingJobAlert.timestamp || Date.now())) / 1000);
    return Math.max(0, (pendingJobAlert.acceptWindow || 30) - elapsed);
  }, [pendingJobAlert]);

  return {
    pendingJobAlert,
    isAlertVisible,
    acceptAlert,
    declineAlert,
    dismissAlert,
    getRemainingSeconds,
  };
}
