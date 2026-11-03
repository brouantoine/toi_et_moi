import { Redirect } from 'expo-router';

import { usePendingInvite } from '@/features/couple/pendingInvite';
import { LoadingState } from '@/ui';

import { GATE_HOME } from './gate';
import { useGate } from './useGate';

/** Root route: sends everyone to the right home for their state. */
export function GateRedirect() {
  const gate = useGate();
  const pendingCode = usePendingInvite((s) => s.code);
  if (gate === 'loading') return <LoadingState testID="gate-loading" />;
  if (gate === 'couple' && pendingCode) return <Redirect href="/couple/join" />;
  return <Redirect href={GATE_HOME[gate]} />;
}
