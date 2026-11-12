/** Calls between the two of us: data hooks. Screens never call the API. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, unwrap, type Schemas } from '@/api';

export type Call = Schemas['Call'];
export type CallKind = Call['kind'];

export const callsKey = ['calls'] as const;
const currentKey = [...callsKey, 'current'] as const;

/** Ended, declined, missed or cancelled: nothing rings any more. */
export const isOver = (call: Call | null | undefined) =>
  !call || !['ringing', 'ongoing'].includes(call.state);

/**
 * The call ringing or going on. Pushed live by the realtime sync; while one rings, the
 * phone also checks every few seconds so the screen never misses a pick-up or hang-up.
 */
export function useCurrentCallInfo(enabled = true) {
  return useQuery({
    queryKey: currentKey,
    enabled,
    queryFn: async () => unwrap(await api.GET('/api/v1/calls/current/')),
    refetchInterval: (query) => (query.state.data?.call ? 3000 : 15000),
  });
}

export function useCurrentCall(enabled = true) {
  const query = useCurrentCallInfo(enabled);
  return { ...query, data: query.data ? (query.data.call ?? null) : undefined };
}

function useKeep() {
  const client = useQueryClient();
  return (call: Call) =>
    client.setQueryData(currentKey, (previous?: { media_ready: boolean }) => ({
      media_ready: previous?.media_ready ?? false,
      call: isOver(call) ? null : call,
    }));
}

function useCallAction(path: 'accept' | 'decline' | 'end') {
  const keep = useKeep();
  return useMutation({
    mutationFn: async (id: number) => {
      const params = { params: { path: { call_id: id } } };
      if (path === 'accept')
        return unwrap(await api.POST('/api/v1/calls/{call_id}/accept/', params));
      if (path === 'decline')
        return unwrap(await api.POST('/api/v1/calls/{call_id}/decline/', params));
      return unwrap(await api.POST('/api/v1/calls/{call_id}/end/', params));
    },
    onSuccess: keep,
  });
}

export function useCallActions() {
  const keep = useKeep();
  const start = useMutation({
    mutationFn: async (kind: CallKind) =>
      unwrap(await api.POST('/api/v1/calls/', { body: { kind } })),
    onSuccess: keep,
  });
  return {
    start,
    accept: useCallAction('accept'),
    decline: useCallAction('decline'),
    end: useCallAction('end'),
  };
}
