import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useEffect, useState, type ReactNode } from 'react';

import { resumeQueuedWrites, setupOnlineManager } from './offline';
import { createQueryClient, PERSIST_MAX_AGE, queryPersister } from './queryClient';

/** Bump when cached data shapes change, to drop stale persisted caches. */
const CACHE_BUSTER = 'v1';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  useEffect(() => setupOnlineManager(), []);
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
