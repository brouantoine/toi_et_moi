import { usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useCurrentCall } from './useCalls';

/**
 * Wherever you are in the app, an incoming call opens the call screen. Mounted once in
 * the tabs layout; the realtime sync and a slow poll keep the current call fresh.
 */
export function CallWatcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: call } = useCurrentCall();
  const ringing = call?.state === 'ringing' && call.direction === 'incoming';
  const callId = ringing ? call.id : null;

  useEffect(() => {
    if (callId !== null && pathname !== '/call') router.push('/call');
  }, [callId, pathname, router]);

  return null;
}
