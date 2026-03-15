/**
 * src/features/worker/hooks/useWorkerStats.js
 * Fetches and manages worker statistics: earnings, job counts, and rating.
 *
 * API contracts (from WorkerHomeScreen):
 *   GET /api/me          → { user: { id, name, profile: { average_rating, is_online, is_available, current_job_id, kyc_status } } }
 *   GET /api/worker/stats → { stats: { today: number, week: number, earnings_today: number } }
 *   GET /api/reviews/worker/:id → { reviews: [], data: { reviews: [] } }
 *
 * Syncs isOnline + isAvailable from server (source of truth) every call.
 */
import { useState, useCallback } from 'react';
import apiClient from '@infra/api/client';
import { useWorkerStore } from '@worker/store';

export function useWorkerStats() {
  const setOnline = useWorkerStore((s) => s.setOnline);
  const setAvailable = useWorkerStore((s) => s.setAvailable);
  const setActiveJob = useWorkerStore((s) => s.setActiveJob);

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [worker, setWorker] = useState({
    id: null,
    name: '',
    rating: 0,
    verified: false,
    photo: null,
  });

  const [stats, setStats] = useState({
    today: 0,
    week: 0,
    earnings_today: 0,
    earnings_week: 0,
    earnings_month: 0,
    total_jobs: 0,
  });

  const [reviews, setReviews] = useState([]);

  const fetchActiveJobById = useCallback(
    async (jobId) => {
      try {
        const res = await apiClient.get(`/api/worker/jobs/${jobId}`);
        if (res.data?.job) setActiveJob(res.data.job);
      } catch (err) {
        console.error('[useWorkerStats] Failed to fetch active job:', err?.message);
      }
    },
    [setActiveJob]
  );

  /**
   * Main load function — fetches /api/me, /api/worker/stats, and reviews.
   * @param {object} options
   * @param {boolean} [options.silent=false] - If true, skip the loading indicator
   */
  const loadStats = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setIsLoading(true);
      setIsRefreshing(true);

      try {
        // Parallel fetch for profile + stats
        const [meRes, statsRes] = await Promise.all([
          apiClient.get('/api/me'),
          apiClient.get('/api/worker/stats'),
        ]);

        let workerId = null;

        if (meRes.data?.user) {
          const u = meRes.data.user;
          workerId = u.id;

          setWorker({
            id: u.id,
            name: u.name || 'Worker',
            rating: parseFloat(u?.profile?.average_rating ?? u.rating) || 0,
            verified:
              (u?.profile?.kyc_status || u.kyc_status) === 'approved',
            photo: u.photo_url || null,
          });

          // Server is source of truth for online/available state
          const isOnline =
            u?.profile?.is_online === true ||
            u?.profile?.is_online === 1 ||
            u.is_online === true ||
            u.is_online === 1;
          const isAvailable =
            u?.profile?.is_available === true ||
            u?.profile?.is_available === 1 ||
            u.is_available === true ||
            u.is_available === 1;

          setOnline(isOnline);
          setAvailable(isAvailable);

          // Sync active job from server's current_job_id
          const currentJobId =
            u?.profile?.current_job_id || u?.current_job_id || null;
          if (currentJobId) {
            await fetchActiveJobById(currentJobId);
          } else {
            setActiveJob(null);
          }
        }

        if (statsRes.data?.stats) {
          const s = statsRes.data.stats;
          setStats({
            today: s.today || 0,
            week: s.week || 0,
            earnings_today: s.earnings_today || 0,
            earnings_week: s.earnings_week || 0,
            earnings_month: s.earnings_month || 0,
            total_jobs: s.total_jobs || 0,
          });
        }

        if (workerId) {
          try {
            const reviewsRes = await apiClient.get(`/api/reviews/worker/${workerId}`);
            // Support both `{ reviews }` and `{ data: { reviews } }` shapes
            const rList =
              reviewsRes.data?.data?.reviews ||
              reviewsRes.data?.reviews ||
              [];
            setReviews(rList);
          } catch (revErr) {
            console.warn('[useWorkerStats] Could not load reviews:', revErr?.message);
          }
        }
      } catch (err) {
        console.error('[useWorkerStats] Failed to load stats:', err?.message);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [setOnline, setAvailable, setActiveJob, fetchActiveJobById]
  );

  return {
    worker,
    stats,
    earningsToday: stats.earnings_today,
    reviews,
    isLoading,
    isRefreshing,
    loadStats,
  };
}
