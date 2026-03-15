/**
 * src/features/inspection/store.js
 * Zustand store for the inspection / active-job feature.
 *
 * State owned here:
 *   - The current active job detail object (mirrors what the server returns from GET /api/worker/jobs/:id)
 *   - Derived inspection phases: status, timestamps
 *   - OTP codes received from the server
 *   - Material declarations
 *   - Pause / resume / suspend request state
 *
 * Firebase real-time updates flow INTO this store via useInspectionStatus hook.
 * Server fetches flow INTO this store via fetchActiveJob().
 */
import { create } from 'zustand';

export const useInspectionStore = create((set, get) => ({
  // ── Job Data ────────────────────────────────────────────────────────────
  /** Full job object from GET /api/worker/jobs/:id */
  activeJob: null,

  /** Current job status string (mirrors activeJob.status, kept separate for quick access) */
  jobStatus: null,

  /** True while the initial fetch is in flight */
  isLoading: false,

  /** True while an action (arrive, verify OTP, etc.) is in flight */
  isActionLoading: false,

  /** Error message from the last failed action */
  actionError: null,

  // ── OTP Codes ───────────────────────────────────────────────────────────
  /** 4-digit code the customer shows to start inspection (entered by worker) */
  inspectionOtpInput: ['', '', '', ''],

  /** 4-digit code the customer shows to start the billable session */
  startOtpInput: ['', '', '', ''],

  /** The server-issued 4-digit end OTP the worker reads out to the customer */
  endOtp: null,

  /** Extension OTP the worker reads out to the customer (+10 min approval) */
  inspectionExtOtp: null,

  /** Whether the worker has already requested a free inspection extension */
  inspectExtRequested: false,

  // ── Timer State ─────────────────────────────────────────────────────────
  /** Total billable seconds elapsed (updated by useInspectionTimer) */
  timeElapsed: 0,

  /** Seconds until inspection window expires (updated by useInspectionStatus) */
  inspectionExpirySeconds: null,

  /** Seconds until start OTP expires */
  otpExpirySeconds: null,

  // ── Pause / Reschedule State ─────────────────────────────────────────────
  pauseReason: '',
  rescheduleReason: '',
  rescheduleDate: null,
  isPauseMode: null,    // 'pause' | 'reschedule' | null

  // ── Materials ───────────────────────────────────────────────────────────
  materialsVisible: false,
  materials: [{ name: '', amount: '' }],

  // ── Chat ─────────────────────────────────────────────────────────────────
  chatUnreadCount: 0,

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────────────────

  setActiveJob: (job) =>
    set({
      activeJob: job,
      jobStatus: job?.status ?? null,
      endOtp: job?.end_otp ?? null,
      inspectExtRequested: Boolean(job?.inspection_extension_otp_hash),
    }),

  setJobStatus: (status) =>
    set((state) => ({
      jobStatus: status,
      activeJob: state.activeJob ? { ...state.activeJob, status } : state.activeJob,
    })),

  setLoading: (val) => set({ isLoading: val }),
  setActionLoading: (val) => set({ isActionLoading: val }),
  setActionError: (msg) => set({ actionError: msg }),
  clearActionError: () => set({ actionError: null }),

  setInspectionOtpInput: (arr) => set({ inspectionOtpInput: arr }),
  setStartOtpInput: (arr) => set({ startOtpInput: arr }),
  clearOtpInputs: () => set({ inspectionOtpInput: ['', '', '', ''], startOtpInput: ['', '', '', ''] }),

  setEndOtp: (otp) => set({ endOtp: otp }),
  setInspectionExtOtp: (otp) => set({ inspectionExtOtp: otp }),
  setInspectExtRequested: (val) => set({ inspectExtRequested: val }),

  setTimeElapsed: (seconds) => set({ timeElapsed: seconds }),
  setInspectionExpirySeconds: (s) => set({ inspectionExpirySeconds: s }),
  setOtpExpirySeconds: (s) => set({ otpExpirySeconds: s }),

  setPauseReason: (r) => set({ pauseReason: r }),
  setRescheduleReason: (r) => set({ rescheduleReason: r }),
  setRescheduleDate: (d) => set({ rescheduleDate: d }),
  setIsPauseMode: (m) => set({ isPauseMode: m }),

  setMaterialsVisible: (v) => set({ materialsVisible: v }),
  updateMaterials: (mats) => set({ materials: mats }),
  resetMaterials: () => set({ materials: [{ name: '', amount: '' }] }),

  setChatUnread: (n) => set({ chatUnreadCount: n }),

  /** Full reset — call when the worker navigates away from active job */
  reset: () =>
    set({
      activeJob: null,
      jobStatus: null,
      isLoading: false,
      isActionLoading: false,
      actionError: null,
      inspectionOtpInput: ['', '', '', ''],
      startOtpInput: ['', '', '', ''],
      endOtp: null,
      inspectionExtOtp: null,
      inspectExtRequested: false,
      timeElapsed: 0,
      inspectionExpirySeconds: null,
      otpExpirySeconds: null,
      pauseReason: '',
      rescheduleReason: '',
      rescheduleDate: null,
      isPauseMode: null,
      materialsVisible: false,
      materials: [{ name: '', amount: '' }],
      chatUnreadCount: 0,
    }),
}));
