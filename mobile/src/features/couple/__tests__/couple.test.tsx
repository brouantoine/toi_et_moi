import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';

import {
  jsonResponse,
  mockFetch,
  renderWithProviders,
  requestBody,
  routerMock,
} from '@/test-utils';

import { CoupleSetupScreen } from '../CoupleSetupScreen';
import { isValidCode, joinLink, normalizeCode, parseJoinLink } from '../inviteLink';
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
    link: 'nousdeux://join/ABC234',
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
    ['nousdeux://join/ABC234', 'ABC234'],
    ['nousdeux://join/abc234/', 'ABC234'],
    ['nousdeux:///join/ABC-234?utm=x', 'ABC234'],
    ['https://example.com/join/ABC234', 'ABC234'],
    ['nousdeux://join/ABC0IL', null],
    ['nousdeux://join/', null],
    ['nousdeux://memories/1', null],
  ])('parseJoinLink(%s) = %s', (url, expected) => {
    expect(parseJoinLink(url)).toBe(expected);
  });

  it('normalizes human input', () => {
    expect(normalizeCode(' abc-234 ')).toBe('ABC234');
    expect(isValidCode('abc 234')).toBe(true);
    expect(isValidCode('ABC23')).toBe(false);
    expect(joinLink('ABC234')).toBe('nousdeux://join/ABC234');
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
    await fireEvent.press(await screen.findByTestId('couple-create'));
    expect(await screen.findByTestId('couple-code')).toHaveTextContent('ABC234');
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
    expect(message.message).toContain('nousdeux://join/ABC234');
    expect(message.message).toContain('Nous Deux');
  });

  it('can cancel a pending space', async () => {
    const fetchMock = mockFetch().mockImplementation(async (input) =>
      methodOf(input) === 'DELETE' ? new Response(null, { status: 204 }) : jsonResponse(pending),
    );
    await renderWithProviders(<CoupleSetupScreen />);
    await fireEvent.press(await screen.findByTestId('couple-cancel'));
    expect(await screen.findByTestId('couple-create')).toBeTruthy();
    expect(fetchMock.mock.calls.some(([i]) => methodOf(i) === 'DELETE')).toBe(true);
  });

  it('celebrates an active couple and enters the app', async () => {
    mockFetch().mockResolvedValue(jsonResponse({ ...pending, status: 'active', invitation: null }));
    await renderWithProviders(<CoupleSetupScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Entrer' }));
    expect(routerMock().replace).toHaveBeenCalledWith('/');
  });

  it('shows a calm error state when loading fails', async () => {
    mockFetch().mockResolvedValue(jsonResponse({}, 503));
    await renderWithProviders(<CoupleSetupScreen />);
    expect(await screen.findByText(/Le service se repose/)).toBeTruthy();
  });
});

describe('JoinCoupleScreen', () => {
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
