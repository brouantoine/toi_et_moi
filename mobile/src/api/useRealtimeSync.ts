import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuthStore } from '@/auth/authStore';
import { API_URL } from '@/config/env';

import { api } from './index';
import { invalidationKeysFor, SyncClient, syncUrl } from './realtime';

/**
 * Keeps the couple's shared data live while the app is in the foreground.
 * Closed in the background (battery); on return, reconnects and catches up.
 */
export function useRealtimeSync(): void {
  const queryClient = useQueryClient();
  const signedIn = useAuthStore((s) => s.status === 'signedIn');

  useEffect(() => {
    if (!signedIn) return undefined;
    const client = new SyncClient({
      url: syncUrl(API_URL),
      getToken: () => useAuthStore.getState().tokens?.access ?? null,
      onChanged: (event) =>
        invalidationKeysFor(event).forEach((queryKey) => {
          void queryClient.invalidateQueries({ queryKey });
        }),
      onReady: () => {
        void queryClient.invalidateQueries({
          predicate: (q) =>
            ['events', 'lists', 'chores', 'expenses'].includes(String(q.queryKey[0])),
        });
      },
      // Any authenticated call refreshes an expired access token (auth middleware).
      onUnauthorized: () => api.GET('/api/v1/me/'),
    });
    if (AppState.currentState !== 'background') client.start();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') client.start();
      else if (state === 'background') client.stop();
    });
    return () => {
      sub.remove();
      client.stop();
    };
  }, [signedIn, queryClient]);
}
