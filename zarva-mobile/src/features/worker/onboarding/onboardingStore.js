/**
 * src/features/worker/onboarding/onboardingStore.js
 * Zustand store for the multi-step worker KYC / onboarding flow.
 *
 * Steps in the onboarding flow:
 *   1. OnboardingWelcome     — landing page, user taps "Get Started"
 *   2. OnboardingPersonal    — name, date of birth, emergency contact
 *   3. OnboardingSkills      — select trade skills (plumber, electrician, etc.)
 *   4. OnboardingBankDetails — bank account and UPI details
 *   5. OnboardingLocation    — service area: lat/lng + radius
 *   6. OnboardingComplete    — agreement acceptance + final submit
 *   7. PendingApproval       — wait screen after submission
 *
 * State is persisted across app restarts so workers can resume a partially
 * completed onboarding without losing their data.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useOnboardingStore = create(
  persist(
    (set, get) => ({
      // ── Progress ────────────────────────────────────────────────────────
      /** Current step index (0-based) */
      currentStep: 0,

      /** Whether the final submission has been made */
      isSubmitted: false,

      /** Server error from the final submit call */
      submitError: null,

      // ── Step 2: Personal Info ────────────────────────────────────────────
      personal: {
        fullName: '',
        dateOfBirth: '',        // ISO date string
        emergencyContact: '',
        emergencyPhone: '',
        aadhaarNumber: '',
      },

      // ── Step 3: Skills ──────────────────────────────────────────────────
      /** Array of selected skill category IDs */
      selectedSkillIds: [],

      /** Array of experience levels per skill: [{ skill_id, years }] */
      skillExperiences: [],

      // ── Step 4: Bank Details ─────────────────────────────────────────────
      banking: {
        accountHolderName: '',
        bankName: '',
        accountNumber: '',
        ifscCode: '',
        upiId: '',
      },

      // ── Step 5: Service Area ─────────────────────────────────────────────
      serviceArea: {
        latitude: null,
        longitude: null,
        address: '',
        radiusKm: 15,           // Minimum 15km per ZCAP service area rule
      },

      // ── Step 6: Agreement ─────────────────────────────────────────────────
      hasAgreedToTerms: false,

      // ──────────────────────────────────────────────────────────────────────
      // ACTIONS
      // ──────────────────────────────────────────────────────────────────────

      nextStep: () => set((s) => ({ currentStep: Math.min(s.currentStep + 1, 6) })),
      prevStep: () => set((s) => ({ currentStep: Math.max(s.currentStep - 1, 0) })),
      goToStep: (step) => set({ currentStep: step }),

      updatePersonal: (partial) =>
        set((s) => ({ personal: { ...s.personal, ...partial } })),

      setSelectedSkills: (ids) => set({ selectedSkillIds: ids }),

      setSkillExperiences: (experiences) => set({ skillExperiences: experiences }),

      updateBanking: (partial) =>
        set((s) => ({ banking: { ...s.banking, ...partial } })),

      updateServiceArea: (partial) =>
        set((s) => ({ serviceArea: { ...s.serviceArea, ...partial } })),

      setAgreedToTerms: (val) => set({ hasAgreedToTerms: val }),

      setSubmitted: (val) => set({ isSubmitted: val }),
      setSubmitError: (err) => set({ submitError: err }),

      /**
       * Build the payload for POST /api/worker/onboarding/submit.
       * Returns the full structured object ready to send to the server.
       */
      buildSubmitPayload: () => {
        const s = get();
        return {
          personal: s.personal,
          skills: s.selectedSkillIds.map((id) => {
            const exp = s.skillExperiences.find((e) => e.skill_id === id);
            return { skill_id: id, years_experience: exp?.years || 0 };
          }),
          banking: s.banking,
          service_area: {
            latitude: s.serviceArea.latitude,
            longitude: s.serviceArea.longitude,
            radius_km: Math.max(s.serviceArea.radiusKm, 15),
          },
          agreed_to_terms: s.hasAgreedToTerms,
        };
      },

      /** Clear everything on logout or after approval */
      reset: () =>
        set({
          currentStep: 0,
          isSubmitted: false,
          submitError: null,
          personal: {
            fullName: '',
            dateOfBirth: '',
            emergencyContact: '',
            emergencyPhone: '',
            aadhaarNumber: '',
          },
          selectedSkillIds: [],
          skillExperiences: [],
          banking: {
            accountHolderName: '',
            bankName: '',
            accountNumber: '',
            ifscCode: '',
            upiId: '',
          },
          serviceArea: {
            latitude: null,
            longitude: null,
            address: '',
            radiusKm: 15,
          },
          hasAgreedToTerms: false,
        }),
    }),
    {
      name: 'zarva-onboarding-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Persist everything except submitError (transient)
        currentStep: state.currentStep,
        isSubmitted: state.isSubmitted,
        personal: state.personal,
        selectedSkillIds: state.selectedSkillIds,
        skillExperiences: state.skillExperiences,
        banking: state.banking,
        serviceArea: state.serviceArea,
        hasAgreedToTerms: state.hasAgreedToTerms,
      }),
    }
  )
);
