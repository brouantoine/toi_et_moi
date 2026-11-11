import { fireEvent, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

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
  // A tappable pill straight to the couple settings, not a hint to go and find them.
  await fireEvent.press(await screen.findByTestId('hero-add-start-date'));
  expect(routerMock().push).toHaveBeenCalledWith('/settings/couple');
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

it('reads a whole note on tap, and only my own notes offer to be deleted', async () => {
  const couple = {
    id: 3,
    status: 'active',
    start_date: null,
    photo_url: null,
    members: [member(1, 'Antoine'), member(2, 'Sam')],
  };
  const notes = [
    { id: 7, text: 'Pense au pain', color: 'amber', author: 'me', created_at: '' },
    { id: 8, text: 'Je t’aime', color: 'red', author: 'you', created_at: '' },
  ];
  mockFetch().mockImplementation(async (arg) => {
    const { pathname } = new URL((arg as Request).url);
    if (pathname === '/api/v1/me/') return jsonResponse(me);
    if (pathname === '/api/v1/couple/') return jsonResponse(couple);
    if (pathname === '/api/v1/notes/') return jsonResponse(notes);
    // An older cached home without its lists must not break the screen.
    if (pathname === '/api/v1/games/home/') return jsonResponse({});
    if (pathname.endsWith('/occurrences/')) return jsonResponse([]);
    if (pathname.endsWith('/on-this-day/')) return jsonResponse({ date: '2026-11-09' });
    return jsonResponse({ date: '2026-11-09', mine: null, partner: null });
  });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render(couple);
  await fireEvent.press(await screen.findByTestId('note-7'));
  const mine = alert.mock.calls[0]!;
  expect(mine[0]).toBe('Toi');
  expect(mine[1]).toBe('Pense au pain');
  expect(mine[2]?.some((button) => button.style === 'destructive')).toBe(true);
  await fireEvent.press(screen.getByTestId('note-8'));
  const theirs = alert.mock.calls[1]!;
  expect(theirs[0]).toBe('Sam');
  expect(theirs[2]?.some((button) => button.style === 'destructive')).toBe(false);
});
