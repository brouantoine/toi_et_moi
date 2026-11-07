import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, unwrap, type Schemas } from '@/api';

export type Preferences = Schemas['Preference'];
export const preferencesKey = ['notification-preferences'] as const;

export function usePreferences() {
  return useQuery({
    queryKey: preferencesKey,
    queryFn: async () => unwrap(await api.GET('/api/v1/notifications/preferences/')),
  });
}

export function useUpdatePreferences() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Preferences>) =>
      unwrap(await api.PATCH('/api/v1/notifications/preferences/', { body: patch })),
    onMutate: async (patch) => {
      await client.cancelQueries({ queryKey: preferencesKey });
      const previous = client.getQueryData<Preferences>(preferencesKey);
      if (previous) client.setQueryData<Preferences>(preferencesKey, { ...previous, ...patch });
      return { previous };
    },
    onError: (_e, _p, context) => {
      if (context?.previous) client.setQueryData(preferencesKey, context.previous);
    },
    onSuccess: (saved) => client.setQueryData(preferencesKey, saved),
  });
}

/** "08:00:00" -> "08:00" for TimeField. */
export const hhmm = (value: string | null | undefined, fallback: string) =>
  value ? value.slice(0, 5) : fallback;
