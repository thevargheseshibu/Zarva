/**
 * src/stores/jobStore.js
 */
import { create } from 'zustand';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../utils/firebase';
import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';

// Configure how notifications behave when the app is foregrounded
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

let firebaseListenerRef = null;
let firebaseJobRefVal = null;

export const useJobStore = create((set, get) => ({
    activeJob: null,        // Full job object
    searchPhase: null,      // null | 'searching' | 'assigned' | 'worker_arrived' | 'in_progress' | 'pending_completion' | 'completed' | 'cancelled' | 'no_worker_found'
    assignedWorker: null,   // Holds worker profile assigned via Firebase
    canMinimize: false,     // Toggles UI minimize state after 5 sec
    jobHistory: [],
    waveNumber: 1,          // 1, 2, or 3 from matching engine expansions
    lastKnownLocation: null, // { address, lat, lng }
    locationOverride: null,  // User-picked { address, lat, lng }
    chatUnreadCount: 0,
    activeChatJobId: null,

    setActiveJob: (job) => set({ activeJob: job }),
    setSearchPhase: (phase) => set({ searchPhase: phase }),
    setCanMinimize: (val) => set({ canMinimize: val }),
    clearActiveJob: () => set({ activeJob: null, searchPhase: null, assignedWorker: null, canMinimize: false, jobHistory: [], waveNumber: 1, chatUnreadCount: 0, activeChatJobId: null }),
    setJobHistory: (history) => set({ jobHistory: history }),
    setLocationOverride: (loc) => set({ locationOverride: loc, lastKnownLocation: loc }),
    setLastKnownLocation: (loc) => set({ lastKnownLocation: loc }),
    setActiveChatJobId: (jobId) => set({ activeChatJobId: jobId }),
    clearActiveChatJobId: () => set({ activeChatJobId: null }),
    setChatUnreadCount: (count) => set({ chatUnreadCount: count }),

    startListening: (jobId) => {
        // Stop any existing listener
        get().stopListening();

        const jobRef = ref(db, `active_jobs/${jobId}`);
        firebaseJobRefVal = jobRef;

        firebaseListenerRef = onValue(jobRef, async (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            if (data.worker) {
                set({ assignedWorker: data.worker });
            }

            if (data.wave_number) {
                set({ waveNumber: data.wave_number });
            }

            const prevPhase = get().searchPhase;
            const newPhase = data.status;

            if (newPhase && newPhase !== prevPhase) {
                set({ searchPhase: newPhase });

                let title = '';
                let body = '';

                switch (newPhase) {
                    case 'assigned':
                        title = 'Worker found! 🎉';
                        body = `A worker is on the way for your job.`;
                        break;
                    case 'worker_arrived':
                        title = 'Worker has arrived 📍';
                        body = 'Please provide the start code to begin work.';
                        break;
                    case 'in_progress':
                        title = 'Work started 🔧';
                        body = 'Your service is currently in progress.';
                        break;
                    case 'pending_completion':
                        title = 'Work complete ✅';
                        body = 'Enter the end code to finalize the payment.';
                        break;
                    case 'completed':
                        title = 'Job Completed';
                        body = 'Thank you for using Zarva!';
                        break;
                    case 'cancelled':
                        title = 'Job Cancelled';
                        body = 'This job has been cancelled.';
                        break;
                    case 'no_worker_found':
                        title = 'No worker found 😔';
                        body = 'We could not find a worker nearby. Please try again.';
                        break;
                }

                if (title) {
                    const { status: existingStatus } = await Notifications.getPermissionsAsync();
                    let finalStatus = existingStatus;
                    if (existingStatus !== 'granted') {
                        const { status } = await Notifications.requestPermissionsAsync();
                        finalStatus = status;
                    }

                    if (finalStatus === 'granted') {
                        await Notifications.scheduleNotificationAsync({
                            content: { title, body },
                            trigger: null, // Send immediately
                        });
                    }
                }

                // If terminal state, delay clearing slightly to let UI re-render the final state
                if (['completed', 'cancelled', 'no_worker_found', 'disputed'].includes(newPhase)) {
                    setTimeout(() => {
                        // Check if we haven't started listening to another job in the meantime
                        const currentRef = ref(db, `active_jobs/${jobId}`);
                        if (firebaseJobRefVal?.toString() === currentRef.toString()) {
                            get().stopListening();
                        }
                    }, 5000);
                }
            }
        });
    },

    stopListening: () => {
        if (firebaseJobRefVal && firebaseListenerRef) {
            off(firebaseJobRefVal, 'value', firebaseListenerRef);
            firebaseListenerRef = null;
            firebaseJobRefVal = null;
        }
    }
}));

// Reconnect Firebase listeners when the app returns to foreground (Issue #33)
AppState.addEventListener('change', (nextAppState) => {
    if (nextAppState === 'active') {
        const store = useJobStore.getState();
        if (store.activeJob?.id && store.searchPhase) {
            const phase = store.searchPhase;
            if (!['completed', 'cancelled', 'no_worker_found'].includes(phase)) {
                console.log('[JobStore] App foregrounded. Reconnecting Firebase listener for:', store.activeJob.id);
                store.startListening(store.activeJob.id);
            }
        }
    }
});
