/**
 * src/features/payment/hooks/useWalletBalance.js
 * Fetches and manages the customer's wallet balance.
 *
 * API: GET /api/wallet/balance → { balance: number, currency: string }
 *
 * Used on:
 *   - PaymentScreen (shows advance already paid, balance due)
 *   - CustomerHomeScreen wallet widget
 *
 * Also exposes the invoice fetching logic for PaymentScreen so it does
 * not have to call apiClient directly.
 */
import { useCallback } from 'react';
import apiClient from '@infra/api/client';
import { usePaymentStore } from '../store';

export function useWalletBalance() {
  const walletBalance = usePaymentStore((s) => s.walletBalance);
  const walletCurrency = usePaymentStore((s) => s.walletCurrency);
  const isFetchingWallet = usePaymentStore((s) => s.isFetchingWallet);
  const setWalletBalance = usePaymentStore((s) => s.setWalletBalance);
  const setFetchingWallet = usePaymentStore((s) => s.setFetchingWallet);

  const invoice = usePaymentStore((s) => s.invoice);
  const isFetchingInvoice = usePaymentStore((s) => s.isFetchingInvoice);
  const invoiceError = usePaymentStore((s) => s.invoiceError);
  const setInvoice = usePaymentStore((s) => s.setInvoice);
  const setFetchingInvoice = usePaymentStore((s) => s.setFetchingInvoice);
  const setInvoiceError = usePaymentStore((s) => s.setInvoiceError);

  /**
   * Fetch the current wallet balance from the server.
   */
  const fetchWalletBalance = useCallback(async () => {
    setFetchingWallet(true);
    try {
      const res = await apiClient.get('/api/wallet/balance');
      const { balance, currency } = res.data || {};
      setWalletBalance(balance ?? 0, currency ?? 'INR');
    } catch (err) {
      console.error('[useWalletBalance] Failed to fetch wallet balance:', err?.message);
    } finally {
      setFetchingWallet(false);
    }
  }, [setWalletBalance, setFetchingWallet]);

  /**
   * Fetch the invoice for a completed job.
   * @param {string|number} jobId
   * @returns {Promise<object|null>} Invoice data or null on error
   */
  const fetchInvoice = useCallback(
    async (jobId) => {
      setFetchingInvoice(true);
      setInvoiceError(null);
      try {
        const res = await apiClient.get(`/api/payment/invoice/${jobId}`);
        // Server returns invoice in data.data (envelope pattern)
        const inv = res.data?.data || res.data;
        setInvoice(inv);
        return inv;
      } catch (err) {
        const msg = err?.response?.data?.message || 'Unable to fetch invoice details.';
        setInvoiceError(msg);
        console.error('[useWalletBalance] Invoice fetch failed:', err?.message);
        return null;
      } finally {
        setFetchingInvoice(false);
      }
    },
    [setInvoice, setFetchingInvoice, setInvoiceError]
  );

  /**
   * Format a balance amount with currency symbol.
   * @param {number} amount
   * @returns {string}
   */
  const formatBalance = useCallback(
    (amount) => {
      const sym = walletCurrency === 'INR' ? '₹' : walletCurrency;
      return `${sym}${Number(amount).toFixed(2)}`;
    },
    [walletCurrency]
  );

  return {
    walletBalance,
    walletCurrency,
    isFetchingWallet,
    fetchWalletBalance,
    formatBalance,
    // Invoice management (shared here to keep PaymentScreen thin)
    invoice,
    isFetchingInvoice,
    invoiceError,
    fetchInvoice,
  };
}
