/**
 * src/stores/uiStore.js
 * 
 * Global UI states like loading, alerts, and sheets.
 */
import { create } from 'zustand';

export const useUIStore = create((set) => ({
    isLoading: false,
    loadingMessage: 'Processing...',


    isNetConnected: true,
    isServerUp: true,

    /**
     * Shows a global blocking loader
     * @param {string} message - Message to display
     */
    showLoader: (message = 'Processing...') =>
        set({ isLoading: true, loadingMessage: message }),

    /**
     * Hides the global loader
     */
    hideLoader: () => set({ isLoading: false }),

    /**
     * Sets the internet connection status
     * @param {boolean} val 
     */
    setNetConnected: (val) => set({ isNetConnected: val }),

    /**
     * Sets the server status
     * @param {boolean} val 
     */
    setServerUp: (val) => set({ isServerUp: val }),
}));

