/**
 * src/features/inspection/hooks/useInspectionTimer.js
 * Computes the elapsed billable time for an active job.
 *
 * Timer rules (from ActiveJobScreen business logic):
 *
 *   INSPECTION phase (`inspection_active`):
 *     elapsed = (now - inspection_started_at) — no pause subtraction
 *
 *   IN PROGRESS phase (`in_progress`):
 *     elapsed = (now - job_started_at) - total_paused_seconds
 *
 *   PAUSED (`work_paused`, `pause_requested`, `resume_requested`):
 *     Timer freezes at the moment of pause_started_at.
 *     elapsed = (pause_started_at - job_started_at) - prev_paused_seconds
 *
 *   All other states:
 *     elapsed = 0 (timer not running)
 *
 * The hook returns `timeElapsed` (integer seconds) which updates every second
 * while the relevant statuses are active, and clears the interval on unmount.
 */
import { useState, useEffect } from 'react';
import { useInspectionStore } from '../store';

const RUNNING_STATUSES = new Set(['inspection_active', 'in_progress']);
const PAUSED_STATUSES = new Set(['work_paused', 'pause_requested', 'resume_requested']);

/**
 * @param {object} job - The job object from the server (may be null during loading)
 * @param {string} status - Current job status string
 * @returns {{ timeElapsed: number, formattedTime: string }}
 */
export function useInspectionTimer(job, status) {
  const setTimeElapsed = useInspectionStore((s) => s.setTimeElapsed);
  const [localElapsed, setLocalElapsed] = useState(0);

  useEffect(() => {
    if (!job || !RUNNING_STATUSES.has(status)) {
      setLocalElapsed(0);
      setTimeElapsed(0);
      return;
    }

    const compute = () => {
      let total = 0;

      // ── Inspection phase timer ───────────────────────────────────────────
      if (status === 'inspection_active' && job.inspection_started_at) {
        const start = new Date(job.inspection_started_at).getTime();
        const end = job.inspection_ended_at
          ? new Date(job.inspection_ended_at).getTime()
          : Date.now();
        total += Math.max(0, Math.floor((end - start) / 1000));
      }

      // ── In-progress phase timer ──────────────────────────────────────────
      if (status === 'in_progress' && job.job_started_at) {
        const start = new Date(job.job_started_at).getTime();
        const pausedMs = parseInt(job.total_paused_seconds || 0, 10) * 1000;

        let end;
        if (PAUSED_STATUSES.has(status) && job.paused_at) {
          // Timer frozen at pause moment
          end = new Date(job.paused_at).getTime();
        } else if (job.job_ended_at) {
          end = new Date(job.job_ended_at).getTime();
        } else {
          end = Date.now();
        }

        let rawElapsedMs = end - start - pausedMs;

        // ⭐ NEW: Freeze timer at the estimated cap
        const capMinutes = job.billing_cap_minutes || job.estimated_duration_minutes;
        if (capMinutes > 0) {
            const capMs = capMinutes * 60000;
            if (rawElapsedMs > capMs) {
                rawElapsedMs = capMs; // Timer stops exactly at the limit
            }
        }

        total += Math.max(0, Math.floor(rawElapsedMs / 1000));
      }

      setLocalElapsed(total);
      setTimeElapsed(total);
    };

    compute(); // Run immediately
    const interval = setInterval(compute, 1000);
    return () => clearInterval(interval);
  }, [job, status, setTimeElapsed]);

  // ── Inspection expiry countdown ──────────────────────────────────────────
  const setInspectionExpiry = useInspectionStore((s) => s.setInspectionExpirySeconds);
  useEffect(() => {
    if (status !== 'worker_arrived' || !job?.inspection_expires_at) {
      setInspectionExpiry(null);
      return;
    }
    const expiry = new Date(job.inspection_expires_at).getTime();
    const tick = () => setInspectionExpiry(Math.max(0, Math.floor((expiry - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [status, job?.inspection_expires_at, setInspectionExpiry]);

  // ── Start OTP expiry countdown (1h from generation) ──────────────────────
  const setOtpExpiry = useInspectionStore((s) => s.setOtpExpirySeconds);
  useEffect(() => {
    if (status !== 'estimate_submitted' || !job?.start_otp_generated_at) {
      setOtpExpiry(null);
      return;
    }
    const expiry = new Date(job.start_otp_generated_at).getTime() + 3_600_000; // +1h
    const tick = () => setOtpExpiry(Math.max(0, Math.floor((expiry - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [status, job?.start_otp_generated_at, setOtpExpiry]);

  /**
   * Format seconds into mm:ss or hh:mm:ss string.
   */
  const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(sec).padStart(2, '0');
    return h > 0 ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
  };

  return {
    timeElapsed: localElapsed,
    formattedTime: formatTime(localElapsed),
  };
}
