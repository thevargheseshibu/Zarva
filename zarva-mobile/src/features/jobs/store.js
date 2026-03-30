/**
 * src/features/jobs/store.js
 * Zustand store for the customer jobs / job-lifecycle feature.
 *
 * State owns:
 *   - The current job being posted (post-flow form data)
 *   - The active job the customer is tracking (id, status, worker)
 *   - The real-time search phase (searching → assigned → in_progress → completed)
 *   - The assigned worker object (shown on JobStatusDetailScreen)
 *   - Firebase listener handles (managed externally via useJobFirebase hook)
 *
 * This store is the single source of truth for the customer-facing job lifecycle.
 * The worker-facing equivalent is useInspectionStore.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useJobStore = create(
  persist(
    (set, get) => ({
      // ── Active Job Tracking ────────────────────────────────────────────
      /** The jobId the customer is currently watching */
      activeJobId: null,

      /**
       * Current search/job phase from Firebase:
       * 'searching' | 'assigned' | 'worker_en_route' | 'worker_arrived'
       * | 'inspection_active' | 'estimate_submitted' | 'in_progress'
       * | 'pending_completion' | 'completed' | 'cancelled' | 'no_worker_found'
       */
      searchPhase: null,

      /** Worker object assigned to the active job { id, name, rating, photo, lat, lng, phone } */
      assignedWorker: null,

      /** Whether the Firebase listener is currently active */
      isListening: false,

      // ── Job Post Form (multi-step form cache) ─────────────────────────
      postDraft: {
        category: null,
        categoryIcon: null,
        description: '',
        address: '',
        latitude: null,
        longitude: null,
        images: [],           // array of local image URIs before upload
        imageUrls: [],        // array of uploaded image URLs from server
        urgency: 'normal',    // 'normal' | 'emergency'
        scheduled_at: null,   // ISO datetime or null (null = ASAP)
      },

      // ── Recent Jobs (for history tab) ─────────────────────────────────
      recentJobIds: [],

      /** UI State for Searching screen */
      canMinimize: false,
      waveNumber: 1,

      // ──────────────────────────────────────────────────────────────────
      // ACTIONS
      // ──────────────────────────────────────────────────────────────────

      setActiveJobId: (id) => set({ activeJobId: id }),
      setActiveJob: ({ id, category }) => set({ 
        activeJobId: id, 
        searchPhase: 'searching',
        canMinimize: false,
        waveNumber: 1
      }),

      setCanMinimize: (val) => set({ canMinimize: val }),
      setWaveNumber: (num) => set({ waveNumber: num }),

      setSearchPhase: (phase) => set({ searchPhase: phase }),

      setAssignedWorker: (worker) => set({ assignedWorker: worker }),

      setListening: (val) => set({ isListening: val }),

      /**
       * Called by useJobFirebase when the real-time snapshot fires.
       * Updates both phase and worker if present.
       */
      onFirebaseUpdate: ({ status, worker, waveNumber }) => {
        set((state) => ({
          searchPhase: status ?? state.searchPhase,
          assignedWorker: worker ?? state.assignedWorker,
          waveNumber: waveNumber ?? state.waveNumber,
        }));
      },

      /**
       * Start listening — convenience method, actual Firebase setup is
       * in useJobFirebase (keeps store pure).
       */
      startListening: (jobId) => {
        set({ activeJobId: jobId, isListening: true });
      },

      stopListening: () => {
        set({ isListening: false });
      },

      clearActiveJob: () => {
        set({
          activeJobId: null,
          searchPhase: null,
          assignedWorker: null,
          isListening: false,
          canMinimize: false,
          waveNumber: 1
        });
      },

      // ── Post form actions ────────────────────────────────────────────
      updatePostDraft: (partial) =>
        set((s) => ({ postDraft: { ...s.postDraft, ...partial } })),

      clearPostDraft: () =>
        set({
          postDraft: {
            category: null,
            categoryIcon: null,
            description: '',
            address: '',
            latitude: null,
            longitude: null,
            images: [],
            imageUrls: [],
            urgency: 'normal',
            scheduled_at: null,
          },
        }),

      addRecentJobId: (id) =>
        set((s) => ({
          recentJobIds: [id, ...s.recentJobIds.filter((jid) => jid !== id)].slice(0, 20),
        })),
    }),
    {
      name: 'zarva-jobs-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist the active job pointer and recent history (not draft)
        activeJobId: state.activeJobId,
        searchPhase: state.searchPhase,
        recentJobIds: state.recentJobIds,
      }),
    }
  )
);
