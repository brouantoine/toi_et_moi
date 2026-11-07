/** What happens when someone taps a notification or one of its buttons. */
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { api } from '@/api';

import { MOODS, QUICK_REPLIES } from './setup';

type Data = { kind?: string; screen?: string };

/** Screen to open for a notification (only known, safe routes). */
export function routeFor(data: Data | undefined): '/today' | '/memories' | '/organize' {
  switch (data?.screen) {
    case 'memories':
      return '/memories';
    case 'organize':
      return '/organize';
    default:
      return '/today';
  }
}

/** Runs the answer chosen from a notification button, if any. */
export async function runAction(actionIdentifier: string): Promise<void> {
  const [type, value] = actionIdentifier.split(':');
  if (type === 'mood' && (MOODS as readonly string[]).includes(value ?? '')) {
    await api.PUT('/api/v1/morning/today/', {
      body: { mood: value as (typeof MOODS)[number], need: '' },
    });
  } else if (type === 'reply' && (QUICK_REPLIES as readonly string[]).includes(value ?? '')) {
    await api.POST('/api/v1/morning/reply/', {
      body: { reply: value as (typeof QUICK_REPLIES)[number] },
    });
  }
}

export async function handleResponse(
  response: Notifications.NotificationResponse,
  navigate: (route: string) => void,
): Promise<void> {
  if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
    await runAction(response.actionIdentifier).catch(() => {});
  }
  navigate(routeFor(response.notification.request.content.data as Data));
}

/** Mounted once signed in: handles taps, including the one that launched the app. */
export function useNotificationResponses(): void {
  const router = useRouter();
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (last) void handleResponse(last, (route) => router.push(route as never));
  }, [last, router]);
}
