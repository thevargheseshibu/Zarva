/**
 * src/features/jobs/hooks/useJobFirebase.js
 * Firebase Realtime Database listener for customer-side job status updates.
 *
 * Listens to:
 *   active_jobs/{jobId}                    → status, worker data, worker GPS
 *   active_jobs/{jobId}/chat_unread/customer → customer's unread chat badge
 *
 * On any change:
 *   - Updates useJobStore.searchPhase and assignedWorker
 *   - Calls optional onStatusChange callback (for screen-level re-fetches)
 *   - Pushes worker GPS to WebView map via mapRef.injectJavaScript
 *
 * ZCAP principle: Firebase is the real-time mirror only.
 *   Full job data always comes from REST API; Firebase just triggers UI updates.
 */
import { useEffect, useRef, useCallback } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { db } from '@infra/firebase/app';
import { useJobStore } from '../store';

/**
 * @param {string|number|null} jobId
 * @param {object} options
 * @param {function} [options.onStatusChange]     - Called with (newStatus: string) on change
 * @param {function} [options.onWorkerLocationUpdate] - Called with ({lat, lng}) on GPS update
 * @param {function} [options.onChatUnread]       - Called with (count: number)
 * @param {React.RefObject} [options.mapRef]      - WebView ref for map injection
 */
export function useJobFirebase(jobId, options = {}) {
  const { onStatusChange, onWorkerLocationUpdate, onChatUnread, mapRef } = options;
  const onFirebaseUpdate = useJobStore((s) => s.onFirebaseUpdate);
  const setListening = useJobStore((s) => s.setListening);

  // Keep mutable callback refs so we never stale-close over them
  const onStatusChangeRef = useRef(onStatusChange);
  const onWorkerLocationRef = useRef(onWorkerLocationUpdate);
  const onChatUnreadRef = useRef(onChatUnread);

  useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);
  useEffect(() => { onWorkerLocationRef.current = onWorkerLocationUpdate; }, [onWorkerLocationUpdate]);
  useEffect(() => { onChatUnreadRef.current = onChatUnread; }, [onChatUnread]);

  useEffect(() => {
    if (!jobId) return;
    setListening(true);

    // ── 1. Main job listener ─────────────────────────────────────────────
    const jobRef = ref(db, `active_jobs/${jobId}`);
    const jobListener = onValue(jobRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      // Update store
      const worker = data.worker_id
        ? {
            id: data.worker_id,
            name: data.worker_name,
            rating: data.worker_rating,
            photo: data.worker_photo,
            lat: data.worker_lat,
            lng: data.worker_lng,
            phone: data.worker_phone,
          }
        : null;

      // Pass wave_number to the store so the UI updates
      onFirebaseUpdate({ status: data.status, worker, waveNumber: data.wave_number });

      // Notify screen for status-specific re-fetches
      if (data.status && onStatusChangeRef.current) {
        onStatusChangeRef.current(data.status);
      }

      // Worker GPS push to WebView map
      if (data.worker_lat && data.worker_lng) {
        const lat = data.worker_lat;
        const lng = data.worker_lng;

        if (onWorkerLocationRef.current) {
          onWorkerLocationRef.current({ lat, lng });
        }

        if (mapRef?.current) {
          mapRef.current.injectJavaScript(
            `(function(){
              var e=new MessageEvent('message',{data:JSON.stringify({type:'UPDATE_WORKER',lat:${lat},lng:${lng}})});
              document.dispatchEvent(e);
              window.dispatchEvent(e);
            })(); true;`
          );
        }
      }
    });

    // ── 2. Chat unread badge ─────────────────────────────────────────────
    const chatRef = ref(db, `active_jobs/${jobId}/chat_unread/customer`);
    const chatListener = onValue(chatRef, (snapshot) => {
      const count = snapshot.val() ?? 0;
      if (onChatUnreadRef.current) onChatUnreadRef.current(count);
    });

    return () => {
      off(jobRef, 'value', jobListener);
      off(chatRef, 'value', chatListener);
      setListening(false);
    };
  }, [jobId, onFirebaseUpdate, setListening]);

  return { isListening: Boolean(jobId) };
}
