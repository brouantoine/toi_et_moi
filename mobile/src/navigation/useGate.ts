import { useEffect } from 'react';

import { useAuthStore } from '@/auth/authStore';
import { useCouple } from '@/features/couple/useCouple';

import { resolveGate, type CoupleState, type Gate } from './gate';

/** Hydrates the session once, then derives the current gate from auth + couple. */
export function useGate(): Gate {
  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    if (status === 'loading') void hydrate();
  }, [status, hydrate]);

  const couple = useCouple({ enabled: status === 'signedIn', pollWhilePending: true });
  let coupleState: CoupleState = 'loading';
  if (couple.data !== undefined) {
    coupleState =
      couple.data === null ? 'none' : couple.data.status === 'active' ? 'active' : 'pending';
  } else if (couple.isError) {
    coupleState = 'error';
  }
  return resolveGate(status, coupleState);
}
