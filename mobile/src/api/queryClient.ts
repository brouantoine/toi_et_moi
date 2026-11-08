import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ApiError } from './errors';
import { registerOfflineMutations } from './offline';

const DAY = 24 * 60 * 60 * 1000;

export function createQueryClient(): QueryClient {
  // In development, every failed request is printed in the Expo terminal with its cause.
  const report = (error: unknown) => {
    if (__DEV__ && !(error instanceof ApiError)) console.warn('[api] request failed:', error);
  };
  const client = new QueryClient({
    queryCache: new QueryCache({ onError: report }),
    mutationCache: new MutationCache({ onError: report }),
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        gcTime: DAY,
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
          failureCount < 2,
      },
      mutations: { retry: false },
    },
  });
  registerOfflineMutations(client);
  return client;
}

/** Cached server state survives app restarts (offline-first reading). */
export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'nd.query-cache',
  throttleTime: 1000,
});

export const PERSIST_MAX_AGE = 7 * DAY;
