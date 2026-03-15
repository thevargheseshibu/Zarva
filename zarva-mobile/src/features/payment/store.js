/**
 * src/features/payment/store.js
 * Zustand store for the payment feature.
 *
 * State owns:
 *   - The current invoice being displayed
 *   - Payment status (idle | loading | success | error)
 *   - Wallet balances (advance paid, any credits)
 *   - A double-payment guard flag (prevents concurrent payment calls)
 *
 * API contracts (from PaymentScreen):
 *   GET  /api/payment/invoice/:jobId       → { data: { invoice_number, actual_hours, invoice_breakdown } }
 *   POST /api/payment/finalize-mock        → complete payment (dev stub)
 *   POST /api/payment/cash-confirm         → mark cash payment received
 *   GET  /api/wallet/balance               → { balance, currency }
 */
import { create } from 'zustand';

export const usePaymentStore = create((set, get) => ({
  // ── Current Invoice ────────────────────────────────────────────────────
  invoice: null,
  isFetchingInvoice: false,
  invoiceError: null,

  // ── Payment State ──────────────────────────────────────────────────────
  /** 'idle' | 'loading' | 'success' | 'error' */
  paymentStatus: 'idle',
  paymentError: null,

  /**
   * Anti-pattern guard: prevents double-tap on "Pay Now" from firing twice.
   * Managed as a ref-equivalent in the store so it persists across renders.
   */
  isConfirming: false,

  // ── Wallet ─────────────────────────────────────────────────────────────
  walletBalance: 0,
  walletCurrency: 'INR',
  isFetchingWallet: false,

  // ──────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ──────────────────────────────────────────────────────────────────────

  setInvoice: (inv) => set({ invoice: inv, invoiceError: null }),
  setFetchingInvoice: (val) => set({ isFetchingInvoice: val }),
  setInvoiceError: (err) => set({ invoiceError: err }),

  setPaymentStatus: (status) => set({ paymentStatus: status }),
  setPaymentError: (err) => set({ paymentError: err }),

  /** Atomically claim the payment slot — returns false if already claimed */
  claimPaymentSlot: () => {
    if (get().isConfirming) return false;
    set({ isConfirming: true, paymentStatus: 'loading', paymentError: null });
    return true;
  },
  releasePaymentSlot: () => set({ isConfirming: false }),

  setWalletBalance: (balance, currency = 'INR') =>
    set({ walletBalance: balance, walletCurrency: currency }),
  setFetchingWallet: (val) => set({ isFetchingWallet: val }),

  /** Full reset called after navigation away from payment screen */
  reset: () =>
    set({
      invoice: null,
      isFetchingInvoice: false,
      invoiceError: null,
      paymentStatus: 'idle',
      paymentError: null,
      isConfirming: false,
    }),
}));
