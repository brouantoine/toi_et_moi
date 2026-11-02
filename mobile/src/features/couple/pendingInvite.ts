/** Invitation code received by deep link before the user had an account/session. */
import { create } from 'zustand';

type PendingInvite = { code: string | null; set: (code: string | null) => void };

export const usePendingInvite = create<PendingInvite>((set) => ({
  code: null,
  set: (code) => set({ code }),
}));
