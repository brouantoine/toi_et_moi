import { fireEvent, screen } from '@testing-library/react-native';

import { coupleKey } from '@/features/couple/useCouple';
import { meKey } from '@/features/me/useProfile';
import i18n from '@/i18n';
import {
  createTestQueryClient,
  jsonResponse,
  mockFetch,
  renderWithProviders,
  routerMock,
} from '@/test-utils';
import { toIsoDate } from '@/ui';

import { daysTogether, nextMilestone } from '../milestones';
import { TodayScreen } from '../TodayScreen';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'fr' }],
  getCalendars: () => [{ timeZone: 'Europe/Paris' }],
}));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(async () => {}) }));

const me = { id: 1, display_name: 'Antoine' };
const member = (id: number, name: string) => ({ id, display_name: name, avatar_url: null });

describe('milestones', () => {
  const today = new Date(2026, 10, 9, 10);

  it('counts days together on local calendar days', () => {
    expect(daysTogether('2026-11-08', today)).toBe(1);
    expect(daysTogether('2023-02-13', today)).toBe(1365);
  });

  it('finds the nearest milestone: anniversary or round day count', () => {
    expect(nextMilestone('2019-11-20', today)).toEqual({ kind: 'years', value: 7, inDays: 11 });
    expect(nextMilestone('2024-02-17', today)).toEqual({ kind: 'days', value: 1000, inDays: 4 }); // 996 days
    expect(nextMilestone('2026-08-01', today)).toEqual({ kind: 'days', value: 100, inDays: 0 });
    expect(nextMilestone('2030-01-01', today)).toBeNull();
  });

  it('celebrates a 29 February start on 28 February', () => {
    expect(nextMilestone('2024-02-29', new Date(2027, 1, 27, 10))).toEqual({
      kind: 'years',
      value: 3,
      inDays: 1,
    });
  });
});

function backend({
  couple,
  occurrences = [],
  onThisDay = [],
}: {
  couple: object;
  occurrences?: unknown[];
  onThisDay?: unknown[];
}) {
  mockFetch().mockImplementation(async (arg) => {
    const { pathname } = new URL((arg as Request).url);
    if (pathname === '/api/v1/me/') return jsonResponse(me);
    if (pathname === '/api/v1/couple/') return jsonResponse(couple);
    if (pathname.endsWith('/occurrences/')) return jsonResponse(occurrences);
    if (pathname.endsWith('/on-this-day/'))
      return jsonResponse({ date: '2026-11-09', items: onThisDay });
    return jsonResponse({ date: '2026-11-09', mine: null, partner: null });
  });
}

async function render(couple: object) {
  const client = createTestQueryClient();
  client.setQueryData(meKey, me);
  client.setQueryData(coupleKey, couple);
  await renderWithProviders(<TodayScreen />, 'light', client);
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('fr');
});

it('opens with the couple: names, days together and the next milestone', async () => {
  const start = new Date();
  start.setDate(start.getDate() - 998);
  const couple = {
    id: 3,
    status: 'active',
    start_date: toIsoDate(start),
    photo_url: null,
    members: [member(1, 'Antoine'), member(2, 'Sam')],
  };
  backend({ couple });
  await render(couple);
  expect(await screen.findByText('Antoine & Sam')).toBeTruthy();
  expect(screen.getByTestId('days-together')).toHaveTextContent('Ensemble depuis 998 jours');
  expect(screen.getByTestId('milestone')).toHaveTextContent(/Dans 2 j\s: 1000 jours ensemble/);
});

it('invites to add the start date when it is missing', async () => {
  const couple = {
    id: 3,
    status: 'active',
    start_date: null,
    photo_url: null,
    members: [member(1, 'Antoine'), member(2, 'Sam')],
  };
  backend({ couple });
  await render(couple);
  expect(
    await screen.findByText('Ajoute votre date de début dans Moi → Notre couple.'),
  ).toBeTruthy();
  expect(screen.queryByTestId('milestone')).toBeNull();
});

it('shows the next moment and the memory of this day', async () => {
  const couple = {
    id: 3,
    status: 'active',
    start_date: '2019-06-21',
    photo_url: null,
    members: [member(1, 'Antoine'), member(2, 'Sam')],
  };
  backend({
    couple,
    occurrences: [
      {
        date: toIsoDate(new Date()),
        starts_at: null,
        ends_at: null,
        event: { id: 7, title: 'Dîner chez tes parents', kind: 'event' },
      },
    ],
    onThisDay: [
      {
        years_ago: 2,
        memory: { id: 5, title: 'Le lac au lever du jour', body: 'On avait froid.', photos: [] },
      },
    ],
  });
  await render(couple);
  expect(await screen.findByText('Dîner chez tes parents')).toBeTruthy();
  expect(screen.getByTestId('next-moment')).toHaveTextContent(/Aujourd’hui/);
  expect(await screen.findByText('Il y a 2 ans aujourd’hui')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('on-this-day'));
  expect(routerMock().push).toHaveBeenCalledWith('/memories/5');
  await fireEvent.press(screen.getByTestId('next-moment'));
  expect(routerMock().push).toHaveBeenCalledWith('/organize');
});

it('suggests a plan when nothing is coming, and hides the memory card when there is none', async () => {
  const couple = {
    id: 3,
    status: 'active',
    start_date: '2019-06-21',
    photo_url: null,
    members: [member(1, 'Antoine'), member(2, 'Sam')],
  };
  backend({ couple });
  await render(couple);
  expect(await screen.findByText('Rien de prévu. Une idée de sortie ?')).toBeTruthy();
  expect(screen.queryByTestId('on-this-day')).toBeNull();
});

it('celebrates a milestone on its very day', async () => {
  const start = new Date();
  start.setDate(start.getDate() - 1000);
  const couple = {
    id: 3,
    status: 'active',
    start_date: toIsoDate(start),
    photo_url: null,
    members: [member(1, 'Antoine'), member(2, 'Sam')],
  };
  backend({ couple });
  await render(couple);
  expect(await screen.findByTestId('milestone')).toHaveTextContent(
    /C’est aujourd’hui\s: 1000 jours ensemble/,
  );
});
