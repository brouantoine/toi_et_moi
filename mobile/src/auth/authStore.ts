import { create } from 'zustand';

import { clearTokens, readTokens, saveTokens, type Tokens } from './tokenStorage';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthState = {
  status: AuthStatus;
  /** In-memory copy of the tokens (source of truth is the secure store). */
  tokens: Tokens | null;
  hydrate: () => Promise<void>;
  signIn: (tokens: Tokens) => Promise<void>;
  updateTokens: (tokens: Tokens) => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  tokens: null,
  hydrate: async () => {
    const tokens = await readTokens();
    set({ tokens, status: tokens ? 'signedIn' : 'signedOut' });
  },
  signIn: async (tokens) => {
    await saveTokens(tokens);
    set({ tokens, status: 'signedIn' });
  },
  updateTokens: async (tokens) => {
    await saveTokens(tokens);
    set({ tokens });
  },
  signOut: async () => {
    await clearTokens();
    set({ tokens: null, status: 'signedOut' });
  },
}));
