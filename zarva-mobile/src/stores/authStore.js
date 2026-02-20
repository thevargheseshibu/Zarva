/**
 * src/stores/authStore.js
 */
import { create } from 'zustand';

export const useAuthStore = create((set) => ({
    user: null,
    token: null,
    isAuthenticated: false,

    login: (user, token) => set({ user, token, isAuthenticated: true }),
    logout: () => set({ user: null, token: null, isAuthenticated: false }),
    setUser: (user) => set({ user }),
}));
