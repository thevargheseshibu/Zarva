import { create } from 'zustand';

export const useOtpStore = create((set) => ({
    confirmationObj: null,
    setConfirmationObj: (obj) => set({ confirmationObj: obj })
}));
