import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api';
import { queryPersister } from '@/api/queryClient';
import { stopBackgroundUpdates } from '@/features/distance/background';
import { forget as forgetPurchases } from '@/features/premium/purchases';
import { forgetThisPhone } from '@/notifications/push';

import { useAuthStore } from './authStore';

/**
 * Signs out: revokes the refresh token server-side (best effort), then wipes the tokens
 * and every cached piece of couple data from the device.
 */
export function useSignOut() {
  const client = useQueryClient();
  const signOut = useAuthStore((s) => s.signOut);
  return useMutation({
    mutationFn: async () => {
      await forgetThisPhone();
      // Signed out: this phone stops sending its position.
      await stopBackgroundUpdates();
      await forgetPurchases();
      const refresh = useAuthStore.getState().tokens?.refresh;
      if (refresh) {
        try {
          await api.POST('/api/v1/auth/logout/', { body: { refresh } });
        } catch {
          // Offline: the token will simply expire. Local data is wiped anyway.
        }
      }
      client.clear();
      await queryPersister.removeClient();
      await signOut();
    },
  });
}
