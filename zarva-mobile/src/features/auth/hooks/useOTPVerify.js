/**
 * src/features/auth/hooks/useOTPVerify.js
 * Hook encapsulating the full OTP verification flow from OTPScreen.
 *
 * Supports 3 verification paths:
 *   1. whatsapp  → POST /api/whatsapp/verify-otp
 *   2. Server test flow (confirmation._isServerTestFlow === true)
 *              → POST /api/auth/dev-otp/verify
 *   3. Real Firebase → confirmation.confirm(code) → getIdToken → POST /api/auth/verify-otp
 *
 * Returns:
 *   { digits, setDigit, loading, errorMsg, verify, resend, clearError }
 */
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { getAuth, signInWithPhoneNumber } from '@react-native-firebase/auth';
import apiClient from '@infra/api/client';
import { useAuthStore } from '../store';
import { useOtpStore } from '../otpStore';

const BOX_COUNT = 6;

export function useOTPVerify(phone, authMethod = 'sms') {
  const [digits, setDigits] = useState(Array(BOX_COUNT).fill(''));
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const login = useAuthStore((s) => s.login);

  const setDigit = useCallback(
    (index, value) => {
      const digit = value.replace(/[^0-9]/g, '').slice(-1);
      setDigits((prev) => {
        const next = [...prev];
        next[index] = digit;
        return next;
      });
    },
    []
  );

  const clearDigits = useCallback(() => setDigits(Array(BOX_COUNT).fill('')), []);
  const clearError = useCallback(() => setErrorMsg(null), []);

  const showInvalidOTP = useCallback(
    (msg) => {
      setErrorMsg(msg || 'Incorrect OTP. Please try again.');
      clearDigits();
    },
    [clearDigits]
  );

  /**
   * Verify the entered OTP code.
   * @param {string} [codeOverride] - Pass the full code directly (e.g. on auto-fill)
   * @returns {Promise<boolean>} true on success
   */
  const verify = useCallback(
    async (codeOverride) => {
      const code = codeOverride || digits.join('');
      if (code.length < BOX_COUNT) return false;

      setLoading(true);
      setErrorMsg(null);

      try {
        // ── Path 1: WhatsApp OTP ───────────────────────────────────────
        if (authMethod === 'whatsapp') {
          const res = await apiClient.post('/api/whatsapp/verify-otp', { phone, otp: code });
          login(res.data.user, res.data.token);
          return true;
        }

        // ── Path 2 & 3: SMS / Firebase ────────────────────────────────
        const confirmation = useOtpStore.getState().confirmationObj;

        if (!confirmation) {
          Alert.alert('Session Expired', 'Please go back and request a new OTP.');
          return false;
        }

        // ── Path 2: Server test number flow ───────────────────────────
        if (confirmation._isServerTestFlow) {
          try {
            const res = await apiClient.post('/api/auth/dev-otp/verify', {
              phone: confirmation.phone || phone,
              otp: code,
            });
            login(res.data.user, res.data.token);
            return true;
          } catch (serverErr) {
            if (serverErr?.response?.data?.code === 'INVALID_OTP') {
              showInvalidOTP();
            } else {
              setErrorMsg(serverErr?.response?.data?.message || 'Verification failed.');
            }
            return false;
          }
        }

        // ── Path 3: Real Firebase confirmation ────────────────────────
        let firebaseIdToken = null;
        try {
          const credential = await confirmation.confirm(code);
          firebaseIdToken = await credential.user.getIdToken(true);
        } catch (confirmErr) {
          const isInvalid =
            confirmErr.code === 'auth/invalid-verification-code' ||
            confirmErr.message?.toLowerCase().includes('invalid');
          if (isInvalid) {
            showInvalidOTP();
          } else {
            setErrorMsg(confirmErr.message || 'Verification error. Please try again.');
          }
          return false;
        }

        const res = await apiClient.post('/api/auth/verify-otp', {
          phone,
          firebase_id_token: firebaseIdToken,
        });
        login(res.data.user, res.data.token);
        return true;
      } catch (err) {
        console.error('[useOTPVerify] Unexpected error:', err?.response?.data || err.message);
        setErrorMsg(err?.response?.data?.message || 'OTP verification failed. Please try again.');
        clearDigits();
        return false;
      } finally {
        setLoading(false);
      }
    },
    [phone, authMethod, digits, login, showInvalidOTP, clearDigits]
  );

  /**
   * Resend OTP on the same method.
   */
  const resend = useCallback(async () => {
    const confirmation = useOtpStore.getState().confirmationObj;
    try {
      if (authMethod === 'whatsapp') {
        await apiClient.post('/api/whatsapp/send-otp', { phone });
      } else if (confirmation?._isServerTestFlow) {
        await apiClient.post('/api/auth/dev-otp/send', { phone });
        // sentinel stays in place — no change needed
      } else {
        const authInstance = getAuth();
        const newConfirmation = await signInWithPhoneNumber(authInstance, phone);
        useOtpStore.getState().setConfirmationObj(newConfirmation);
      }
    } catch (e) {
      console.error('[useOTPVerify] Resend failed:', e);
      Alert.alert('Resend Failed', 'Could not resend OTP. Please try again.');
    }
    clearDigits();
    setErrorMsg(null);
  }, [phone, authMethod, clearDigits]);

  return {
    digits,
    setDigit,
    code: digits.join(''),
    isComplete: digits.join('').length === BOX_COUNT,
    loading,
    errorMsg,
    verify,
    resend,
    clearError,
    clearDigits,
  };
}
