import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, unwrap, type Schemas } from '@/api';
import { OFFLINE_MUTATION_KEY, useOnline, type QueuedRequest } from '@/api/offline';

import { agendaRange } from './agendaDates';

export type Occurrence = Schemas['Occurrence'];
export type AgendaEvent = Schemas['Event'];
export type EventKind = Schemas['EventKindEnum'];
export type RelativePerson = Schemas['RelativePersonEnum'];
export const EVENT_KINDS: readonly EventKind[] = ['event', 'birthday', 'reunion'];

export const eventsKey = ['events'] as const;

export function useAgenda() {
  const { start, end } = agendaRange();
  return useQuery({
    queryKey: [...eventsKey, 'occurrences', start, end],
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/events/occurrences/', { params: { query: { start, end } } })),
  });
}

export function useEvent(id: number | undefined) {
  return useQuery({
    queryKey: [...eventsKey, 'detail', id ?? -1],
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/events/{id}/', { params: { path: { id: id as number } } })),
    enabled: id !== undefined,
  });
}

/**
 * Sends a write now when online (errors are shown), or queues it when offline: it will
 * leave by itself as soon as the network is back, even after a restart.
 */
export function useQueuedWrite(invalidate: readonly unknown[]) {
  const client = useQueryClient();
  const online = useOnline();
  const mutation = useMutation<unknown, Error, QueuedRequest>({
    mutationKey: OFFLINE_MUTATION_KEY,
    onSettled: () => client.invalidateQueries({ queryKey: invalidate }),
  });
  const write = async (request: QueuedRequest): Promise<'sent' | 'queued'> => {
    if (!online) {
      mutation.mutate(request);
      return 'queued';
    }
    await mutation.mutateAsync(request);
    return 'sent';
  };
  return { write, isPending: mutation.isPending && online, error: mutation.error };
}
