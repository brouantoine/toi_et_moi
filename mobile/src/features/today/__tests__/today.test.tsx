import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { coupleKey } from '@/features/couple/useCouple';
import { meKey } from '@/features/me/useProfile';
import i18n from '@/i18n';
import { createTestQueryClient, jsonResponse, mockFetch, renderWithProviders } from '@/test-utils';

import { TodayScreen } from '../TodayScreen';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'fr' }],
  getCalendars: () => [{ timeZone: 'Europe/Paris' }],
}));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(async () => {}) }));

const me = { id: 1, display_name: 'Antoine' };
const couple = {
  id: 3,
  status: 'active',
  members: [
    { id: 1, display_name: 'Antoine' },
    { id: 2, display_name: 'Sam' },
  ],
};

type Mood = { mood: string; need: string; replies: string[] } | null;
type Call = { method: string; path: string; body?: unknown };

function backend(initial: { mine: Mood; partner: Mood }, replyStatus = 204) {
  const calls: Call[] = [];
  const state = JSON.parse(JSON.stringify({ date: '2026-11-07', ...initial }));
  mockFetch().mockImplementation(async (arg) => {
    const request = arg as Request;
    const { pathname } = new URL(request.url);
    const text = ['POST', 'PUT'].includes(request.method) ? await request.clone().text() : '';
    const body = text ? JSON.parse(text) : undefined;
    calls.push({ method: request.method, path: pathname, body });
    if (pathname === '/api/v1/me/') return jsonResponse(me);
    if (pathname === '/api/v1/couple/') return jsonResponse(couple);
    if (pathname === '/api/v1/morning/reply/') {
      if (replyStatus !== 204) return jsonResponse({ detail: 'too_many_replies' }, replyStatus);
      state.partner.replies.push(body.reply);
      return new Response(null, { status: 204 });
    }
    if (request.method === 'PUT') state.mine = { ...body, replies: state.mine?.replies ?? [] };
    if (request.method === 'DELETE') {
      state.mine = null;
      return new Response(null, { status: 204 });
    }
    return jsonResponse(state);
  });
  return calls;
}

async function render() {
  const client = createTestQueryClient();
  client.setQueryData(meKey, me);
  client.setQueryData(coupleKey, couple);
  await renderWithProviders(<TodayScreen />, 'light', client);
}

const writes = (calls: Call[]) => calls.filter((c) => c.method !== 'GET');

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('fr');
});

it('greets by first name and offers the four moods as one choice', async () => {
  backend({ mine: null, partner: null });
  await render();
  expect(await screen.findByText('Bonjour Antoine')).toBeTruthy();
  expect(screen.getByText('Comment tu te sens ce matin ?')).toBeTruthy();
  for (const label of ['Grande joie', 'Bonne humeur', 'Contrariété', 'Énervement']) {
    expect(screen.getByRole('radio', { name: label })).toBeTruthy();
  }
  expect(screen.getByTestId('partner-morning-waiting')).toHaveTextContent(
    /Sam n’a pas encore partagé sa météo\. Aucune obligation\./,
  );
});

it('shares my mood at once, then an optional need, and can take it back', async () => {
  const calls = backend({ mine: null, partner: null });
  await render();
  await fireEvent.press(await screen.findByRole('radio', { name: 'Énervement' }));
  await waitFor(() =>
    expect(
      screen.getByRole('radio', { name: 'Énervement' }).props.accessibilityState,
    ).toMatchObject({ checked: true }),
  );
  await fireEvent.press(await screen.findByTestId('need-space'));
  await waitFor(() =>
    expect(writes(calls).map((c) => c.body)).toEqual([
      { mood: 'angry', need: '' },
      { mood: 'angry', need: 'space' },
    ]),
  );
  await fireEvent.press(screen.getByTestId('mood-take-back'));
  await waitFor(() => expect(screen.queryByTestId('mood-take-back')).toBeNull());
});

it('shows the partner’s weather with how to speak, and answers in one tap', async () => {
  const calls = backend({
    mine: { mood: 'happy', need: '', replies: ['here'] },
    partner: { mood: 'angry', need: 'space', replies: [] },
  });
  await render();
  const card = await screen.findByTestId('partner-morning');
  expect(within(card).getByText('Énervement')).toBeTruthy();
  expect(within(card).getByText('D’espace')).toBeTruthy();
  expect(screen.getByTestId('partner-advice')).toHaveTextContent(
    'Laisse un peu d’espace, un mot court suffit.',
  );
  expect(screen.getByText('Sam : Je suis là')).toBeTruthy();

  await fireEvent.press(screen.getByTestId('reply-courage'));
  await waitFor(() =>
    expect(writes(calls)[0]).toEqual({
      method: 'POST',
      path: '/api/v1/morning/reply/',
      body: { reply: 'courage' },
    }),
  );
  await waitFor(() =>
    expect(screen.getByTestId('reply-courage').props.accessibilityState).toMatchObject({
      selected: true,
    }),
  );
});

it('uses the mood advice when no need is given, and explains the reply limit', async () => {
  backend({ mine: null, partner: { mood: 'upset', need: '', replies: [] } }, 429);
  await render();
  expect(await screen.findByTestId('partner-advice')).toHaveTextContent(/^Une question simple/);
  await fireEvent.press(screen.getByTestId('reply-here'));
  expect(await screen.findByTestId('reply-too-many')).toBeTruthy();
});

it('offers to turn notifications on, and has calm loading and error states', async () => {
  backend({ mine: null, partner: null });
  await render();
  expect(await screen.findByTestId('today-enable-push')).toBeTruthy();

  mockFetch().mockRejectedValue(new TypeError('Network request failed'));
  await render();
  expect(await screen.findByTestId('today-error')).toBeTruthy();
});
