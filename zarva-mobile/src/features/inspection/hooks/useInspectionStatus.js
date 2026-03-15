/**
 * src/features/inspection/hooks/useInspectionStatus.js
 * Firebase Realtime Database listener for live job status updates.
 *
 * Listens to:
 *   active_jobs/{jobId}             → job status, timestamps, chat unread
 *   active_jobs/{jobId}/chat_unread/worker → worker's unread chat badge
 *
 * On status change:
 *   - Updates useInspectionStore.jobStatus
 *   - Syncs useWorkerStore.activeJob so the worker's Home screen also updates
 *
 * ZCAP principle: Firebase is only a real-time mirror.
 *   Source of truth is MySQL. This hook only reads from Firebase.
 *   Job detail data is fetched from the REST API via fetchActiveJob().
 */
import { useEffect, useCallback } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { db } from '@infra/firebase/app';
import { useInspectionStore } from '../store';
import { useWorkerStore } from '@worker/store';

/**
 * @param {string|number|null} jobId - The active job's ID
 * @param {function} [onStatusChange] - Optional callback fired whenever status changes.
 *                                      Called with (newStatus: string)
 * @returns {{ isListening: boolean }}
 */
export function useInspectionStatus(jobId, onStatusChange) {
  const setJobStatus = useInspectionStore((s) => s.setJobStatus);
  const setChatUnread = useInspectionStore((s) => s.setChatUnread);

  useEffect(() => {
    if (!jobId) return;

    // ── 1. Listen to job status ──────────────────────────────────────────
    const jobRef = ref(db, `active_jobs/${jobId}`);
    const jobListener = onValue(jobRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      if (data.status) {
        setJobStatus(data.status);

        // Keep the global worker store in sync so WorkerHomeScreen
        // can show the correct active-job badge without a separate fetch.
        const workerStore = useWorkerStore.getState();
        const currentActiveJob = workerStore.activeJob;
        if (currentActiveJob && String(currentActiveJob.id) === String(jobId)) {
          workerStore.setActiveJob({ ...currentActiveJob, status: data.status });
        }

        if (onStatusChange) {
          onStatusChange(data.status);
        }
      }
    });

    // ── 2. Listen to worker chat unread badge ────────────────────────────
    const chatRef = ref(db, `active_jobs/${jobId}/chat_unread/worker`);
    const chatListener = onValue(chatRef, (snapshot) => {
      setChatUnread(snapshot.val() ?? 0);
    });

    return () => {
      off(jobRef, 'value', jobListener);
      off(chatRef, 'value', chatListener);
    };
  }, [jobId, setJobStatus, setChatUnread, onStatusChange]);

  return { isListening: Boolean(jobId) };
}

/**
 * Standalone fetch helper — fetches the full job object from the REST API
 * and populates the inspection store. Used on mount and after each action.
 *
 * @param {string|number} jobId
 * @param {object} apiClient - The axios instance from @infra/api/client
 * @returns {Promise<object|null>} The job object, or null on error
 */
export async function fetchActiveJob(jobId, apiClient) {
  const { setLoading, setActiveJob, setEndOtp, setInspectExtRequested, setInspectionExtOtp } =
    useInspectionStore.getState();

  setLoading(true);
  try {
    const res = await apiClient.get(`/api/worker/jobs/${jobId}`);
    const job = res.data?.job;
    if (!job) return null;

    setActiveJob(job);
    if (job.end_otp) setEndOtp(job.end_otp);

    const hasExtPending = Boolean(job.inspection_extension_otp_hash);
    setInspectExtRequested(hasExtPending);

    // If an extension was previously requested, try to recover its OTP
    if (hasExtPending) {
      try {
        const extRes = await apiClient.get(
          `/api/worker/jobs/${jobId}/inspection/extension-otp`,
          { useLoader: false }
        );
        if (extRes.data?.otp) setInspectionExtOtp(extRes.data.otp);
      } catch {
        // Extension OTP recovery is best-effort
      }
    }

    return job;
  } catch (err) {
    console.error('[useInspectionStatus] fetchActiveJob failed:', err?.message);
    return null;
  } finally {
    setLoading(false);
  }
}
