/**
 * src/features/auth/store.js
 * ZARVA Auth Store — Zustand
 *
 * State owns:
 *   - isAuthenticated flag
 *   - user object (id, name, phone, role, photo_url, kyc_status, etc.)
 *   - JWT token (kept in memory only — persisted version goes to SecureStore via apiClient interceptors)
 *   - active_role: 'customer' | 'worker' | null (null → show RoleSelection)
 *   - isLoading (used during token hydration on app start)
 *
 * Token persistence strategy (ZCAP Secrets Rule):
 *   The raw JWT is NOT stored in AsyncStorage.
 *   apiClient interceptors write/read from expo-secure-store.
 *   This store holds the in-memory copy for immediate access.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // ── State ──────────────────────────────────────────────────────────
      isAuthenticated: false,
      token: null,
      user: null,

      /**
       * active_role — the role the user is currently acting as.
       * null = hasn't picked a role yet → RootNavigator shows RoleSelection.
       * 'customer' | 'worker'
       */
      activeRole: null,

      /** True while the app is bootstrapping and checking token validity */
      isLoading: true,

      // ── Actions ─────────────────────────────────────────────────────────

      /**
       * Called after successful OTP verification.
       * Stores user + token; sets isAuthenticated.
       * active_role is NOT set here — the RoleSelection screen sets it.
       */
      login: (user, token) => {
        set({
          isAuthenticated: true,
          user,
          token,
          // If the user only has one role, pre-select it
          activeRole: user?.active_role || null,
          isLoading: false,
        });
      },

      /**
       * Set (or change) the active role.
       * Called from RoleSelection screen and after deeplink navigation.
       */
      setActiveRole: (role) => set({ activeRole: role }),

      /**
       * Update the user object (e.g. after profile edits).
       */
      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : partial,
        })),

      /**
       * Full sign-out: clears all auth state.
       * apiClient interceptors must also clear SecureStore token separately.
       */
      logout: () =>
        set({
          isAuthenticated: false,
          token: null,
          user: null,
          activeRole: null,
          isLoading: false,
        }),

      /**
       * Called on app start after SecureStore hydration.
       * Marks loading as done regardless of outcome.
       */
      setLoading: (val) => set({ isLoading: val }),

      /**
       * Replaces the in-memory token (e.g. after a token refresh).
       */
      setToken: (token) => set({ token }),
    }),
    {
      name: 'zarva-auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist non-sensitive fields. Token is handled by SecureStore separately.
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        activeRole: state.activeRole,
        // NOTE: token is NOT persisted here — it's in SecureStore
      }),
    }
  )
);
