/**
 * src/stores/workerStore.js
 */
import { create } from 'zustand';

export const useWorkerStore = create((set) => ({
    workerProfile: null,
    isOnline: false,
    earnings: { today: 0, week: 0, total: 0 },

    setOnline: (val) => set({ isOnline: val }),
    setWorkerProfile: (profile) => set({ workerProfile: profile }),
    setEarnings: (data) => set({ earnings: data }),
}));
