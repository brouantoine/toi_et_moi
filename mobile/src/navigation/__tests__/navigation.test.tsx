import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import { useAuthStore } from '@/auth/authStore';
import { usePendingInvite } from '@/features/couple/pendingInvite';
import { MeScreen } from '@/features/me/MeScreen';
import { TABS } from '@/features/shell/tabs';
import en from '@/i18n/locales/en.json';
import fr from '@/i18n/locales/fr.json';
import { createTestQueryClient, jsonResponse, mockFetch, renderWithProviders } from '@/test-utils';

import { resolveGate } from '../gate';
import { GateRedirect } from '../GateRedirect';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'fr', currencyCode: 'EUR' }],
  getCalendars: () => [{ timeZone: 'Europe/Paris' }],
}));

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

beforeEach(() => {
  store.clear();
  usePendingInvite.setState({ code: null });
  useAuthStore.setState({ status: 'loading', tokens: null });
});

describe('resolveGate', () => {
  it.each([
    ['loading', 'loading', 'loading'],
    ['signedOut', 'loading', 'auth'],
    ['signedOut', 'active', 'auth'],
    ['signedIn', 'loading', 'loading'],
    ['signedIn', 'none', 'couple'],
    ['signedIn', 'pending', 'couple'],
    ['signedIn', 'error', 'couple'],
    ['signedIn', 'active', 'app'],
  ] as const)('auth=%s couple=%s -> %s', (auth, couple, expected) => {
    expect(resolveGate(auth, couple)).toBe(expected);
  });
});

describe('GateRedirect', () => {
  it('sends a signed-out visitor to the welcome screen', async () => {
    await renderWithProviders(<GateRedirect />);
    expect(await screen.findByText('/welcome')).toBeTruthy();
  });

  it('sends a signed-in person without couple to the couple setup', async () => {
    store.set('nd.access', 'a').set('nd.refresh', 'r');
    mockFetch().mockResolvedValue(jsonResponse({}, 404));
    await renderWithProviders(<GateRedirect />);
    expect(await screen.findByText('/couple')).toBeTruthy();
  });

  it('opens the prefilled join screen when an invitation link is pending', async () => {
    store.set('nd.access', 'a').set('nd.refresh', 'r');
    usePendingInvite.setState({ code: 'ABC234' });
    mockFetch().mockResolvedValue(jsonResponse({}, 404));
    await renderWithProviders(<GateRedirect />);
    expect(await screen.findByText('/couple/join')).toBeTruthy();
  });

  it('sends members of an active couple to Today', async () => {
    store.set('nd.access', 'a').set('nd.refresh', 'r');
    mockFetch().mockResolvedValue(jsonResponse({ id: 1, status: 'active', members: [] }));
    await renderWithProviders(<GateRedirect />);
    expect(await screen.findByText('/today')).toBeTruthy();
  });
});

describe('tabs', () => {
  it('has exactly the 5 tabs of the product, translated in both languages', () => {
    expect(TABS.map((t) => t.name)).toEqual(['today', 'memories', 'organize', 'us', 'me']);
    for (const locale of [fr, en] as unknown as Record<
      string,
      Record<string, Record<string, string>>
    >[]) {
      for (const { name } of TABS) {
        expect(locale.tabs?.[name]?.label).toBeTruthy();
        expect(locale.tabs?.[name]?.emptyMessage).toBeTruthy();
      }
    }
  });
});

describe('MeScreen sign out', () => {
  it('revokes the refresh token, wipes cached data and signs out', async () => {
    await useAuthStore.getState().signIn({ access: 'a', refresh: 'r' });
    const fetchMock = mockFetch().mockResolvedValue(new Response(null, { status: 205 }));
    const client = createTestQueryClient();
    client.setQueryData(['couple'], { id: 1 });
    await renderWithProviders(<MeScreen />, 'light', client);
    expect(screen.getByText('Ton espace à toi')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('me-sign-out'));
    await waitFor(() => expect(useAuthStore.getState().status).toBe('signedOut'));
    expect(client.getQueryData(['couple'])).toBeUndefined();
    expect(store.size).toBe(0);
    const request = fetchMock.mock.calls[0]![0] as Request;
    expect(request.url).toContain('/api/v1/auth/logout/');
  });

  it('still signs out locally when offline', async () => {
    await useAuthStore.getState().signIn({ access: 'a', refresh: 'r' });
    mockFetch().mockRejectedValue(new TypeError('Network request failed'));
    await renderWithProviders(<MeScreen />);
    await fireEvent.press(screen.getByTestId('me-sign-out'));
    await waitFor(() => expect(useAuthStore.getState().status).toBe('signedOut'));
  });
});
