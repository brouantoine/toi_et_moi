import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useState, type ReactNode } from 'react';

import { createQueryClient, PERSIST_MAX_AGE, queryPersister } from './queryClient';

/** Bump when cached data shapes change, to drop stale persisted caches. */
const CACHE_BUSTER = 'v1';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{ persister: queryPersister, maxAge: PERSIST_MAX_AGE, buster: CACHE_BUSTER }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
