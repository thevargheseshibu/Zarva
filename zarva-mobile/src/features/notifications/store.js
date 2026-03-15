/**
 * src/features/notifications/store.js
 * Zustand store for the notifications feature.
 *
 * Manages:
 *   - In-app notification history (badge count, list)
 *   - Notification permission state
 *   - Alert visibility (delegated to workerStore for the active alert,
 *     this store tracks history and unread badge)
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useNotificationStore = create(
  persist(
    (set, get) => ({
      // Badge count shown on the bell icon
      unreadCount: 0,

      // Ordered list of received notification entries (most recent first)
      notifications: [],

      // Whether FCM permissions have been granted
      permissionGranted: false,

      // Current FCM device token (updated on registration / refresh)
      fcmToken: null,

      // ── Actions ──────────────────────────────────────────────────────────

      /**
       * Called by fcmHandler when a new message arrives.
       * Prepends the notification to the list and increments badge.
       */
      addNotification: (notif) =>
        set((state) => ({
          notifications: [
            {
              id: notif.id || String(Date.now()),
              title: notif.title || '',
              body: notif.body || '',
              type: notif.type || 'generic',
              data: notif.data || {},
              read: false,
              receivedAt: notif.receivedAt || Date.now(),
            },
            ...state.notifications,
          ].slice(0, 100), // cap list at 100 entries
          unreadCount: state.unreadCount + 1,
        })),

      /**
       * Mark a single notification as read.
       */
      markRead: (id) =>
        set((state) => {
          const notifications = state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          );
          const unreadCount = notifications.filter((n) => !n.read).length;
          return { notifications, unreadCount };
        }),

      /**
       * Mark all notifications as read (e.g., when user opens the list screen).
       */
      markAllRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        })),

      /**
       * Clear all notifications from history.
       */
      clearAll: () => set({ notifications: [], unreadCount: 0 }),

      /**
       * Store the FCM token when registered / refreshed.
       */
      setFcmToken: (token) => set({ fcmToken: token }),

      /**
       * Store permission status.
       */
      setPermissionGranted: (granted) => set({ permissionGranted: granted }),
    }),
    {
      name: 'zarva-notifications-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist the notification list and badge so they survive app restarts
        notifications: state.notifications,
        unreadCount: state.unreadCount,
        permissionGranted: state.permissionGranted,
      }),
    }
  )
);
