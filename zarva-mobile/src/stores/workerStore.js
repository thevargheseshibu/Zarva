import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useWorkerStore = create(
    persist(
        (set) => ({
            workerProfile: null,
            isOnline: false,
            isAvailable: false,
            earnings: { today: 0, week: 0, total: 0 },
            pendingJobAlert: null,
            isAlertVisible: false,
            activeJob: null,
            locationOverride: null, // { address, lat, lng }

            alertPreferences: {
                soundEnabled: true,
                vibrationEnabled: true,
                dndMode: false,
            },

            setOnline: (val) => set({ isOnline: val }),
            setAvailable: (val) => set({ isAvailable: val }),
            setWorkerProfile: (profile) => set({ workerProfile: profile }),
            setEarnings: (data) => set({ earnings: data }),
            setPendingJobAlert: (jobData) => set({
                pendingJobAlert: jobData,
                isAlertVisible: jobData !== null
            }),
            clearPendingJobAlert: () => set({
                pendingJobAlert: null,
                isAlertVisible: false
            }),
            setActiveJob: (job) => set({ activeJob: job }),
            setLocationOverride: (loc) => set({ locationOverride: loc }),

            updateAlertPrefs: (prefs) => set((state) => ({
                alertPreferences: { ...state.alertPreferences, ...prefs }
            })),
        }),
        {
            name: 'zarva-worker-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                alertPreferences: state.alertPreferences,
                isOnline: state.isOnline, // persist online status for session recovery
                locationOverride: state.locationOverride,
            }),
        }
    )
);
