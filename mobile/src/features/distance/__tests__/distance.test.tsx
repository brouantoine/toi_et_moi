import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { Alert } from 'react-native';

import i18n from '@/i18n';

import {
  jsonResponse,
  mockFetch,
  renderWithProviders,
  requestBody,
  routerMock,
} from '@/test-utils';

import { DistancePill } from '../DistancePill';
import { DistanceScreen, regionFor } from '../DistanceScreen';
import { formatAgo, formatKm } from '../format';
import { isStale, REFRESH_AFTER_MS } from '../useDistance';

beforeEach(async () => {
  await i18n.changeLanguage('fr');
});

const urlOf = (arg: Request | string) => (typeof arg === 'string' ? arg : arg.url);
const methodOf = (arg: Request | string) => (typeof arg === 'string' ? 'GET' : arg.method);

const nobody = {
  terms_version: 2,
  mine: { consented: false, sharing: false, city: null, located_at: null, position: null },
  partner: { sharing: false, city: null, position: null },
  km: null,
};
const now = new Date().toISOString();
const both = {
  terms_version: 2,
  mine: {
    consented: true,
    sharing: true,
    city: { name: 'Paris', country: 'FR' },
    located_at: now,
    position: { latitude: 48.85, longitude: 2.35, located_at: now },
  },
  partner: {
    sharing: true,
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
    await renderWithProviders(<DistancePill tone="text" />);
    expect(await screen.findByText(/4\s870 km/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('distance-pill'));
    expect(routerMock().push).toHaveBeenCalledWith('/distance');
  });

  it('invites to see the distance when not shared yet', async () => {
    routes(nobody);
    await renderWithProviders(<DistancePill tone="text" />);
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
    expect(await requestBody(writes[0]!)).toEqual({ terms_version: 2 });
    expect(await requestBody(writes[1]!)).toEqual({ latitude: 48.8566, longitude: 2.3522 });
  });

  it('shows the map, the distance and where the other is', async () => {
    routes(both);
    await renderWithProviders(<DistanceScreen />);
    expect(await screen.findByTestId('distance-partner-marker')).toBeTruthy();
    expect(screen.getByTestId('distance-km')).toHaveTextContent(/4\s870 km vous séparent/);
    expect(screen.getByText(/Abidjan/)).toBeTruthy();
  });

  it('waits for the other before showing a distance', async () => {
    routes({ ...both, partner: { sharing: false, city: null, position: null }, km: null });
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
