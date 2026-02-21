/**
 * src/stores/jobStore.js
 */
import { create } from 'zustand';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../utils/firebase';
import * as Notifications from 'expo-notifications';

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
    canMinimize: false,     // Toggles UI minimize state after 5 sec
    jobHistory: [],

    setActiveJob: (job) => set({ activeJob: job }),
    setSearchPhase: (phase) => set({ searchPhase: phase }),
    setCanMinimize: (val) => set({ canMinimize: val }),
    clearActiveJob: () => set({ activeJob: null, searchPhase: null, canMinimize: false }),
    setJobHistory: (history) => set({ jobHistory: history }),

    startListening: (jobId) => {
        // Stop any existing listener
        get().stopListening();

        const jobRef = ref(db, `active_jobs/${jobId}`);
        firebaseJobRefVal = jobRef;

        firebaseListenerRef = onValue(jobRef, async (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

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
                    await Notifications.scheduleNotificationAsync({
                        content: { title, body },
                        trigger: null, // Send immediately
                    });
                }

                // If terminal state, auto-clear after 10s is handled by the UI
                if (['completed', 'cancelled', 'no_worker_found'].includes(newPhase)) {
                    get().stopListening();
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
