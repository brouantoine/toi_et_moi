import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, ApiError, unwrap, type Schemas } from '@/api';

export type MorningToday = Schemas['MorningToday'];
export type Mood = Schemas['MoodEnum'];
export type Need = Schemas['NeedEnum'];
export type QuickReply = Schemas['MoodReplyEnum'];

export const MOODS: readonly Mood[] = ['joyful', 'happy', 'upset', 'angry'];
export const NEEDS: readonly Need[] = ['space', 'hug', 'help', 'listen', 'nothing'];
export const REPLIES: readonly QuickReply[] = ['here', 'courage', 'tonight', 'thinking'];

export const morningKey = ['morning'] as const;

export function useMorning() {
  return useQuery({
    queryKey: morningKey,
    queryFn: async () => unwrap(await api.GET('/api/v1/morning/today/')),
  });
}

export function useShareMood() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ mood, need }: { mood: Mood; need: Need | '' }) =>
      unwrap(await api.PUT('/api/v1/morning/today/', { body: { mood, need } })),
    onMutate: async ({ mood, need }) => {
      await client.cancelQueries({ queryKey: morningKey });
      const previous = client.getQueryData<MorningToday>(morningKey);
      if (previous) {
        client.setQueryData<MorningToday>(morningKey, {
          ...previous,
          mine: { mood, need, replies: previous.mine?.replies ?? [] },
        });
      }
      return { previous };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) client.setQueryData(morningKey, context.previous);
    },
    onSuccess: (today) => client.setQueryData(morningKey, today),
  });
}

export function useTakeBackMood() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.DELETE('/api/v1/morning/today/')),
    onSuccess: () => {
      client.setQueryData<MorningToday>(morningKey, (old) => (old ? { ...old, mine: null } : old));
    },
  });
}

export function useReply() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (reply: QuickReply) =>
      unwrap(await api.POST('/api/v1/morning/reply/', { body: { reply } })),
    onSuccess: (_d, reply) => {
      client.setQueryData<MorningToday>(morningKey, (old) =>
        old?.partner
          ? {
              ...old,
              partner: { ...old.partner, replies: [...(old.partner.replies ?? []), reply] },
            }
          : old,
      );
    },
  });
}

export const isTooMany = (error: unknown) => error instanceof ApiError && error.status === 429;
