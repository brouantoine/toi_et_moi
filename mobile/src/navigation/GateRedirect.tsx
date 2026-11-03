import { Redirect } from 'expo-router';
import { useEffect } from 'react';

import { usePendingInvite } from '@/features/couple/pendingInvite';
import { useOnboarding } from '@/features/onboarding/onboardingStore';
import { LoadingState } from '@/ui';

import { GATE_HOME } from './gate';
import { useGate } from './useGate';

/** Root route: sends everyone to the right home for their state. */
export function GateRedirect() {
  const gate = useGate();
  const pendingCode = usePendingInvite((s) => s.code);
  const onboarding = useOnboarding((s) => s.status);
  const hydrateOnboarding = useOnboarding((s) => s.hydrate);

  useEffect(() => {
    if (onboarding === 'loading') void hydrateOnboarding();
  }, [onboarding, hydrateOnboarding]);

  if (gate === 'loading' || (gate === 'auth' && onboarding === 'loading')) {
    return <LoadingState testID="gate-loading" />;
  }
  if (gate === 'auth' && onboarding === 'unseen') return <Redirect href="/onboarding" />;
  if (gate === 'couple' && pendingCode) return <Redirect href="/couple/join" />;
  return <Redirect href={GATE_HOME[gate]} />;
}
