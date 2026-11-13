import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getCalendars } from 'expo-localization';

import { api, unwrap, type Schemas } from '@/api';
import i18n from '@/i18n';

export type Me = Schemas['User'];
export type MeUpdate = Schemas['PatchedUserRequest'];
export const meKey = ['me'] as const;

export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: async (): Promise<Me> => unwrap(await api.GET('/api/v1/me/')),
  });
}

export function useUpdateMe() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (patch: MeUpdate): Promise<Me> =>
      unwrap(await api.PATCH('/api/v1/me/', { body: patch })),
    onSuccess: async (me) => {
      client.setQueryData(meKey, me);
      if (me.language && me.language !== i18n.language) await i18n.changeLanguage(me.language);
      // The partner sees my nickname through the couple: refresh it.
      await client.invalidateQueries({ queryKey: ['couple'] });
    },
  });
}

/** After sign-in, the app speaks the language saved in the profile. */
export function useApplyProfileLanguage(): void {
  const me = useMe();
  const language = me.data?.language;
  useEffect(() => {
    if (language && language !== i18n.language) void i18n.changeLanguage(language);
  }, [language]);
}

/**
 * Accounts created with Apple or Google start on UTC: the first time the app opens, the
 * profile takes the phone's time zone, so morning notifications arrive at the right hour.
 */
export function useSyncDeviceTimezone(): void {
  const me = useMe();
  const update = useUpdateMe();
  const current = me.data?.timezone;
  useEffect(() => {
    const device = getCalendars()[0]?.timeZone;
    if (current === 'UTC' && device && device !== 'UTC' && !update.isPending) {
      update.mutate({ timezone: device });
    }
    // Once per stored value: a failed update is retried on the next launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);
}
