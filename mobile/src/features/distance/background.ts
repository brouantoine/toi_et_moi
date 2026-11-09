/**
 * Continuous sharing (PW.5b): the phone keeps sending its position while the app is
 * closed, only after an explicit, separate opt-in. Moves under 200 m are ignored to
 * spare the battery. Needs an installed build (not available in Expo Go).
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { api } from '@/api';
import { useAuthStore } from '@/auth/authStore';
import i18n from '@/i18n';

export const LOCATION_TASK = 'partner-distance-location';
export const MIN_MOVE_METERS = 200;

type TaskBody = { data?: { locations?: Location.LocationObject[] }; error?: unknown };

/** Sends the newest position; stops by itself when signed out or consent is gone. */
export async function handleLocations({ data, error }: TaskBody): Promise<void> {
  if (error) return;
  const newest = data?.locations?.at(-1);
  if (!newest) return;
  // Headless launch: the tokens are not in memory yet.
  if (!useAuthStore.getState().tokens) await useAuthStore.getState().hydrate();
  if (!useAuthStore.getState().tokens) {
    await stopBackgroundUpdates();
    return;
  }
  try {
    const result = await api.PUT('/api/v1/couple/distance/', {
      body: { latitude: newest.coords.latitude, longitude: newest.coords.longitude },
    });
    if (result.response.status === 403) await stopBackgroundUpdates();
  } catch {
    // Offline: the next move will send a fresh position.
  }
}

TaskManager.defineTask(LOCATION_TASK, (body) => handleLocations(body as TaskBody));

export function backgroundAvailable(): boolean {
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

export type StartResult = 'started' | 'denied' | 'unavailable';

export async function startBackgroundUpdates(ask = true): Promise<StartResult> {
  if (!backgroundAvailable()) return 'unavailable';
  try {
    const permission = ask
      ? await Location.requestBackgroundPermissionsAsync()
      : await Location.getBackgroundPermissionsAsync();
    if (!permission.granted) return 'denied';
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) return 'started';
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: MIN_MOVE_METERS,
      deferredUpdatesDistance: MIN_MOVE_METERS,
      pausesUpdatesAutomatically: true,
      activityType: Location.ActivityType.Other,
      // Honest by design: the system shows that the position is being shared.
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: i18n.t('distance.serviceTitle'),
        notificationBody: i18n.t('distance.serviceBody'),
      },
    });
    return 'started';
  } catch {
    return 'unavailable';
  }
}

export async function stopBackgroundUpdates(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  } catch {
    // Not started, or not supported here (Expo Go): nothing to stop.
  }
}
