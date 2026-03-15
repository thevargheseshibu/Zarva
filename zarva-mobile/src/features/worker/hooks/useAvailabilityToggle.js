/**
 * src/features/worker/hooks/useAvailabilityToggle.js
 * Toggle the worker's online/offline status.
 *
 * Business rules (from WorkerHomeScreen):
 *   - PUT /api/worker/availability { is_online, is_available }
 *   - Server returns the updated is_online and is_available values (source of truth)
 *   - If the call fails, trigger a data reload to revert to DB state
 *   - Haptic feedback on successful toggle ON
 */
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import apiClient from '@infra/api/client';
import { useWorkerStore } from '@worker/store';

export function useAvailabilityToggle() {
  const isOnline = useWorkerStore((s) => s.isOnline);
  const setOnline = useWorkerStore((s) => s.setOnline);
  const setAvailable = useWorkerStore((s) => s.setAvailable);
  const [toggling, setToggling] = useState(false);

  /**
   * Toggle the worker's online status.
   * @param {boolean} val - The desired new state
   * @param {function} [onError] - Optional callback to reload data on failure
   */
  const toggleOnline = useCallback(
    async (val, onError) => {
      if (toggling) return;
      setToggling(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        const res = await apiClient.put('/api/worker/availability', {
          is_online: val,
          is_available: val,
        });

        // Use server's response as source of truth
        const serverOnline = typeof res.data?.is_online === 'boolean' ? res.data.is_online : val;
        const serverAvailable = typeof res.data?.is_available === 'boolean' ? res.data.is_available : val;

        setOnline(serverOnline);
        setAvailable(serverAvailable);

        if (val) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (err) {
        const errMsg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          'Failed to update your online status.';

        Alert.alert(
          val ? 'Cannot Go Online' : 'Cannot Go Offline',
          errMsg
        );

        // Reload from server to revert UI to actual DB state
        if (onError) onError();
      } finally {
        setToggling(false);
      }
    },
    [toggling, setOnline, setAvailable]
  );

  return {
    isOnline,
    toggling,
    toggleOnline,
  };
}
