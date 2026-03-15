/**
 * src/features/auth/hooks/usePhoneLogin.js
 * Hook encapsulating the full OTP send flow from PhoneScreen.
 *
 * Supports 3 send methods:
 *   1. whatsapp  → POST /api/whatsapp/send-otp (handled entirely on server)
 *   2. sms       → Firebase signInWithPhoneNumber (real device)
 *                  Falls back to /api/auth/dev-otp/send for test numbers
 *
 * Returns:
 *   { phone, setPhone, formattedPhone, isReady, loading, sendOTP }
 */
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { getAuth, signInWithPhoneNumber } from '@react-native-firebase/auth';
import apiClient from '@infra/api/client';
import { useAuthStore } from '../store';
import { useOtpStore } from '../otpStore';

let _firebaseAuth = null;
function getFirebaseAuth() {
  if (!_firebaseAuth) {
    _firebaseAuth = getAuth();
  }
  return _firebaseAuth;
}

export function usePhoneLogin() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(null); // null | 'whatsapp' | 'sms'
  const login = useAuthStore((s) => s.login);

  // Format display: XXX-XXX-XXXX
  const formattedPhone = phone.replace(
    /(\d{3})(\d{1,3})?(\d{1,4})?/,
    (_, p1, p2, p3) => {
      let res = p1;
      if (p2) res += '-' + p2;
      if (p3) res += '-' + p3;
      return res;
    }
  );

  const isReady = phone.length === 10;

  /**
   * Send OTP via the specified method.
   * @param {'whatsapp' | 'sms'} method
   * @param {object} navigation - React Navigation navigation prop
   */
  const sendOTP = useCallback(
    async (method, navigation) => {
      if (!isReady || loading) return;
      setLoading(method);

      const fullPhone = `+91${phone}`;

      try {
        if (method === 'whatsapp') {
          // ── WhatsApp Path ─────────────────────────────────────────────
          const res = await apiClient.post('/api/whatsapp/send-otp', { phone: fullPhone });

          // Dev bypass: some test environments return bypassed: true with a dummy OTP
          if (res.data?.bypassed) {
            const verifyRes = await apiClient.post('/api/whatsapp/verify-otp', {
              phone: fullPhone,
              otp: '000000',
            });
            login(verifyRes.data.user, verifyRes.data.token);
            return;
          }

          useOtpStore.getState().setConfirmationObj(null);
          navigation.navigate('OTP', { phone: fullPhone, authMethod: 'whatsapp' });
          return;
        }

        // ── SMS / Firebase Path ─────────────────────────────────────────
        let confirmationObj = null;

        try {
          const authInstance = getFirebaseAuth();
          confirmationObj = await signInWithPhoneNumber(authInstance, fullPhone);
        } catch (firebaseErr) {
          console.error('[Firebase OTP Error]', firebaseErr.code);

          // Ask server if this is a known test number
          let isTestNumber = false;
          try {
            const checkRes = await apiClient.post('/api/auth/dev-otp/send', { phone: fullPhone });
            isTestNumber = checkRes.data?.isTestNumber === true;
          } catch (serverCheckErr) {
            console.error('[dev-otp/send] Server check failed:', serverCheckErr.message);
          }

          if (isTestNumber) {
            // Use server-side test flow sentinel
            confirmationObj = { _isServerTestFlow: true, phone: fullPhone };
          } else {
            // Real number, real failure — show user-readable message
            const errorMessages = {
              'auth/too-many-requests': 'Too many OTP attempts. Please wait a few minutes.',
              'auth/invalid-phone-number': 'This phone number is not valid.',
              'auth/missing-client-identifier': 'App verification failed. Please try again.',
            };
            const msg = errorMessages[firebaseErr.code] || 'Failed to send OTP. Please try again.';
            Alert.alert('OTP Error', msg);
            return;
          }
        }

        useOtpStore.getState().setConfirmationObj(confirmationObj);

        // Only navigate if not already logged in (handles race conditions)
        const authState = useAuthStore.getState();
        if (!authState.isAuthenticated) {
          navigation.navigate('OTP', { phone: fullPhone, authMethod: 'sms' });
        }
      } catch (err) {
        console.error('[usePhoneLogin] Unexpected error:', err);
        Alert.alert('Error', 'Something went wrong. Please try again.');
      } finally {
        setLoading(null);
      }
    },
    [phone, isReady, loading, login]
  );

  return {
    phone,
    setPhone,
    formattedPhone,
    isReady,
    loading,
    sendOTP,
  };
}
