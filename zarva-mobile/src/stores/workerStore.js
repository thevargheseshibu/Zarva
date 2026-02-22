/**
 * src/stores/workerStore.js
 */
import { create } from 'zustand';

export const useWorkerStore = create((set) => ({
    workerProfile: null,
    isOnline: false,
    isAvailable: false,
    earnings: { today: 0, week: 0, total: 0 },
    pendingJobAlert: null,
    activeJob: null,

    setOnline: (val) => set({ isOnline: val }),
    setAvailable: (val) => set({ isAvailable: val }),
    setWorkerProfile: (profile) => set({ workerProfile: profile }),
    setEarnings: (data) => set({ earnings: data }),
    setPendingJobAlert: (alert) => set({ pendingJobAlert: alert }),
    setActiveJob: (job) => set({ activeJob: job })
}));
