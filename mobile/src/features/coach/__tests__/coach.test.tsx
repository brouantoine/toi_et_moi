import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import i18n from '@/i18n';
import {
  jsonResponse,
  mockFetch,
  renderWithProviders,
  requestBody,
  routerMock,
} from '@/test-utils';

import { CoachScreen } from '../CoachScreen';

const urlOf = (arg: Request | string) => (typeof arg === 'string' ? arg : arg.url);
const methodOf = (arg: Request | string) => (typeof arg === 'string' ? 'GET' : arg.method);

const off = {
  available: true,
  consent: { mine: false, partner: false },
  active: false,
  access: { state: 'trial', trial_ends_at: null, days_left: 30 },
  thinking: false,
  messages: [],
};
const on = {
  available: true,
  consent: { mine: true, partner: true },
  active: true,
  access: { state: 'trial', trial_ends_at: null, days_left: 30 },
  thinking: false,
  messages: [
    {
      id: 1,
      author: 'me',
      text: 'On se dispute pour le ménage.',
      created_at: '2026-11-10T10:00:00Z',
    },
    { id: 2, author: 'you', text: 'Je fais déjà beaucoup.', created_at: '2026-11-10T10:01:00Z' },
    {
      id: 3,
      author: 'coach',
      text: 'Je vous ai lus tous les deux.',
      created_at: '2026-11-10T10:02:00Z',
    },
  ],
};

function backend(thread: unknown, afterWrite: unknown = thread) {
  return mockFetch().mockImplementation(async (input) => {
    const url = urlOf(input);
    if (url.endsWith('/me/')) return jsonResponse({ id: 1, display_name: 'Antoine' });
    if (url.endsWith('/couple/')) {
      return jsonResponse({
        id: 3,
        status: 'active',
        members: [
          { id: 1, display_name: 'Antoine' },
          { id: 2, display_name: 'Sam' },
        ],
      });
    }
    if (methodOf(input) === 'DELETE') return new Response(null, { status: 204 });
    if (methodOf(input) !== 'GET') return jsonResponse(afterWrite, 201);
    return jsonResponse(thread);
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('fr');
});

it('explains the coach and lets each partner turn it on for themselves', async () => {
  const waiting = { ...off, consent: { mine: true, partner: false } };
  const fetchMock = backend(off, waiting);
  await renderWithProviders(<CoachScreen />);
  expect(await screen.findByTestId('coach-intro')).toBeTruthy();
  expect(screen.getByText(/aucun échange privé/)).toBeTruthy();
  // App Store 5.1.2(i): the third-party AI sharing is stated before consent.
  expect(screen.getByText(/fournisseur d’intelligence artificielle externe/)).toBeTruthy();
  await fireEvent.press(screen.getByTestId('coach-consent'));
  expect(await screen.findByTestId('coach-waiting')).toHaveTextContent(/En attente de Sam/);
  const put = fetchMock.mock.calls.find(([i]) => methodOf(i) === 'PUT')![0];
  expect(await requestBody(put)).toEqual({ enabled: true });
});

it('shows one conversation with who said what, and sends a message', async () => {
  const fetchMock = backend(on, { ...on, thinking: true });
  await renderWithProviders(<CoachScreen />);
  expect(await screen.findByLabelText('Toi : On se dispute pour le ménage.')).toBeTruthy();
  expect(screen.getByLabelText('Sam : Je fais déjà beaucoup.')).toBeTruthy();
  expect(screen.getByLabelText('Coach : Je vous ai lus tous les deux.')).toBeTruthy();
  await fireEvent.changeText(screen.getByTestId('coach-input'), '  Que faire ?  ');
  await fireEvent.press(screen.getByTestId('coach-send'));
  // The coach is writing: the animated bubble shows.
  expect(await screen.findByTestId('typing-bubble')).toBeTruthy();
  const post = fetchMock.mock.calls.find(([i]) => methodOf(i) === 'POST')![0];
  expect(await requestBody(post)).toEqual({ text: 'Que faire ?' });
});

it('says when the server has no key yet, and shows failures calmly', async () => {
  backend({
    ...on,
    available: false,
    messages: [
      {
        id: 9,
        author: 'notice',
        text: 'Le coach n’a pas pu répondre.',
        created_at: '2026-11-10T10:00:00Z',
      },
    ],
  });
  await renderWithProviders(<CoachScreen />);
  expect(await screen.findByTestId('coach-unavailable')).toBeTruthy();
  expect(screen.getByTestId('coach-notice-9')).toBeTruthy();
  expect(screen.getByTestId('coach-input').props.editable).toBe(false);
});

it('erases the conversation for both after confirmation', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const fetchMock = backend(on);
  await renderWithProviders(<CoachScreen />);
  await fireEvent.press(await screen.findByTestId('coach-erase'));
  alert.mock.calls[0]![2]!.find((b) => b.style === 'destructive')!.onPress!();
  await waitFor(() =>
    expect(fetchMock.mock.calls.some(([i]) => methodOf(i) === 'DELETE')).toBe(true),
  );
});

it('gives the message back in the field when it could not be sent', async () => {
  mockFetch().mockImplementation(async (input) => {
    if (methodOf(input) === 'POST') return jsonResponse({ code: 'server' }, 500);
    if (urlOf(input).endsWith('/me/')) return jsonResponse({ id: 1, display_name: 'Antoine' });
    return jsonResponse(on);
  });
  await renderWithProviders(<CoachScreen />);
  await fireEvent.changeText(await screen.findByTestId('coach-input'), 'Aide-nous');
  await fireEvent.press(screen.getByTestId('coach-send'));
  expect(await screen.findByTestId('coach-send-error')).toBeTruthy();
  expect(screen.getByTestId('coach-input').props.value).toBe('Aide-nous');
});

describe('free month, then Plus', () => {
  it('shows the days left, then a Plus wall that keeps the thread readable', async () => {
    backend({
      ...on,
      access: { state: 'trial', trial_ends_at: '2026-12-10T10:00:00Z', days_left: 3 },
    });
    await renderWithProviders(<CoachScreen />);
    expect(await screen.findByText('Essai gratuit : encore 3 jours')).toBeTruthy();

    backend({
      ...on,
      access: { state: 'expired', trial_ends_at: '2026-11-01T10:00:00Z', days_left: 0 },
    });
    await renderWithProviders(<CoachScreen />);
    expect(await screen.findByTestId('coach-plus-wall')).toBeTruthy();
    expect(screen.getByTestId('coach-input').props.editable).toBe(false);
    await fireEvent.press(screen.getByTestId('coach-go-plus'));
    expect(routerMock().push).toHaveBeenCalledWith('/premium');
  });
});
