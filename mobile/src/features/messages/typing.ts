/**
 * "Typing…" between the two phones. Ephemeral: lives only in memory and on the socket.
 * The partner's indicator expires by itself if the "stopped" signal is lost.
 */
import { create } from 'zustand';

export const TYPING_EXPIRES_MS = 6000;
/** While I type, "typing" is re-sent at most this often (the server also throttles). */
export const TYPING_RESEND_MS = 3000;

type Sender = (active: boolean) => void;

type TypingState = {
  partnerTyping: boolean;
  setPartnerTyping: (active: boolean) => void;
};

let expiry: ReturnType<typeof setTimeout> | null = null;

export const useTypingStore = create<TypingState>((set) => ({
  partnerTyping: false,
  setPartnerTyping: (active) => {
    if (expiry) clearTimeout(expiry);
    expiry = active ? setTimeout(() => set({ partnerTyping: false }), TYPING_EXPIRES_MS) : null;
    set({ partnerTyping: active });
  },
}));

let sender: Sender | null = null;
let lastSent = 0;
let typing = false;

/** Registered by the realtime connection while it is open. */
export function setTypingSender(next: Sender | null): void {
  sender = next;
}

/** Called on every keystroke (true) and on send / clear / leave (false). */
export function reportTyping(active: boolean, now = Date.now()): void {
  if (!sender) return;
  if (active) {
    if (typing && now - lastSent < TYPING_RESEND_MS) return;
    typing = true;
    lastSent = now;
    sender(true);
  } else if (typing) {
    typing = false;
    lastSent = 0;
    sender(false);
  }
}
