/**
 * Where may the user be? Pure function, so the routing rules are unit-tested.
 * - loading: still reading tokens / couple
 * - auth: signed out (welcome, login, register, forgot password)
 * - couple: signed in, no active couple yet (create / join)
 * - app: signed in with an active couple (the 5 tabs)
 */
import type { AuthStatus } from '@/auth/authStore';

export type Gate = 'loading' | 'auth' | 'couple' | 'app';

export type CoupleState = 'loading' | 'none' | 'pending' | 'active' | 'error';

export function resolveGate(auth: AuthStatus, couple: CoupleState): Gate {
  if (auth === 'loading') return 'loading';
  if (auth === 'signedOut') return 'auth';
  if (couple === 'loading') return 'loading';
  if (couple === 'active') return 'app';
  // 'error' while offline: stay where a signed-in person can still act (setup screen shows retry).
  return 'couple';
}

export const GATE_HOME: Record<Exclude<Gate, 'loading'>, '/welcome' | '/couple' | '/today'> = {
  auth: '/welcome',
  couple: '/couple',
  app: '/today',
};
