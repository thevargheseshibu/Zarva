/**
 * src/stores/customerWalletStore.js
 * Zustand store for customer wallet (outstanding dues).
 */

import { create } from 'zustand';
import * as walletApi from '../services/api/walletApi';

export const useCustomerWalletStore = create((set, get) => ({
    outstandingPaise: 0,
    transactions: [],
    loading: false,
    error: null,

    fetchOutstanding: async () => {
        set({ loading: true, error: null });
        try {
            const res = await walletApi.getCustomerOutstanding();
            set({ outstandingPaise: res.data?.outstanding_paise ?? 0, loading: false, error: null });
        } catch (err) {
            set({ loading: false, error: err?.response?.data?.message || err.message });
        }
    },

    fetchTransactions: async () => {
        set({ loading: true, error: null });
        try {
            const res = await walletApi.getCustomerTransactions();
            set({ transactions: res.data?.transactions ?? [], loading: false, error: null });
        } catch (err) {
            set({ loading: false, error: err?.response?.data?.message || err.message });
        }
    },

    clearError: () => set({ error: null })
}));
