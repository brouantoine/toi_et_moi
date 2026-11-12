import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking, Platform } from 'react-native';

import i18n from '@/i18n';
import { jsonResponse, mockFetch, renderWithProviders } from '@/test-utils';

import { legalUrl, PremiumScreen } from '../PremiumScreen';
import * as purchases from '../purchases';

jest.mock('../purchases', () => {
  const actual = jest.requireActual('../purchases');
  return {
    ...actual,
    purchasesAvailable: jest.fn(() => true),
    loadPlans: jest.fn(async () => [
      { id: '$rc_annual', period: 'yearly', price: '9,99 €', intro: null, pkg: {} },
      {
        id: '$rc_monthly',
        period: 'monthly',
        price: '1,99 €',
        intro: { price: '0,00 €', periodNumberOfUnits: 7, periodUnit: 'DAY' },
        pkg: {},
      },
    ]),
    buy: jest.fn(async () => 'bought'),
    restore: jest.fn(async () => false),
  };
});

function backend(plusUntil: string | null = null) {
  return mockFetch().mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.endsWith('/me/')) return jsonResponse({ id: 1, display_name: 'Antoine' });
    if (url.endsWith('/couple/')) {
      return jsonResponse({
        id: 3,
        status: 'active',
        plus_until: plusUntil,
        members: [
          { id: 1, display_name: 'Antoine' },
          { id: 2, display_name: 'Sam' },
        ],
      });
    }
    return jsonResponse({}, 404);
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('fr');
});

it('builds the public legal links from the API address', () => {
  expect(legalUrl('privacy', 'en')).toMatch(/\/legal\/privacy\/\?lang=en$/);
  expect(legalUrl('support', 'fr')).toMatch(/\/support\/\?lang=fr$/);
});

it('shows store prices, the trial and the renewal terms, then buys', async () => {
  backend();
  await renderWithProviders(<PremiumScreen />);
  expect(await screen.findByText('9,99 € / an pour 2')).toBeTruthy();
  expect(screen.getByText('7 jours gratuits')).toBeTruthy();
  expect(screen.getByTestId('premium-renewal')).toHaveTextContent(/renouvelle automatiquement/);
  await fireEvent.press(screen.getByTestId('premium-plan-monthly'));
  await fireEvent.press(screen.getByTestId('premium-continue'));
  await waitFor(() => expect(purchases.buy).toHaveBeenCalled());
  expect(jest.mocked(purchases.buy).mock.calls[0]?.[0].period).toBe('monthly');
  expect(await screen.findByText('Merci ! Bolingo Plus est actif pour vous deux.')).toBeTruthy();
});

it('restores, and says so when there is nothing to restore', async () => {
  backend();
  await renderWithProviders(<PremiumScreen />);
  await fireEvent.press(await screen.findByTestId('premium-restore'));
  expect(
    await screen.findByText('Aucun abonnement à restaurer pour ce compte du store.'),
  ).toBeTruthy();
});

it('shows an active Plus with the way to manage it', async () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  backend('2099-01-01T00:00:00Z');
  await renderWithProviders(<PremiumScreen />);
  expect(await screen.findByTestId('premium-active')).toBeTruthy();
  expect(screen.queryByTestId('premium-continue')).toBeNull();
  await fireEvent.press(screen.getByTestId('premium-manage'));
  expect(openURL).toHaveBeenCalledWith(purchases.MANAGE_URL);
});

it('names only its own store: Apple on iPhone, Google Play on Android', async () => {
  backend();
  await renderWithProviders(<PremiumScreen />);
  const renewal = await screen.findByTestId('premium-renewal');
  expect(renewal).toHaveTextContent(/compte Apple/);
  expect(renewal).not.toHaveTextContent(/Google/);
  expect(screen.getByTestId('premium-eula')).toBeTruthy();
});

it('shows the Google Play terms and no Apple licence on Android', async () => {
  const original = Platform.OS;
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
  try {
    backend();
    await renderWithProviders(<PremiumScreen />);
    const renewal = await screen.findByTestId('premium-renewal');
    expect(renewal).toHaveTextContent(/Google Play/);
    expect(renewal).not.toHaveTextContent(/Apple/);
    expect(screen.queryByTestId('premium-eula')).toBeNull();
  } finally {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => original });
  }
});
