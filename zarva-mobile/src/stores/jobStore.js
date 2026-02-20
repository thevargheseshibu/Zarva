/**
 * src/stores/jobStore.js
 */
import { create } from 'zustand';

export const useJobStore = create((set) => ({
    activeJob: null,
    jobHistory: [],
    currentSearching: false,

    setActiveJob: (job) => set({ activeJob: job }),
    clearActiveJob: () => set({ activeJob: null }),
    setSearching: (val) => set({ currentSearching: val }),
    setJobHistory: (history) => set({ jobHistory: history }),
}));
