/**
 * src/stores/authStore.js
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useJobStore } from './jobStore';

export const useAuthStore = create(
    persist(
        (set) => ({
            user: null,
            token: null,
            isAuthenticated: false,

            login: (user, token) => set({ user, token, isAuthenticated: true }),
            logout: () => {
                useJobStore.getState().clearActiveJob();
                try {
                    const workerStore = require('./workerStore').useWorkerStore;
                    if (workerStore) {
                        workerStore.getState().setPendingJobAlert(null);
                        workerStore.getState().setOnline(false);
                        workerStore.getState().setLocationOverride(null);
                    }
                } catch (err) {
                    console.warn('Could not clear worker store on logout', err);
                }
                set({ user: null, token: null, isAuthenticated: false });
            },
            setUser: (user) => set({ user }),
        }),
        {
            name: 'zarva-auth-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
