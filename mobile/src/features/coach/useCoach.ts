/** The couple's shared AI coach: one thread both partners read. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, unwrap, type Schemas } from '@/api';

export type CoachThread = Schemas['CoachThread'];
export type CoachMessage = Schemas['CoachMessage'];
export const coachKey = ['coach'] as const;
/** While the coach is writing, look for its answer this often (realtime is faster). */
export const THINKING_POLL_MS = 3000;

export function useCoach() {
  return useQuery({
    queryKey: coachKey,
    queryFn: async (): Promise<CoachThread> => unwrap(await api.GET('/api/v1/coach/')),
    refetchInterval: (query) => (query.state.data?.thinking ? THINKING_POLL_MS : false),
  });
}

export function useCoachActions() {
  const client = useQueryClient();
  const store = (data: CoachThread) => client.setQueryData(coachKey, data);
  const consent = useMutation({
    mutationFn: async (enabled: boolean) =>
      unwrap(await api.PUT('/api/v1/coach/consent/', { body: { enabled } })),
    onSuccess: store,
  });
  const send = useMutation({
    mutationFn: async (text: string) =>
      unwrap(await api.POST('/api/v1/coach/messages/', { body: { text } })),
    onSuccess: store,
  });
  const erase = useMutation({
    mutationFn: async () => {
      const result = await api.DELETE('/api/v1/coach/');
      if (!result.response.ok) unwrap(result);
    },
    onSettled: () => client.invalidateQueries({ queryKey: coachKey }),
  });
  return { consent, send, erase };
}
