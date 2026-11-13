import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { Alert, AppState, Platform, View } from 'react-native';

import i18n from '@/i18n';

import {
  jsonResponse,
  mockFetch,
  renderWithProviders,
  requestBody,
  routerMock,
} from '@/test-utils';

import { handleLocations, LOCATION_TASK } from '../background';
import { DistancePill } from '../DistancePill';
import { DistanceScreen } from '../DistanceScreen';
import { formatAgo, formatKm } from '../format';
import { regionFor } from '../region';
import {
  ACTIVE_REFRESH_MS,
  isStale,
  REFRESH_AFTER_MS,
  useDistance,
  useRefreshPositionOnOpen,
} from '../useDistance';

beforeEach(async () => {
  await i18n.changeLanguage('fr');
});

const urlOf = (arg: Request | string) => (typeof arg === 'string' ? arg : arg.url);
const methodOf = (arg: Request | string) => (typeof arg === 'string' ? 'GET' : arg.method);

const nobody = {
  terms_version: 3,
  mine: {
    consented: false,
    sharing: false,
    city: null,
    located_at: null,
    position: null,
    continuous: false,
  },
  partner: { sharing: false, continuous: false, city: null, position: null },
  km: null,
};
const now = new Date().toISOString();
const both = {
  terms_version: 3,
  mine: {
    consented: true,
    sharing: true,
    city: { name: 'Paris', country: 'FR' },
    located_at: now,
    position: { latitude: 48.85, longitude: 2.35, located_at: now },
    continuous: false,
  },
  partner: {
    sharing: true,
    continuous: false,
    city: { name: 'Abidjan', country: 'CI' },
    position: { latitude: 5.36, longitude: -4.0, located_at: now },
  },
  km: 4870,
};

function routes(distance: unknown, onWrite?: (req: Request | string) => Response) {
  return mockFetch().mockImplementation(async (input) => {
    const url = urlOf(input);
    if (methodOf(input) !== 'GET' && onWrite) return onWrite(input);
    if (url.includes('/couple/distance/')) return jsonResponse(distance);
    return jsonResponse({}, 404);
  });
}

describe('helpers', () => {
  it('formats distances and ages', () => {
    expect(formatKm(4870, 'fr')).toMatch(/^4\s870 km$/);
    expect(formatKm(45, 'en')).toBe('45 km');
    expect(formatAgo(new Date(Date.now() - 5 * 60_000).toISOString(), 'fr')).toBe(
      'il y a 5 minutes',
    );
  });

  it('refreshes only stale positions', () => {
    expect(isStale(null)).toBe(true);
    expect(isStale(new Date().toISOString())).toBe(false);
    expect(isStale(new Date(Date.now() - REFRESH_AFTER_MS - 1000).toISOString())).toBe(true);
  });

  it('frames both points on the map', () => {
    const region = regionFor([
      { latitude: 48.85, longitude: 2.35 },
      { latitude: 5.36, longitude: -4.0 },
    ]);
    expect(region.latitude).toBeCloseTo(27.1, 1);
    expect(region.latitudeDelta).toBeGreaterThan(43.4);
  });
});

describe('DistancePill', () => {
  it('shows the distance under the days and opens the map', async () => {
    routes(both);
    await renderWithProviders(<DistancePill />);
    expect(await screen.findByText(/4\s870 km/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('distance-pill'));
    expect(routerMock().push).toHaveBeenCalledWith('/distance');
  });

  it('invites to see the distance when not shared yet', async () => {
    routes(nobody);
    await renderWithProviders(<DistancePill />);
    expect(await screen.findByText('Voir la distance')).toBeTruthy();
  });
});

describe('DistanceScreen', () => {
  it('asks to accept the terms before reading the position, then shares it', async () => {
    const fetchMock = routes(nobody, (req) =>
      urlOf(req).includes('/consent/')
        ? jsonResponse({ ...nobody, mine: { ...nobody.mine, consented: true } })
        : jsonResponse(both),
    );
    await renderWithProviders(<DistanceScreen />);
    expect(await screen.findByTestId('distance-terms')).toBeTruthy();
    // Disabled until the terms are accepted: nothing is read.
    await fireEvent.press(screen.getByTestId('distance-share'));
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();

    await fireEvent(screen.getByTestId('distance-accept'), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('distance-share'));
    expect(await screen.findByTestId('distance-map')).toBeTruthy();
    const writes = fetchMock.mock.calls.filter(([i]) => methodOf(i) !== 'GET').map(([i]) => i);
    expect(urlOf(writes[0]!)).toContain('/couple/distance/consent/');
    expect(await requestBody(writes[0]!)).toEqual({ terms_version: 3 });
    expect(await requestBody(writes[1]!)).toEqual({ latitude: 48.8566, longitude: 2.3522 });
  });

  it('shows the map, the distance and where the other is', async () => {
    routes(both);
    await renderWithProviders(<DistanceScreen />);
    expect(await screen.findByTestId('distance-partner-marker')).toBeTruthy();
    expect(screen.getByTestId('distance-km')).toHaveTextContent(/4\s870 km vous séparent/);
    expect(screen.getByText(/Abidjan/)).toBeTruthy();
  });

  it('shows no map on Android (no Google Maps key), only the distance and the city', async () => {
    const os = Platform.OS;
    Platform.OS = 'android';
    try {
      routes(both);
      await renderWithProviders(<DistanceScreen />);
      expect(await screen.findByTestId('distance-km')).toHaveTextContent(/4\s870 km vous séparent/);
      expect(screen.queryByTestId('distance-map')).toBeNull();
      expect(screen.getByText(/Abidjan/)).toBeTruthy();
    } finally {
      Platform.OS = os;
    }
  });

  it('waits for the other before showing a distance', async () => {
    routes({ ...both, partner: nobody.partner, km: null });
    await renderWithProviders(<DistanceScreen />);
    expect(await screen.findByTestId('distance-waiting')).toBeTruthy();
    expect(screen.queryByTestId('distance-partner-marker')).toBeNull();
  });

  it('explains a refused permission with a way to the settings', async () => {
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValueOnce({
      granted: false,
    } as Awaited<ReturnType<typeof Location.requestForegroundPermissionsAsync>>);
    routes(both, () => jsonResponse(both));
    await renderWithProviders(<DistanceScreen />);
    await fireEvent.press(await screen.findByTestId('distance-refresh'));
    expect(await screen.findByTestId('distance-denied')).toBeTruthy();
  });

  it('stops and erases after confirmation', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const fetchMock = routes(both, () => new Response(null, { status: 204 }));
    await renderWithProviders(<DistanceScreen />);
    await fireEvent.press(await screen.findByTestId('distance-stop'));
    const buttons = alert.mock.calls[0]![2]!;
    buttons.find((b) => b.style === 'destructive')!.onPress!();
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([i]) => methodOf(i) === 'DELETE')).toBe(true),
    );
  });
});

describe('continuous sharing', () => {
  const continuousOn = { ...both, mine: { ...both.mine, continuous: true } };

  it('asks the "always" permission, starts the background task and saves the choice', async () => {
    const fetchMock = routes(both, () => jsonResponse(continuousOn));
    await renderWithProviders(<DistanceScreen />);
    await fireEvent(await screen.findByTestId('distance-continuous'), 'valueChange', true);
    await waitFor(() => expect(Location.startLocationUpdatesAsync).toHaveBeenCalledTimes(1));
    expect(Location.requestBackgroundPermissionsAsync).toHaveBeenCalled();
    const [task, options] = jest.mocked(Location.startLocationUpdatesAsync).mock.calls[0]!;
    expect(task).toBe(LOCATION_TASK);
    expect(options).toMatchObject({
      distanceInterval: 200,
      showsBackgroundLocationIndicator: true,
    });
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([i]) => urlOf(i).includes('/continuous/'))).toBe(true),
    );
  });

  it('explains when "always" is refused, and saves nothing', async () => {
    jest.mocked(Location.requestBackgroundPermissionsAsync).mockResolvedValueOnce({
      granted: false,
    } as Awaited<ReturnType<typeof Location.requestBackgroundPermissionsAsync>>);
    const fetchMock = routes(both, () => jsonResponse(continuousOn));
    await renderWithProviders(<DistanceScreen />);
    await fireEvent(await screen.findByTestId('distance-continuous'), 'valueChange', true);
    expect(await screen.findByTestId('distance-continuous-denied')).toBeTruthy();
    expect(fetchMock.mock.calls.some(([i]) => methodOf(i) !== 'GET')).toBe(false);
  });

  it('says when the partner shares continuously', async () => {
    routes({ ...both, partner: { ...both.partner, continuous: true } });
    await renderWithProviders(<DistanceScreen />);
    expect(await screen.findByTestId('distance-partner-continuous')).toBeTruthy();
  });

  it('sends the newest background position, and stops when signed out', async () => {
    const { useAuthStore } =
      jest.requireActual<typeof import('@/auth/authStore')>('@/auth/authStore');
    await useAuthStore.getState().signIn({ access: 'a', refresh: 'r' });
    const fetchMock = routes(both, () => jsonResponse(both));
    const locations = [
      { coords: { latitude: 1, longitude: 1 } },
      { coords: { latitude: 5.36, longitude: -4.0 } },
    ] as Location.LocationObject[];
    await handleLocations({ data: { locations } });
    const put = fetchMock.mock.calls.find(([i]) => methodOf(i) === 'PUT')![0];
    expect(await requestBody(put)).toEqual({ latitude: 5.36, longitude: -4.0 });

    await useAuthStore.getState().signOut();
    jest.mocked(Location.hasStartedLocationUpdatesAsync).mockResolvedValueOnce(true);
    await handleLocations({ data: { locations } });
    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith(LOCATION_TASK);
  });
});

describe('position while the app is open', () => {
  function Refresher() {
    useRefreshPositionOnOpen();
    const { data } = useDistance();
    return data?.mine.consented ? <View testID="refresher-ready" /> : null;
  }

  it('resends a consented position regularly, so the "close" alert works app open', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    try {
      jest.spyOn(Location, 'getForegroundPermissionsAsync').mockResolvedValue({
        granted: true,
      } as Awaited<ReturnType<typeof Location.getForegroundPermissionsAsync>>);
      jest.spyOn(Location, 'getCurrentPositionAsync').mockResolvedValue({
        coords: { latitude: 5.36, longitude: -4.0 },
      } as Awaited<ReturnType<typeof Location.getCurrentPositionAsync>>);
      Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
      const puts: string[] = [];
      const fetchMock = routes(both, (req) => {
        puts.push(methodOf(req));
        return jsonResponse(both);
      });
      await renderWithProviders(<Refresher />);
      await screen.findByTestId('refresher-ready');
      expect(fetchMock).toHaveBeenCalled();
      // A fresh position is not resent on open...
      expect(puts).toHaveLength(0);
      // ...but it is after ACTIVE_REFRESH_MS with the app still open.
      await act(async () => {
        jest.advanceTimersByTime(ACTIVE_REFRESH_MS);
      });
      await waitFor(() => expect(puts).toEqual(['PUT']));
    } finally {
      jest.useRealTimers();
    }
  });
});
