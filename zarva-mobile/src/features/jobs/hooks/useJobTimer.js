/**
 * src/features/jobs/hooks/useJobTimer.js
 * Elapsed time hook for the customer's job detail screen.
 *
 * Mirrors the inspection/in-progress timer used on the worker side,
 * but owned by the jobs feature (customer perspective).
 *
 * Timer rules:
 *   - Runs during 'inspection_active'  → inspection_started_at → now (or ended_at)
 *   - Runs during 'in_progress'        → job_started_at → now - total_paused_seconds
 *   - Frozen when 'work_paused'        → job_started_at → paused_at - total_paused_seconds
 *   - Stops when ended                 → job_started_at → job_ended_at - total_paused_seconds
 */
import { useState, useEffect } from 'react';

const RUNNING_STATUSES = new Set(['inspection_active', 'in_progress']);
const PAUSED_STATUSES = new Set(['work_paused', 'pause_requested', 'resume_requested']);

/**
 * @param {object|null} job - Full job object from GET /api/jobs/:id
 * @param {string} status   - Current job status
 * @returns {{ elapsedSeconds: number, formattedTime: string }}
 */
export function useJobTimer(job, status) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!job) {
      setElapsedSeconds(0);
      return;
    }

    const shouldRun = RUNNING_STATUSES.has(status) || Boolean(job?.job_started_at);
    if (!shouldRun) {
      setElapsedSeconds(0);
      return;
    }

    const compute = () => {
      let total = 0;

      // ── Inspection phase ────────────────────────────────────────────────
      if (job.inspection_started_at) {
        const start = new Date(job.inspection_started_at).getTime();
        const end = job.inspection_ended_at
          ? new Date(job.inspection_ended_at).getTime()
          : Date.now();
        if (status === 'inspection_active' || job.inspection_ended_at) {
          total += Math.max(0, Math.floor((end - start) / 1000));
        }
      }

      // ── In-progress (billable) phase ────────────────────────────────────
      if (job.job_started_at) {
        const start = new Date(job.job_started_at).getTime();
        const pausedMs = parseInt(job.total_paused_seconds || 0, 10) * 1000;

        let end;
        if (PAUSED_STATUSES.has(status) && job.paused_at) {
          end = new Date(job.paused_at).getTime();
        } else if (job.job_ended_at) {
          end = new Date(job.job_ended_at).getTime();
        } else {
          end = Date.now();
        }

        if (status === 'in_progress' || job.job_ended_at) {
          total += Math.max(0, Math.floor((end - start - pausedMs) / 1000));
        }
      }

      setElapsedSeconds(total);
    };

    compute();
    const interval = setInterval(compute, 1000);
    return () => clearInterval(interval);
  }, [job, status]);

  // ── Inspection window expiry countdown ────────────────────────────────────
  const [inspectionExpirySeconds, setInspectionExpirySeconds] = useState(null);
  useEffect(() => {
    if (status !== 'worker_arrived') {
      setInspectionExpirySeconds(null);
      return;
    }
    const expiry = job?.inspection_extended_until || job?.inspection_expires_at;
    if (!expiry) return;

    const expiryMs = new Date(expiry).getTime();
    const tick = () =>
      setInspectionExpirySeconds(Math.max(0, Math.floor((expiryMs - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [status, job?.inspection_expires_at, job?.inspection_extended_until]);

  /**
   * Format seconds into mm:ss or hh:mm:ss.
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
    elapsedSeconds,
    inspectionExpirySeconds,
    formattedElapsed: formatTime(elapsedSeconds),
    formatTime,
  };
}
