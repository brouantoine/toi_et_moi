/** Couple formation data hooks. Screens never call the API directly. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getLocales } from 'expo-localization';

import { api, ApiError, unwrap, type Schemas } from '@/api';

export type Couple = Schemas['Couple'];
export const coupleKey = ['couple'] as const;

/** Device currency (e.g. EUR, CAD, XOF), EUR when unknown. */
export function deviceCurrency(): string {
  const code = getLocales()[0]?.currencyCode;
  return code && /^[A-Z]{3}$/.test(code) ? code : 'EUR';
}

async function fetchCouple(): Promise<Couple | null> {
  const result = await api.GET('/api/v1/couple/');
  if (result.response.status === 404) return null;
  return unwrap(result);
}

export function useCouple(options: { pollWhilePending?: boolean; enabled?: boolean } = {}) {
  return useQuery({
    queryKey: coupleKey,
    queryFn: fetchCouple,
    enabled: options.enabled ?? true,
    // While waiting for the partner, check gently for the join (real-time comes later).
    refetchInterval: (query) =>
      options.pollWhilePending && query.state.data?.status === 'pending' ? 10_000 : false,
  });
}

function useCoupleMutation<TVars>(fn: (vars: TVars) => Promise<Couple | null>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (couple) => client.setQueryData(coupleKey, couple),
  });
}

export function useCreateCouple() {
  return useCoupleMutation(async (vars: { startDate?: string | null } = {}) =>
    unwrap(
      await api.POST('/api/v1/couple/', {
        body: { start_date: vars.startDate ?? null, currency: deviceCurrency() },
      }),
    ),
  );
}

export function useJoinCouple() {
  return useCoupleMutation(async (code: string) =>
    unwrap(await api.POST('/api/v1/couple/join/', { body: { code } })),
  );
}

export function useNewInvitation() {
  return useCoupleMutation(async () => unwrap(await api.POST('/api/v1/couple/invitation/')));
}

export function useCancelPendingCouple() {
  return useCoupleMutation(async () => {
    unwrap(await api.DELETE('/api/v1/couple/'));
    return null;
  });
}

const JOIN_ERRORS = [
  'invalid_code',
  'expired_code',
  'own_couple',
  'already_in_couple',
  'couple_full',
];

export function joinErrorKey(error: unknown): string {
  if (error instanceof ApiError && JOIN_ERRORS.includes(error.code)) {
    return `couple.errors.${error.code}`;
  }
  return 'errors.generic';
}

export type CoupleUpdate = Schemas['PatchedCoupleRequest'];

export function useUpdateCouple() {
  return useCoupleMutation(async (patch: CoupleUpdate) =>
    unwrap(await api.PATCH('/api/v1/couple/', { body: patch })),
  );
}
