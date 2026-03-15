/**
 * src/features/payment/hooks/usePaymentGuard.js
 * Guards against duplicate payment submissions (double-tap, race conditions).
 *
 * Pattern:
 *   1. Call claimSlot() before any payment API call.
 *      Returns false immediately (noop) if a payment is already in flight.
 *   2. Always call releaseSlot() in the finally block.
 *
 * Provides two payment methods matching PaymentScreen:
 *   - payDigital()  → POST /api/payment/finalize-mock (dev) or Razorpay flow (prod)
 *   - payCash()     → POST /api/payment/cash-confirm
 *
 * Returns { loading, payDigital, payCash }
 */
import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import apiClient from '@infra/api/client';
import { usePaymentStore } from '../store';

export function usePaymentGuard(jobId) {
  const claimPaymentSlot = usePaymentStore((s) => s.claimPaymentSlot);
  const releasePaymentSlot = usePaymentStore((s) => s.releasePaymentSlot);
  const paymentStatus = usePaymentStore((s) => s.paymentStatus);
  const setPaymentStatus = usePaymentStore((s) => s.setPaymentStatus);
  const setPaymentError = usePaymentStore((s) => s.setPaymentError);

  const loading = paymentStatus === 'loading';

  /**
   * Digital payment flow.
   * @param {function} onSuccess - Called with no args after server confirms payment
   */
  const payDigital = useCallback(
    async (onSuccess) => {
      if (!claimPaymentSlot()) return; // Double-tap guard
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        await apiClient.post('/api/payment/finalize-mock', { job_id: jobId });
        setPaymentStatus('success');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (onSuccess) onSuccess();
      } catch (err) {
        const msg = err?.response?.data?.message || 'Transaction could not be processed. Please try again.';
        setPaymentError(msg);
        setPaymentStatus('error');
        Alert.alert('Payment Failed', msg);
      } finally {
        releasePaymentSlot();
      }
    },
    [jobId, claimPaymentSlot, releasePaymentSlot, setPaymentStatus, setPaymentError]
  );

  /**
   * Cash payment confirmation flow.
   * Requires user to confirm via Alert before calling the server.
   * @param {function} onSuccess - Called after server confirms
   */
  const payCash = useCallback(
    async (onSuccess) => {
      // Show confirmation dialog first (prevents accidental taps)
      Alert.alert(
        'Confirm Cash Payment',
        'I confirm the service provider has collected the full cash amount.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm Cash Payment',
            style: 'default',
            onPress: async () => {
              if (!claimPaymentSlot()) return;
              try {
                await apiClient.post('/api/payment/cash-confirm', {
                  job_id: jobId,
                  payment_type: 'final',
                });
                setPaymentStatus('success');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                if (onSuccess) onSuccess();
              } catch (err) {
                const msg = err?.response?.data?.message || 'Failed to confirm cash payment.';
                setPaymentError(msg);
                setPaymentStatus('error');
                Alert.alert('Error', msg);
              } finally {
                releasePaymentSlot();
              }
            },
          },
        ]
      );
    },
    [jobId, claimPaymentSlot, releasePaymentSlot, setPaymentStatus, setPaymentError]
  );

  return {
    loading,
    paymentStatus,
    payDigital,
    payCash,
  };
}
