/**
 * Distance between partners from their real positions (PW.5). The position is read only
 * while the app is open, after the terms were accepted; the partner only ever gets the
 * rounded distance and the nearest city.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { api, unwrap, type Schemas } from '@/api';

import { startBackgroundUpdates, stopBackgroundUpdates, type StartResult } from './background';

export type Distance = Schemas['Distance'];
export const distanceKey = ['distance'] as const;
/** A shared position older than this is refreshed when the app comes back. */
export const REFRESH_AFTER_MS = 15 * 60 * 1000;
/** While the app is open, the position is resent this often: the "you are close" alert
 * then works without continuous (background) sharing. */
export const ACTIVE_REFRESH_MS = 3 * 60 * 1000;

async function fetchDistance(): Promise<Distance> {
  return unwrap(await api.GET('/api/v1/couple/distance/'));
}

export function useDistance(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: distanceKey,
    queryFn: fetchDistance,
    enabled: options.enabled ?? true,
  });
}

export function useAcceptTerms() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (version: number) =>
      unwrap(
        await api.POST('/api/v1/couple/distance/consent/', { body: { terms_version: version } }),
      ),
    onSuccess: (data) => client.setQueryData(distanceKey, data),
  });
}

export class LocationDeniedError extends Error {
  constructor() {
    super('location_denied');
    this.name = 'LocationDeniedError';
  }
}

/** Reads the position once (asks the permission if needed) and sends it. */
async function readAndSend(ask: boolean): Promise<Distance> {
  const permission = ask
    ? await Location.requestForegroundPermissionsAsync()
    : await Location.getForegroundPermissionsAsync();
  if (!permission.granted) throw new LocationDeniedError();
  const { coords } = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return unwrap(
    await api.PUT('/api/v1/couple/distance/', {
      body: { latitude: coords.latitude, longitude: coords.longitude },
    }),
  );
}

export function useSharePosition() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => readAndSend(true),
    onSuccess: (data) => client.setQueryData(distanceKey, data),
  });
}

export function useStopSharing() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await stopBackgroundUpdates();
      const result = await api.DELETE('/api/v1/couple/distance/');
      if (!result.response.ok) unwrap(result);
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: distanceKey }),
  });
}

export class ContinuousError extends Error {
  constructor(readonly reason: Exclude<StartResult, 'started'>) {
    super(`continuous_${reason}`);
    this.name = 'ContinuousError';
  }
}

/** Turns sharing while the app is closed on (system permission first) or off. */
export function useSetContinuous() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      if (enabled) {
        const started = await startBackgroundUpdates();
        if (started !== 'started') throw new ContinuousError(started);
      } else {
        await stopBackgroundUpdates();
      }
      return unwrap(await api.PUT('/api/v1/couple/distance/continuous/', { body: { enabled } }));
    },
    onSuccess: (data) => client.setQueryData(distanceKey, data),
  });
}

/** True when a shared position is older than REFRESH_AFTER_MS (or was never read). */
export function isStale(locatedAt: string | null | undefined, now = Date.now()): boolean {
  return !locatedAt || now - new Date(locatedAt).getTime() > REFRESH_AFTER_MS;
}

/**
 * Keeps the distance correct: when the app opens or comes back to the foreground, a
 * consented, stale position is refreshed silently, then every ACTIVE_REFRESH_MS while the
 * app stays open. Never asks for the permission here, never runs in the background.
 */
export function useRefreshPositionOnOpen(): void {
  const client = useQueryClient();
  const { data } = useDistance();
  const consented = Boolean(data?.mine.consented && data.mine.sharing);
  const locatedAt = data?.mine.located_at ?? null;
  const continuous = Boolean(consented && data?.mine.continuous);

  // After a reinstall or a reboot, continuous sharing resumes without asking again.
  useEffect(() => {
    if (continuous) void startBackgroundUpdates(false);
  }, [continuous]);

  useEffect(() => {
    if (!consented) return undefined;
    const refresh = () => {
      if (!isStale(locatedAt)) return;
      readAndSend(false)
        .then((fresh) => client.setQueryData(distanceKey, fresh))
        .catch(() => {});
    };
    refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [consented, locatedAt, client]);

  useEffect(() => {
    if (!consented) return undefined;
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      readAndSend(false)
        .then((fresh) => client.setQueryData(distanceKey, fresh))
        .catch(() => {});
    }, ACTIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [consented, client]);
}
