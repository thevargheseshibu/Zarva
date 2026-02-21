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
