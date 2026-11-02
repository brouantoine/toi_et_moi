import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { isValidCode, normalizeCode } from './inviteLink';
import { usePendingInvite } from './pendingInvite';

/**
 * Target of `nousdeux://join/CODE`. The code is kept aside (the user may first need to
 * sign up), then the join screen opens prefilled.
 */
export function JoinLinkHandler() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const setPending = usePendingInvite((s) => s.set);
  const normalized = normalizeCode(code ?? '');
  const valid = isValidCode(normalized);

  useEffect(() => {
    if (valid) setPending(normalized);
  }, [valid, normalized, setPending]);

  return <Redirect href="/couple/join" />;
}
