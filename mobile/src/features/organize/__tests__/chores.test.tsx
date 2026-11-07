import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { registerOfflineMutations } from '@/api/offline';
import { coupleKey } from '@/features/couple/useCouple';
import { meKey } from '@/features/me/useProfile';
import i18n from '@/i18n';
import { createTestQueryClient, jsonResponse, mockFetch, renderWithProviders } from '@/test-utils';

import { OrganizeScreen } from '../OrganizeScreen';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'fr' }],
  getCalendars: () => [{ timeZone: 'Europe/Paris' }],
}));

const me = { id: 1, display_name: 'Léa' };
const couple = {
  id: 3,
  status: 'active',
  members: [
    { id: 1, display_name: 'Léa' },
    { id: 2, display_name: 'Sam' },
  ],
};

function chore(id: number, title: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    title,
    assignee: 'us',
    recurrence: 'none',
    due_date: null,
    done_at: null,
    last_done_at: null,
    created_at: '',
    ...extra,
  };
}

type Call = { method: string; path: string; body?: unknown };

function backend(
  week = {
    start: '2026-11-02',
    end: '2026-11-08',
    me: [chore(1, 'Poubelles', { assignee: 'me', due_date: '2026-11-05' })],
    you: [chore(2, 'Linge', { assignee: 'you', recurrence: 'weekly', due_date: '2026-11-06' })],
    us: [],
  },
) {
  const calls: Call[] = [];
  let state = JSON.parse(JSON.stringify(week));
  mockFetch().mockImplementation(async (arg) => {
    const request = arg as Request;
    const { pathname } = new URL(request.url);
    const text = request.method === 'POST' ? await request.clone().text() : '';
    calls.push({
      method: request.method,
      path: pathname,
      body: text ? JSON.parse(text) : undefined,
    });
    if (pathname === '/api/v1/me/') return jsonResponse(me);
    if (pathname === '/api/v1/couple/') return jsonResponse(couple);
    if (pathname === '/api/v1/chores/week/') return jsonResponse(state);
    const id = Number(pathname.match(/chores\/(\d+)\//)?.[1]);
    if (id) {
      for (const g of ['me', 'you', 'us'])
        state[g] = state[g].filter((c: { id: number }) => c.id !== id);
      return request.method === 'DELETE' ? new Response(null, { status: 204 }) : jsonResponse({});
    }
    state.us.push(chore(50, JSON.parse(text).title));
    return jsonResponse({}, 201);
  });
  return calls;
}

async function openChores() {
  const client = createTestQueryClient();
  registerOfflineMutations(client);
  client.setQueryData(meKey, me);
  client.setQueryData(coupleKey, couple);
  await renderWithProviders(<OrganizeScreen />, 'light', client);
  await fireEvent.press(screen.getByTestId('organize-section-chores'));
}

const writes = (calls: Call[]) => calls.filter((c) => c.method !== 'GET');

beforeEach(async () => {
  await i18n.changeLanguage('fr');
});

it('shows who carries what, named, without any number', async () => {
  backend();
  await openChores();
  expect(await screen.findByText('Poubelles')).toBeTruthy();
  expect(within(screen.getByTestId('chores-group-me')).getByText('Moi')).toBeTruthy();
  expect(within(screen.getByTestId('chores-group-you')).getByText('Sam')).toBeTruthy();
  expect(within(screen.getByTestId('chores-group-you')).getByText(/Chaque semaine/)).toBeTruthy();
  expect(
    within(screen.getByTestId('chores-group-us')).getByText('Rien pour l’instant'),
  ).toBeTruthy();
  expect(screen.queryByText(/\d+ tâches?/)).toBeNull();
});

it('creates a chore with who and how often', async () => {
  const calls = backend();
  await openChores();
  await screen.findByText('Poubelles');
  await fireEvent.changeText(screen.getByTestId('chores-new-title'), 'Arroser les plantes');
  await fireEvent.press(screen.getByTestId('chores-new-assignee-you'));
  await fireEvent.press(screen.getByTestId('chores-new-recurrence-weekly'));
  await fireEvent.press(screen.getByTestId('chores-create'));
  await waitFor(() =>
    expect(writes(calls)[0]).toEqual({
      method: 'POST',
      path: '/api/v1/chores/',
      body: { title: 'Arroser les plantes', assignee: 'you', recurrence: 'weekly' },
    }),
  );
});

it('marks a chore as done at once, and deletes another', async () => {
  const calls = backend();
  await openChores();
  await screen.findByText('Poubelles');
  await fireEvent.press(screen.getByRole('button', { name: 'Marquer « Poubelles » comme fait' }));
  await waitFor(() => expect(screen.queryByText('Poubelles')).toBeNull());
  await fireEvent.press(screen.getByRole('button', { name: 'Supprimer « Linge »' }));
  await waitFor(() => expect(screen.queryByText('Linge')).toBeNull());
  expect(writes(calls).map((c) => `${c.method} ${c.path}`)).toEqual([
    'POST /api/v1/chores/1/complete/',
    'DELETE /api/v1/chores/2/',
  ]);
});

it('has a kind empty state', async () => {
  backend({ start: '2026-11-02', end: '2026-11-08', me: [], you: [], us: [] });
  await openChores();
  expect(await screen.findByTestId('chores-empty')).toBeTruthy();
});
