import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { Alert, Share } from 'react-native';

import {
  jsonResponse,
  mockFetch,
  renderWithProviders,
  requestBody,
  routerMock,
} from '@/test-utils';

import { CoupleSetupScreen } from '../CoupleSetupScreen';
import { extractCode, isValidCode, joinLink, normalizeCode, parseJoinLink } from '../inviteLink';
import { JoinCoupleScreen } from '../JoinCoupleScreen';
import { JoinLinkHandler } from '../JoinLinkHandler';
import { usePendingInvite } from '../pendingInvite';
import { deviceCurrency } from '../useCouple';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'fr', currencyCode: 'CAD' }],
  getCalendars: () => [{ timeZone: 'America/Montreal' }],
}));

const member = (id: number, name: string) => ({
  id,
  first_name: name,
  nickname: '',
  display_name: name,
  avatar_url: null,
  timezone: 'Europe/Paris',
});

const pending = {
  id: 1,
  status: 'pending',
  start_date: null,
  currency: 'CAD',
  photo_url: null,
  members: [member(1, 'Léa')],
  invitation: {
    code: 'ABC234',
    expires_at: '2026-11-05T10:00:00Z',
    link: 'bolingo://join/ABC234',
    share_url: 'https://nousdeux.example/join/ABC234/',
  },
  activated_at: null,
};

function urlOf(arg: Request | string): string {
  return typeof arg === 'string' ? arg : arg.url;
}

function methodOf(arg: Request | string): string {
  return typeof arg === 'string' ? 'GET' : arg.method;
}

beforeEach(() => usePendingInvite.setState({ code: null }));

describe('invite links and codes', () => {
  it.each([
    ['bolingo://join/ABC234', 'ABC234'],
    ['bolingo://join/abc234/', 'ABC234'],
    ['bolingo:///join/ABC-234?utm=x', 'ABC234'],
    ['https://example.com/join/ABC234', 'ABC234'],
    ['bolingo://join/ABC0IL', null],
    ['bolingo://join/', null],
    ['bolingo://memories/1', null],
  ])('parseJoinLink(%s) = %s', (url, expected) => {
    expect(parseJoinLink(url)).toBe(expected);
  });

  it('normalizes human input', () => {
    expect(normalizeCode(' abc-234 ')).toBe('ABC234');
    expect(isValidCode('abc 234')).toBe(true);
    expect(isValidCode('ABC23')).toBe(false);
    expect(joinLink('ABC234')).toBe('bolingo://join/ABC234');
  });

  it.each([
    ['ABC234', 'ABC234'],
    [' abc-234 ', 'ABC234'],
    ['Rejoins-moi : https://nousdeux.example/join/ABC234/ (ou saisis le code ABC234)', 'ABC234'],
    ['Ouvre ce lien : bolingo://join/ABC234.', 'ABC234'],
    ['Notre code : ABC234 dans l’app', 'ABC234'],
    ['Viens dans notre espace demain', null],
    ['', null],
  ])('extractCode(%j) = %s', (text, expected) => {
    expect(extractCode(text)).toBe(expected);
  });

  it('uses the device currency', () => {
    expect(deviceCurrency()).toBe('CAD');
  });
});

describe('CoupleSetupScreen', () => {
  it('offers to create or join when there is no couple, then shows the code', async () => {
    const fetchMock = mockFetch().mockImplementation(async (input) =>
      methodOf(input) === 'POST' ? jsonResponse(pending, 201) : jsonResponse({}, 404),
    );
    await renderWithProviders(<CoupleSetupScreen />);
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await fireEvent.press(await screen.findByTestId('couple-create'));
    expect(await screen.findByTestId('couple-code')).toHaveTextContent('ABC234');
    // One tap: the share sheet opens as soon as the space exists.
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const post = fetchMock.mock.calls.find(([i]) => methodOf(i) === 'POST')![0];
    expect(await requestBody(post)).toEqual({ start_date: null, currency: 'CAD' });
  });

  it('goes to the join screen from "I have a code"', async () => {
    mockFetch().mockResolvedValue(jsonResponse({}, 404));
    await renderWithProviders(<CoupleSetupScreen />);
    await fireEvent.press(await screen.findByTestId('couple-have-code'));
    expect(routerMock().push).toHaveBeenCalledWith('/couple/join');
  });

  it('shares the invitation with code and link', async () => {
    mockFetch().mockResolvedValue(jsonResponse(pending));
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await renderWithProviders(<CoupleSetupScreen />);
    await fireEvent.press(await screen.findByTestId('couple-share'));
    const message = share.mock.calls[0]![0] as { message: string };
    expect(message.message).toContain('ABC234');
    // The web link works even when the other person does not have the app yet.
    expect(message.message).toContain('https://nousdeux.example/join/ABC234/');
    expect(message.message).toContain('Bolingo');
  });

  it('copies the code and shows a QR code of the web link', async () => {
    mockFetch().mockResolvedValue(jsonResponse(pending));
    await renderWithProviders(<CoupleSetupScreen />);
    await fireEvent.press(await screen.findByTestId('couple-copy'));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('ABC234');
    expect(await screen.findByText('Code copié')).toBeTruthy();
    expect(screen.queryByTestId('qr-code')).toBeNull();
    await fireEvent.press(screen.getByTestId('couple-qr-toggle'));
    expect(screen.getByTestId('qr-code').props.accessibilityValue.text).toBe(
      'https://nousdeux.example/join/ABC234/',
    );
  });

  it('can cancel a pending space', async () => {
    const fetchMock = mockFetch().mockImplementation(async (input) =>
      methodOf(input) === 'DELETE' ? new Response(null, { status: 204 }) : jsonResponse(pending),
    );
    // Confirmed first: the code already sent stops working.
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });
    await renderWithProviders(<CoupleSetupScreen />);
    await fireEvent.press(await screen.findByTestId('couple-cancel'));
    expect(alert).toHaveBeenCalledWith(
      'Annuler cet espace ?',
      expect.any(String),
      expect.any(Array),
    );
    expect(await screen.findByTestId('couple-create')).toBeTruthy();
    expect(fetchMock.mock.calls.some(([i]) => methodOf(i) === 'DELETE')).toBe(true);
  });

  it('explains an expired code and offers a new one', async () => {
    const fetchMock = mockFetch().mockImplementation(async (input) =>
      methodOf(input) === 'POST'
        ? jsonResponse(pending)
        : jsonResponse({ ...pending, invitation: null }),
    );
    await renderWithProviders(<CoupleSetupScreen />);
    expect(await screen.findByText('Ton code a expiré')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('couple-new-code'));
    expect(await screen.findByTestId('couple-code')).toHaveTextContent('ABC234');
    expect(urlOf(fetchMock.mock.calls.at(-1)![0])).toContain('/api/v1/couple/invitation/');
  });

  it('celebrates an active couple and enters the app', async () => {
    mockFetch().mockResolvedValue(jsonResponse({ ...pending, status: 'active', invitation: null }));
    await renderWithProviders(<CoupleSetupScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Entrer' }));
    expect(routerMock().replace).toHaveBeenCalledWith('/');
  });

  it('lets a person waiting for their partner sign out', async () => {
    const { useAuthStore } =
      jest.requireActual<typeof import('@/auth/authStore')>('@/auth/authStore');
    await useAuthStore.getState().signIn({ access: 'a', refresh: 'r' });
    mockFetch().mockImplementation(async (input) =>
      urlOf(input).includes('/auth/logout/')
        ? new Response(null, { status: 205 })
        : jsonResponse(pending),
    );
    await renderWithProviders(<CoupleSetupScreen />);
    await fireEvent.press(await screen.findByTestId('couple-sign-out'));
    await waitFor(() => expect(useAuthStore.getState().status).toBe('signedOut'));
  });

  it('offers "test alone" when the server allows it and links a fictitious partner', async () => {
    const active = {
      ...pending,
      status: 'active',
      invitation: null,
      members: [member(1, 'Léa'), member(2, 'Partenaire test')],
    };
    let couple: unknown = null;
    const fetchMock = mockFetch().mockImplementation(async (input) => {
      if (urlOf(input).includes('/couple/solo-test/')) {
        if (methodOf(input) === 'POST') {
          couple = active;
          return jsonResponse(active, 201);
        }
        return jsonResponse({ enabled: true });
      }
      return couple ? jsonResponse(couple) : jsonResponse({}, 404);
    });
    await renderWithProviders(<CoupleSetupScreen />);
    await fireEvent.press(await screen.findByTestId('couple-solo-test-start'));
    expect(await screen.findByTestId('couple-active')).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(
        ([i]) => methodOf(i) === 'POST' && urlOf(i).includes('/couple/solo-test/'),
      ),
    ).toBe(true);
  });

  it('hides "test alone" when the server has it off', async () => {
    mockFetch().mockImplementation(async (input) =>
      urlOf(input).includes('/couple/solo-test/')
        ? jsonResponse({ enabled: false })
        : jsonResponse({}, 404),
    );
    await renderWithProviders(<CoupleSetupScreen />);
    expect(await screen.findByTestId('couple-create')).toBeTruthy();
    expect(screen.queryByTestId('couple-solo-test')).toBeNull();
  });

  it('shows a calm error state when loading fails', async () => {
    mockFetch().mockResolvedValue(jsonResponse({}, 503));
    await renderWithProviders(<CoupleSetupScreen />);
    expect(await screen.findByText(/Le service se repose/)).toBeTruthy();
    // Never a dead end: signing out stays possible.
    expect(screen.getByTestId('couple-sign-out')).toBeTruthy();
  });
});

describe('JoinCoupleScreen', () => {
  it('pastes the code from a copied invitation message', async () => {
    mockFetch();
    jest
      .mocked(Clipboard.getStringAsync)
      .mockResolvedValueOnce('Rejoins-moi : https://nousdeux.example/join/ABC234/');
    await renderWithProviders(<JoinCoupleScreen />);
    await fireEvent.press(screen.getByTestId('join-paste'));
    await waitFor(() => expect(screen.getByTestId('join-code').props.value).toBe('ABC234'));
    expect(screen.queryByTestId('join-paste-empty')).toBeNull();
  });

  it('says so when the clipboard holds no code', async () => {
    mockFetch();
    jest.mocked(Clipboard.getStringAsync).mockResolvedValueOnce('bonjour');
    await renderWithProviders(<JoinCoupleScreen />);
    await fireEvent.press(screen.getByTestId('join-paste'));
    expect(await screen.findByTestId('join-paste-empty')).toBeTruthy();
  });

  it('validates the format before calling the API', async () => {
    const fetchMock = mockFetch();
    await renderWithProviders(<JoinCoupleScreen />);
    await fireEvent.changeText(screen.getByTestId('join-code'), 'ab');
    await fireEvent.press(screen.getByTestId('join-submit'));
    expect(screen.getByText('Le code fait 6 caractères (lettres et chiffres).')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is prefilled from a pending deep link, joins and enters the app', async () => {
    usePendingInvite.setState({ code: 'ABC234' });
    const fetchMock = mockFetch().mockResolvedValue(
      jsonResponse({ ...pending, status: 'active', invitation: null }),
    );
    await renderWithProviders(<JoinCoupleScreen />);
    expect(screen.getByTestId('join-code').props.value).toBe('ABC234');
    await fireEvent.press(screen.getByTestId('join-submit'));
    await waitFor(() => expect(routerMock().replace).toHaveBeenCalledWith('/'));
    expect(urlOf(fetchMock.mock.calls[0]![0])).toContain('/api/v1/couple/join/');
    expect(await requestBody(fetchMock.mock.calls[0]![0])).toEqual({ code: 'ABC234' });
    expect(usePendingInvite.getState().code).toBeNull();
  });

  it('leaves a link-opened join screen for the setup screen, forgetting the code', async () => {
    usePendingInvite.setState({ code: 'ABC234' });
    mockFetch();
    const router = routerMock() as ReturnType<typeof routerMock> & { canGoBack?: jest.Mock };
    router.canGoBack = jest.fn(() => false);
    await renderWithProviders(<JoinCoupleScreen />);
    await fireEvent.press(screen.getByTestId('back-button'));
    expect(router.replace).toHaveBeenCalledWith('/couple');
    expect(usePendingInvite.getState().code).toBeNull();
  });

  it.each([
    ['expired_code', /a expiré/],
    ['own_couple', /ton propre code/],
    ['invalid_code', /ne fonctionne pas/],
  ])('explains %s', async (code, text) => {
    mockFetch().mockResolvedValue(jsonResponse({ code }, 400));
    await renderWithProviders(<JoinCoupleScreen />);
    await fireEvent.changeText(screen.getByTestId('join-code'), 'abc234');
    await fireEvent.press(screen.getByTestId('join-submit'));
    expect(await screen.findByText(text)).toBeTruthy();
  });
});

describe('JoinLinkHandler', () => {
  it('stores a valid code from the deep link', async () => {
    const router = jest.requireMock<{ useLocalSearchParams: jest.Mock }>('expo-router');
    router.useLocalSearchParams.mockReturnValue({ code: 'abc234' });
    await renderWithProviders(<JoinLinkHandler />);
    await act(async () => undefined);
    expect(usePendingInvite.getState().code).toBe('ABC234');
  });

  it('ignores an invalid code', async () => {
    const router = jest.requireMock<{ useLocalSearchParams: jest.Mock }>('expo-router');
    router.useLocalSearchParams.mockReturnValue({ code: 'nope' });
    await renderWithProviders(<JoinLinkHandler />);
    expect(usePendingInvite.getState().code).toBeNull();
  });
});
