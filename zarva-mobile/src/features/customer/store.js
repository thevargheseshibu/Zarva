/**
 * src/features/customer/store.js
 * Zustand store for the customer feature.
 *
 * State owns:
 *   - Customer profile (as returned from /api/me for the customer role)
 *   - Customer's address book
 *   - Support ticket state
 *   - Preferences (locale, notifications)
 *
 * The active job link is in useJobStore — this store is profile-level only.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useCustomerStore = create(
  persist(
    (set, get) => ({
      // ── Profile ────────────────────────────────────────────────────────
      profile: null,    // { id, name, email, phone, photo_url, is_verified }
      isLoadingProfile: false,

      // ── Address Book ───────────────────────────────────────────────────
      /**
       * Saved addresses: [{ id, label, address, latitude, longitude, is_default }]
       */
      addresses: [],

      /** Currently selected address for the next job post */
      selectedAddress: null,

      // ── Support ────────────────────────────────────────────────────────
      /** Open support tickets: [{ id, subject, status, last_message_at }] */
      openTickets: [],

      /** Chat history for the support widget (per-ticket) */
      supportChatByTicket: {},

      // ── Preferences ────────────────────────────────────────────────────
      preferences: {
        notificationsEnabled: true,
        locale: 'en',
      },

      // ──────────────────────────────────────────────────────────────────
      // ACTIONS
      // ──────────────────────────────────────────────────────────────────

      setProfile: (p) => set({ profile: p }),
      setLoadingProfile: (v) => set({ isLoadingProfile: v }),
      updateProfile: (partial) =>
        set((s) => ({ profile: s.profile ? { ...s.profile, ...partial } : partial })),

      setAddresses: (list) => set({ addresses: list }),
      addAddress: (addr) =>
        set((s) => ({ addresses: [addr, ...s.addresses] })),
      removeAddress: (id) =>
        set((s) => ({ addresses: s.addresses.filter((a) => a.id !== id) })),
      setSelectedAddress: (addr) => set({ selectedAddress: addr }),

      setOpenTickets: (tickets) => set({ openTickets: tickets }),

      /**
       * Append messages to a specific support ticket's chat history.
       * @param {string} ticketId
       * @param {Array} messages
       */
      appendSupportChat: (ticketId, messages) =>
        set((s) => ({
          supportChatByTicket: {
            ...s.supportChatByTicket,
            [ticketId]: [
              ...(s.supportChatByTicket[ticketId] || []),
              ...messages,
            ],
          },
        })),

      clearSupportChat: (ticketId) =>
        set((s) => {
          const next = { ...s.supportChatByTicket };
          delete next[ticketId];
          return { supportChatByTicket: next };
        }),

      updatePreferences: (partial) =>
        set((s) => ({ preferences: { ...s.preferences, ...partial } })),

      reset: () =>
        set({
          profile: null,
          isLoadingProfile: false,
          addresses: [],
          selectedAddress: null,
          openTickets: [],
          supportChatByTicket: {},
        }),
    }),
    {
      name: 'zarva-customer-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        profile: state.profile,
        addresses: state.addresses,
        selectedAddress: state.selectedAddress,
        preferences: state.preferences,
      }),
    }
  )
);
