import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useEffect, useState, type ReactNode } from 'react';

import { useAuthStore } from '@/auth/authStore';

import { resumeQueuedWrites, setupOnlineManager } from './offline';
import { createQueryClient, PERSIST_MAX_AGE, queryPersister } from './queryClient';

/** Bump when cached data shapes change, to drop stale persisted caches. */
const CACHE_BUSTER = 'games-packs-1';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  useEffect(() => setupOnlineManager(), []);
  // Any sign-out (including an expired session) wipes the couple's cached data, in memory
  // and on disk, so the next person signing in on this phone never sees it.
  useEffect(
    () =>
      useAuthStore.subscribe((state, previous) => {
        if (previous.status === 'signedIn' && state.status === 'signedOut') {
          client.clear();
          void queryPersister.removeClient();
        }
      }),
    [client],
  );
  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{ persister: queryPersister, maxAge: PERSIST_MAX_AGE, buster: CACHE_BUSTER }}
      // Writes queued while offline (even before a restart) leave as soon as possible.
      onSuccess={() => void resumeQueuedWrites(client)}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
