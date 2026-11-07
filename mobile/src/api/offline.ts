/**
 * Offline-first writes.
 * - The network state (NetInfo) drives TanStack Query's onlineManager: offline mutations
 *   pause instead of failing, and resume by themselves when the network is back.
 * - Queued writes use a generic, serializable request (`QueuedRequest`) registered as the
 *   default mutation function, so paused writes survive an app restart (they are persisted
 *   with the cache and resumed after restore).
 * - `optimistic` applies a change to the cache at once and returns its rollback.
 */
import NetInfo from '@react-native-community/netinfo';
import { onlineManager, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import { unwrap } from './errors';
import { api } from './index';

export const OFFLINE_MUTATION_KEY = ['offline-write'] as const;

export type QueuedRequest = {
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** OpenAPI path template, e.g. `/api/v1/lists/{list_pk}/items/`. */
  path: string;
  pathParams?: Record<string, string | number>;
  body?: unknown;
};

type LooseClient = Record<
  QueuedRequest['method'],
  (path: string, init: { params?: { path?: object }; body?: unknown }) => Promise<never>
>;

/** Sends one queued write through the authenticated API client. */
export async function sendQueued(request: QueuedRequest): Promise<unknown> {
  const call = (api as unknown as LooseClient)[request.method];
  const init = { params: { path: request.pathParams ?? {} }, body: request.body };
  return unwrap(await call(request.path, init));
}

/** Default function of every write that may wait for the network. */
export function registerOfflineMutations(client: QueryClient): void {
  client.setMutationDefaults(OFFLINE_MUTATION_KEY, {
    mutationFn: (request: QueuedRequest) => sendQueued(request),
    networkMode: 'online',
  });
}

/** Keeps onlineManager in sync with the device network. Returns the unsubscribe. */
export function setupOnlineManager(): () => void {
  let unsubscribe: () => void = () => {};
  onlineManager.setEventListener((setOnline) => {
    unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
    return unsubscribe;
  });
  return () => unsubscribe();
}

/** After the persisted cache is restored: send what was queued, then refresh. */
export async function resumeQueuedWrites(client: QueryClient): Promise<void> {
  await client.resumePausedMutations();
  await client.invalidateQueries();
}

/**
 * Applies `update` to a cached query immediately (optimistic UI). Returns the rollback,
 * to call if the server refuses the change.
 */
export async function optimistic<T>(
  client: QueryClient,
  key: QueryKey,
  update: (current: T | undefined) => T | undefined,
): Promise<() => void> {
  await client.cancelQueries({ queryKey: key });
  const previous = client.getQueryData<T>(key);
  client.setQueryData<T>(key, update);
  return () => client.setQueryData<T>(key, previous);
}

/** True while the device is online (re-renders on change). */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (notify) => onlineManager.subscribe(notify),
    () => onlineManager.isOnline(),
  );
}
