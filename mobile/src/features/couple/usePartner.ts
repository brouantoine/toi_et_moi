import { useMe } from '@/features/me/useProfile';

import { useCouple } from './useCouple';

/** The other member of my active couple, if any (display name, avatar, time zone). */
export function usePartner() {
  const me = useMe();
  const couple = useCouple();
  const myId = me.data?.id;
  if (myId === undefined) return null;
  return couple.data?.members?.find((member) => member.id !== myId) ?? null;
}
