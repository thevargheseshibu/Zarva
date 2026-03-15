/**
 * src/features/inspection/hooks/useInspectionOTP.js
 * Handles OTP verification calls for the inspection feature.
 *
 * Three OTP verification steps in the ZARVA job lifecycle:
 *   1. Inspection OTP  — customer shows code → worker enters it to start inspection
 *   2. Start OTP       — customer approves estimate → shows code → worker enters to start billable session
 *   3. (End OTP is read by the customer from the worker's screen — no entry needed from worker)
 *
 * Each verify function returns { success: boolean, error?: string }
 * for the calling screen to handle UI feedback.
 */
import { useCallback } from 'react';
import apiClient from '@infra/api/client';
import { useInspectionStore } from '../store';

export function useInspectionOTP(jobId) {
  const {
    inspectionOtpInput,
    startOtpInput,
    setInspectionOtpInput,
    setStartOtpInput,
    setActionLoading,
    setActionError,
    clearActionError,
  } = useInspectionStore();

  // ── Inspection OTP input handlers ───────────────────────────────────────

  const setInspectionDigit = useCallback(
    (index, value) => {
      const next = [...inspectionOtpInput];
      next[index] = value;
      setInspectionOtpInput(next);
    },
    [inspectionOtpInput, setInspectionOtpInput]
  );

  const clearInspectionOtp = useCallback(() => {
    setInspectionOtpInput(['', '', '', '']);
  }, [setInspectionOtpInput]);

  // ── Start OTP input handlers ─────────────────────────────────────────────

  const setStartDigit = useCallback(
    (index, value) => {
      const next = [...startOtpInput];
      next[index] = value;
      setStartOtpInput(next);
    },
    [startOtpInput, setStartOtpInput]
  );

  const clearStartOtp = useCallback(() => {
    setStartOtpInput(['', '', '', '']);
  }, [setStartOtpInput]);

  // ── Server Calls ────────────────────────────────────────────────────────

  /**
   * Verify the inspection OTP the customer shares.
   * On success, the job moves to `inspection_active` status.
   */
  const verifyInspectionOTP = useCallback(async () => {
    const code = inspectionOtpInput.join('');
    if (code.length !== 4) return { success: false, error: 'Enter all 4 digits' };

    clearActionError();
    setActionLoading(true);
    try {
      await apiClient.post(`/api/worker/jobs/${jobId}/verify-inspection-otp`, { otp: code });
      clearInspectionOtp();
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Incorrect inspection code.';
      setActionError(msg);
      clearInspectionOtp();
      return { success: false, error: msg };
    } finally {
      setActionLoading(false);
    }
  }, [jobId, inspectionOtpInput, clearInspectionOtp, setActionLoading, setActionError, clearActionError]);

  /**
   * Verify the start OTP the customer shares after approving the estimate.
   * On success, the job moves to `in_progress` and billing begins.
   */
  const verifyStartOTP = useCallback(async () => {
    const code = startOtpInput.join('');
    if (code.length !== 4) return { success: false, error: 'Enter all 4 digits' };

    clearActionError();
    setActionLoading(true);
    try {
      await apiClient.post(`/api/worker/jobs/${jobId}/verify-start-otp`, { otp: code });
      clearStartOtp();
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Incorrect start code.';
      setActionError(msg);
      clearStartOtp();
      return { success: false, error: msg };
    } finally {
      setActionLoading(false);
    }
  }, [jobId, startOtpInput, clearStartOtp, setActionLoading, setActionError, clearActionError]);

  /**
   * Request an inspection extension.
   * Server creates an extension OTP the customer must enter.
   * Returns { success, otp? } — the worker reads the returned OTP out to the customer.
   */
  const requestInspectionExtension = useCallback(async () => {
    clearActionError();
    setActionLoading(true);
    try {
      const res = await apiClient.post(`/api/worker/jobs/${jobId}/inspection/extend-request`);
      return { success: true, otp: res.data?.otp };
    } catch (err) {
      const msg = err.response?.data?.message || 'Extension request failed.';
      setActionError(msg);
      return { success: false, error: msg };
    } finally {
      setActionLoading(false);
    }
  }, [jobId, setActionLoading, setActionError, clearActionError]);

  return {
    // State
    inspectionOtpInput,
    startOtpInput,
    inspectionOtpComplete: inspectionOtpInput.join('').length === 4,
    startOtpComplete: startOtpInput.join('').length === 4,
    // Handlers
    setInspectionDigit,
    clearInspectionOtp,
    setStartDigit,
    clearStartOtp,
    // Server actions
    verifyInspectionOTP,
    verifyStartOTP,
    requestInspectionExtension,
  };
}
