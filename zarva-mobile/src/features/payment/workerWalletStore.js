/**
 * src/stores/workerWalletStore.js
 * Zustand store for worker wallet state.
 */

import { create } from 'zustand';
import * as walletApi from '@payment/api';

export const useWorkerWalletStore = create((set, get) => ({
    availablePaise: 0,
    pendingPaise: 0,
    totalPaise: 0,
    transactions: [],
    withdrawals: [],
    bankAccounts: [],
    loading: false,
    error: null,

    fetchBalance: async () => {
        set({ loading: true, error: null });
        try {
            const res = await walletApi.getWorkerBalance();
            const d = res.data;
            set({
                availablePaise: d.available_paise ?? 0,
                pendingPaise: d.pending_paise ?? 0,
                totalPaise: d.total_paise ?? 0,
                loading: false,
                error: null
            });
        } catch (err) {
            set({ loading: false, error: err?.response?.data?.message || err.message });
        }
    },

    fetchTransactions: async (params) => {
        set({ loading: true, error: null });
        try {
            const res = await walletApi.getWorkerTransactions(params);
            set({ transactions: res.data?.transactions ?? [], loading: false, error: null });
        } catch (err) {
            set({ loading: false, error: err?.response?.data?.message || err.message });
        }
    },

    fetchWithdrawals: async () => {
        set({ loading: true, error: null });
        try {
            const res = await walletApi.getWorkerWithdrawals();
            set({ withdrawals: res.data?.withdrawals ?? [], loading: false, error: null });
        } catch (err) {
            set({ loading: false, error: err?.response?.data?.message || err.message });
        }
    },

    fetchBankAccounts: async () => {
        set({ loading: true, error: null });
        try {
            const res = await walletApi.listBankAccounts();
            set({ bankAccounts: res.data?.bank_accounts ?? [], loading: false, error: null });
        } catch (err) {
            set({ loading: false, error: err?.response?.data?.message || err.message });
        }
    },

    requestWithdrawal: async (amountPaise, bankAccountId, payoutMethod) => { // ⭐ New
        const idempotencyKey = `withdraw_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        return walletApi.withdraw(amountPaise, bankAccountId, payoutMethod, idempotencyKey);
    },

    clearError: () => set({ error: null })
}));
