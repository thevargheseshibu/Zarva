/**
 * src/features/jobs/hooks/useJobSearch.js
 * Manages the worker search phase after a customer posts a job.
 *
 * Responsibilities:
 *   - POST to /api/jobs to create a new job
 *   - Poll or listen for status changes during the 'searching' phase
 *   - Expose searchPhase, assignedWorker, timeoutReached for the UI
 *   - On successful assignment, navigate to JobStatusDetail
 *
 * NOTE: Real-time updates during the search come via useJobFirebase.
 *       This hook handles the initial post submission and timeout logic.
 */
import { useState, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import apiClient from '@infra/api/client';
import { useJobStore } from '../store';

// Maximum wait time for a worker to be assigned (matches server side SEARCH_TIMEOUT_MINUTES)
const SEARCH_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export function useJobSearch() {
  const {
    searchPhase,
    activeJobId,
    setActiveJobId,
    setSearchPhase,
    clearActiveJob,
    addRecentJobId,
    updatePostDraft,
    clearPostDraft,
    postDraft,
  } = useJobStore();

  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState(null);
  const timeoutRef = useRef(null);

  /**
   * Submit a new job request.
   * @param {object} jobData - Fields from the job posting form
   * @param {object} navigation - React Navigation prop (to navigate after post)
   * @returns {Promise<string|null>} The created jobId or null on failure
   */
  const submitJob = useCallback(
    async (jobData, navigation) => {
      if (isPosting) return null;
      setIsPosting(true);
      setPostError(null);

      try {
        const payload = {
          category: jobData.category,
          description: jobData.description,
          address: jobData.address,
          latitude: jobData.latitude,
          longitude: jobData.longitude,
          image_urls: jobData.imageUrls || [],
          urgency: jobData.urgency || 'normal',
          scheduled_at: jobData.scheduled_at || null,
        };

        const res = await apiClient.post('/api/jobs', payload);
        const jobId = res.data?.job?.id || res.data?.jobId;

        if (!jobId) throw new Error('Server did not return a jobId.');

        setActiveJobId(jobId);
        setSearchPhase('searching');
        addRecentJobId(jobId);
        clearPostDraft();

        // Set search timeout — if no worker is assigned within 15 min, surface an alert
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          const phase = useJobStore.getState().searchPhase;
          if (phase === 'searching') {
            Alert.alert(
              'Search Timeout',
              'We could not find a professional nearby within the time limit. Please try again.',
              [{ text: 'OK' }]
            );
          }
        }, SEARCH_TIMEOUT_MS);

        // Navigate to the live tracking screen
        navigation.replace('JobStatusDetail', { jobId });
        return jobId;
      } catch (err) {
        const msg = err?.response?.data?.message || 'Failed to post job. Please try again.';
        setPostError(msg);
        Alert.alert('Post Failed', msg);
        return null;
      } finally {
        setIsPosting(false);
      }
    },
    [isPosting, setActiveJobId, setSearchPhase, addRecentJobId, clearPostDraft]
  );

  /**
   * Cancel an active search (called if customer backs out while searching).
   */
  const cancelSearch = useCallback(async () => {
    const jobId = useJobStore.getState().activeJobId;
    if (!jobId) return;
    clearTimeout(timeoutRef.current);
    clearActiveJob();
    try {
      await apiClient.post(`/api/jobs/${jobId}/cancel`);
    } catch (e) {
      console.warn('[useJobSearch] cancelSearch failed:', e?.message);
    }
  }, [clearActiveJob]);

  /**
   * Update a field in the job post draft (e.g., when navigating between form steps).
   */
  const updateDraft = useCallback(
    (partial) => updatePostDraft(partial),
    [updatePostDraft]
  );

  return {
    postDraft,
    searchPhase,
    activeJobId,
    isPosting,
    postError,
    submitJob,
    cancelSearch,
    updateDraft,
    clearPostDraft,
  };
}
