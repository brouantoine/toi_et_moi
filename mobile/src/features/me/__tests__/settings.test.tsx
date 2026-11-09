import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { CoupleInfoScreen } from '@/features/couple/CoupleInfoScreen';
import i18n from '@/i18n';
import {
  jsonResponse,
  mockFetch,
  renderWithProviders,
  requestBody,
  routerMock,
} from '@/test-utils';
import { fromIsoDate, Segmented, toIsoDate } from '@/ui';

import { MeScreen } from '../MeScreen';
import { ProfileScreen } from '../ProfileScreen';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'fr', currencyCode: 'EUR' }],
  getCalendars: () => [{ timeZone: 'America/Montreal' }],
}));

const me = {
  id: 1,
  email: 'lea@example.com',
  first_name: 'Léa',
  nickname: '',
  display_name: 'Léa',
  avatar_url: null,
  birth_date: null,
  language: 'fr',
  timezone: 'Europe/Paris',
  quiet_hours_start: '22:00:00',
  quiet_hours_end: '08:00:00',
  email_verified: true,
};

const couple = {
  id: 3,
  status: 'active',
  start_date: '2019-06-21',
  currency: 'EUR',
  photo_url: null,
  members: [
    {
      id: 1,
      first_name: 'Léa',
      nickname: '',
      display_name: 'Léa',
      avatar_url: null,
      timezone: 'Europe/Paris',
    },
    {
      id: 2,
      first_name: 'Sam',
      nickname: '',
      display_name: 'Sam',
      avatar_url: null,
      timezone: 'Europe/Paris',
    },
  ],
  invitation: null,
  activated_at: '2026-01-01T00:00:00Z',
};

function methodOf(arg: Request | string): string {
  return typeof arg === 'string' ? 'GET' : arg.method;
}

beforeEach(async () => {
  Platform.OS = 'android';
  await i18n.changeLanguage('fr');
});

describe('date helpers', () => {
  it('round-trips local calendar days without timezone shift', () => {
    expect(toIsoDate(new Date(2020, 1, 29, 23, 30))).toBe('2020-02-29');
    expect(toIsoDate(fromIsoDate('1992-04-05'))).toBe('1992-04-05');
  });
});

describe('Segmented', () => {
  it('exposes radios and reports the choice', async () => {
    const onChange = jest.fn();
    await renderWithProviders(
      <Segmented
        label="Langue"
        value="fr"
        onChange={onChange}
        options={[
          { value: 'fr', label: 'Français' },
          { value: 'en', label: 'English' },
        ]}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Français' }).props.accessibilityState).toEqual({
      checked: true,
    });
    await fireEvent.press(screen.getByRole('radio', { name: 'English' }));
    expect(onChange).toHaveBeenCalledWith('en');
  });
});

describe('ProfileScreen', () => {
  it('edits nickname, birth date, language and time zone', async () => {
    const fetchMock = mockFetch().mockImplementation(async (input) =>
      methodOf(input) === 'PATCH'
        ? jsonResponse({ ...me, nickname: 'Loulou', display_name: 'Loulou', language: 'en' })
        : jsonResponse(me),
    );
    await renderWithProviders(<ProfileScreen />);
    await fireEvent.changeText(await screen.findByTestId('profile-nickname'), 'Loulou');
    await fireEvent.press(screen.getByTestId('profile-birth-date'));
    await fireEvent.press(screen.getByTestId('profile-birth-date-picker'));
    await fireEvent.press(screen.getByTestId('profile-language-en'));
    await fireEvent.press(screen.getByTestId('profile-use-device-tz'));
    await fireEvent.press(screen.getByTestId('profile-save'));
    await waitFor(() => expect(i18n.language).toBe('en'));
    const patch = fetchMock.mock.calls.find(([i]) => methodOf(i) === 'PATCH')![0];
    expect(await requestBody(patch)).toEqual({
      first_name: 'Léa',
      nickname: 'Loulou',
      birth_date: '2020-02-14',
      language: 'en',
      timezone: 'America/Montreal',
    });
  });

  it('requires a first name', async () => {
    const fetchMock = mockFetch().mockResolvedValue(jsonResponse(me));
    await renderWithProviders(<ProfileScreen />);
    await fireEvent.changeText(await screen.findByTestId('profile-first-name'), '  ');
    await fireEvent.press(screen.getByTestId('profile-save'));
    expect(screen.getByText('Indique ton prénom.')).toBeTruthy();
    expect(fetchMock.mock.calls.some(([i]) => methodOf(i) === 'PATCH')).toBe(false);
  });

  it('shows an error state when the profile cannot load', async () => {
    mockFetch().mockResolvedValue(jsonResponse({}, 503));
    await renderWithProviders(<ProfileScreen />);
    expect(await screen.findByText(/Le service se repose/)).toBeTruthy();
  });
});

describe('CoupleInfoScreen', () => {
  it('applies the couple colour at once and saves it for both', async () => {
    const fetchMock = mockFetch().mockImplementation(async (input) =>
      methodOf(input) === 'PATCH'
        ? jsonResponse({ ...couple, accent: 'lagon' })
        : jsonResponse({ ...couple, accent: 'rouge' }),
    );
    await renderWithProviders(<CoupleInfoScreen />);
    const red = await screen.findByTestId('accent-rouge');
    expect(red.props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByTestId('accent-lagon'));
    await waitFor(() =>
      expect(screen.getByTestId('accent-lagon').props.accessibilityState).toMatchObject({
        selected: true,
      }),
    );
    const patch = fetchMock.mock.calls.find(([i]) => methodOf(i) === 'PATCH')![0];
    expect(await requestBody(patch)).toEqual({ accent: 'lagon' });
  });

  it('shows both partners and saves start date and currency', async () => {
    const fetchMock = mockFetch().mockImplementation(async (input) =>
      methodOf(input) === 'PATCH'
        ? jsonResponse({ ...couple, currency: 'CAD' })
        : jsonResponse(couple),
    );
    await renderWithProviders(<CoupleInfoScreen />);
    expect(await screen.findByText('Léa & Sam')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('couple-currency'), 'cad');
    await fireEvent.press(screen.getByTestId('couple-start-date-clear'));
    await fireEvent.press(screen.getByTestId('couple-save'));
    expect(await screen.findByTestId('couple-saved')).toBeTruthy();
    const patch = fetchMock.mock.calls.find(([i]) => methodOf(i) === 'PATCH')![0];
    expect(await requestBody(patch)).toEqual({ start_date: null, currency: 'CAD' });
  });

  it('rejects an invalid currency before saving', async () => {
    const fetchMock = mockFetch().mockResolvedValue(jsonResponse(couple));
    await renderWithProviders(<CoupleInfoScreen />);
    await fireEvent.changeText(await screen.findByTestId('couple-currency'), 'e1');
    await fireEvent.press(screen.getByTestId('couple-save'));
    expect(screen.getByText('Indique un code à 3 lettres (EUR, CAD…).')).toBeTruthy();
    expect(fetchMock.mock.calls.some(([i]) => methodOf(i) === 'PATCH')).toBe(false);
  });

  it('confirms a date through the iOS sheet', async () => {
    Platform.OS = 'ios';
    const fetchMock = mockFetch().mockImplementation(async (input) =>
      methodOf(input) === 'PATCH'
        ? jsonResponse(couple)
        : jsonResponse({ ...couple, start_date: null }),
    );
    await renderWithProviders(<CoupleInfoScreen />);
    await fireEvent.press(await screen.findByTestId('couple-start-date'));
    await fireEvent.press(screen.getByTestId('couple-start-date-picker'));
    await fireEvent.press(screen.getByTestId('couple-start-date-confirm'));
    await fireEvent.press(screen.getByTestId('couple-save'));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([i]) => methodOf(i) === 'PATCH')).toBe(true),
    );
    const patch = fetchMock.mock.calls.find(([i]) => methodOf(i) === 'PATCH')![0];
    expect(await requestBody(patch)).toEqual({ start_date: '2020-02-14', currency: 'EUR' });
  });
});

describe('MeScreen menu', () => {
  it('opens profile and couple settings', async () => {
    mockFetch().mockResolvedValue(jsonResponse(me));
    await renderWithProviders(<MeScreen />);
    expect(await screen.findByText('Léa')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('me-profile'));
    await fireEvent.press(screen.getByTestId('me-couple'));
    expect(routerMock().push.mock.calls).toEqual([['/settings/profile'], ['/settings/couple']]);
  });
});
