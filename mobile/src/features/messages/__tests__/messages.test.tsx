import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Audio from 'expo-audio';
import { Alert, type AlertButton } from 'react-native';

import { registerOfflineMutations } from '@/api/offline';
import i18n from '@/i18n';
import { createTestQueryClient, jsonResponse, mockFetch, renderWithProviders } from '@/test-utils';

import { formatDuration } from '../MessageBubbles';
import { MessagesScreen } from '../MessagesScreen';
import {
  reportTyping,
  setTypingSender,
  TYPING_EXPIRES_MS,
  TYPING_RESEND_MS,
  useTypingStore,
} from '../typing';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'fr' }],
  getCalendars: () => [{ timeZone: 'Europe/Paris' }],
}));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));

const audio = jest.mocked(Audio);

function message(id: number, fields: Record<string, unknown> = {}) {
  return {
    id,
    kind: 'text',
    text: '',
    author: 'you',
    media_url: null,
    duration_ms: null,
    width: null,
    height: null,
    created_at: '2026-11-09T18:30:00Z',
    read_at: null as string | null,
    ...fields,
  };
}

type Call = { method: string; path: string; body?: unknown };

function backend(initial: ReturnType<typeof message>[] = []) {
  const calls: Call[] = [];
  let thread = [...initial];
  mockFetch().mockImplementation(async (arg, init) => {
    if (typeof arg === 'string') {
      calls.push({ method: init?.method ?? 'GET', path: arg });
      return new Response(null, { status: 204 });
    }
    const request = arg as Request;
    const { pathname } = new URL(request.url);
    const text = request.method === 'POST' ? await request.clone().text() : '';
    const body = text ? JSON.parse(text) : undefined;
    calls.push({ method: request.method, path: pathname, body });
    if (pathname.endsWith('/upload-url/')) {
      return jsonResponse({
        key: `couples/3/messages/k.${body.content_type.startsWith('audio') ? 'm4a' : 'jpg'}`,
        url: 'https://s3.test/bucket',
        form_fields: {},
        max_bytes: 1,
        expires_in: 60,
      });
    }
    if (pathname.endsWith('/read/')) {
      thread = thread.map((m) =>
        m.author === 'you' ? { ...m, read_at: '2026-11-09T18:31:00Z' } : m,
      );
      return new Response(null, { status: 204 });
    }
    if (request.method === 'POST') {
      const created = message(100 + thread.length, { ...body, author: 'me' });
      thread = [created, ...thread];
      return jsonResponse(created, 201);
    }
    if (request.method === 'DELETE') {
      const id = Number(pathname.match(/messages\/(\d+)\//)?.[1]);
      thread = thread.filter((m) => m.id !== id);
      return new Response(null, { status: 204 });
    }
    return jsonResponse({ next: null, previous: null, results: thread });
  });
  return calls;
}

async function render() {
  const client = createTestQueryClient();
  registerOfflineMutations(client);
  await renderWithProviders(<MessagesScreen />, 'light', client);
}

/** Writes made by the user (read receipts are sent on their own). */
const writes = (calls: Call[]) =>
  calls.filter((c) => c.method !== 'GET' && !c.path.endsWith('/read/'));

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('fr');
});

it('formats durations', () => {
  expect(formatDuration(4200)).toBe('0:04');
  expect(formatDuration(65_000)).toBe('1:05');
});

it('shows both sides of the thread', async () => {
  backend([
    message(2, { text: 'Je rentre vers 19 h', author: 'me' }),
    message(1, { text: 'Tu rentres quand ?' }),
  ]);
  await render();
  expect(await screen.findByText('Tu rentres quand ?')).toBeTruthy();
  expect(screen.getByLabelText(/^Toi : Je rentre vers 19 h/)).toBeTruthy();
  expect(screen.getByLabelText(/^L’autre : Tu rentres quand \?/)).toBeTruthy();
});

it('shows one tick when sent and two when the other has read', async () => {
  backend([
    message(3, { text: 'Pas encore lu', author: 'me' }),
    message(2, { text: 'Déjà lu', author: 'me', read_at: '2026-11-09T18:40:00Z' }),
  ]);
  await render();
  expect(await screen.findByLabelText('Envoyé')).toBeTruthy();
  expect(screen.getByLabelText('Lu')).toBeTruthy();
  expect(screen.getAllByTestId(/^receipt-/)).toHaveLength(2);
});

it('tells the other I have read, only when there is something new from them', async () => {
  const calls = backend([message(1, { text: 'Tu rentres quand ?' })]);
  await render();
  await screen.findByText('Tu rentres quand ?');
  await waitFor(() => expect(calls.filter((c) => c.path.endsWith('/read/'))).toHaveLength(1));

  jest.clearAllMocks();
  const quiet = backend([message(5, { text: 'À moi seul', author: 'me' })]);
  await render();
  await screen.findAllByText('À moi seul');
  expect(quiet.some((c) => c.path.endsWith('/read/'))).toBe(false);
});

it('shows the other typing, and reports my own typing', async () => {
  const sent: boolean[] = [];
  setTypingSender((active) => sent.push(active));
  backend([message(1, { text: 'Coucou' })]);
  await render();
  await screen.findByText('Coucou');
  expect(screen.queryByTestId('typing-bubble')).toBeNull();
  await act(async () => useTypingStore.getState().setPartnerTyping(true));
  expect(await screen.findByTestId('typing-bubble')).toBeTruthy();
  await act(async () => useTypingStore.getState().setPartnerTyping(false));
  await waitFor(() => expect(screen.queryByTestId('typing-bubble')).toBeNull());

  await fireEvent.changeText(screen.getByTestId('message-input'), 'Je');
  await fireEvent.changeText(screen.getByTestId('message-input'), 'Je suis');
  expect(sent).toEqual([true]); // not re-sent on every key
  await fireEvent.changeText(screen.getByTestId('message-input'), '');
  expect(sent).toEqual([true, false]);
  setTypingSender(null);
});

it('expires a lost "typing" and throttles resends', () => {
  jest.useFakeTimers();
  try {
    useTypingStore.getState().setPartnerTyping(true);
    jest.advanceTimersByTime(TYPING_EXPIRES_MS + 1);
    expect(useTypingStore.getState().partnerTyping).toBe(false);
    const sent: boolean[] = [];
    setTypingSender((active) => sent.push(active));
    reportTyping(true, 1000);
    reportTyping(true, 2000);
    reportTyping(true, 1000 + TYPING_RESEND_MS);
    reportTyping(false, 9000);
    reportTyping(false, 9500);
    expect(sent).toEqual([true, true, false]);
  } finally {
    setTypingSender(null);
    jest.useRealTimers();
  }
});

it('sends a text at once', async () => {
  const calls = backend();
  await render();
  expect(await screen.findByTestId('messages-empty')).toBeTruthy();
  await fireEvent.changeText(screen.getByTestId('message-input'), '  Surprise ce soir  ');
  await fireEvent.press(screen.getByTestId('message-send'));
  expect(await screen.findByText('Surprise ce soir')).toBeTruthy();
  await waitFor(() =>
    expect(writes(calls)[0]).toEqual({
      method: 'POST',
      path: '/api/v1/messages/',
      body: { kind: 'text', text: 'Surprise ce soir' },
    }),
  );
  expect(screen.getByTestId('message-input').props.value).toBe('');
});

const holdMic = (pageX = 300) =>
  fireEvent(screen.getByTestId('message-record'), 'pressIn', { nativeEvent: { pageX } });
const releaseMic = () => fireEvent(screen.getByTestId('message-record'), 'pressOut');
const wait = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });

it('records while the mic is held and sends on release, with its waveform', async () => {
  const calls = backend();
  await render();
  await screen.findByTestId('messages-empty');
  await holdMic();
  expect(await screen.findByTestId('recording-timer')).toBeTruthy();
  expect(audio.setAudioModeAsync).toHaveBeenCalledWith({
    allowsRecording: true,
    playsInSilentMode: true,
  });
  await wait(700);
  await releaseMic();
  await waitFor(() =>
    expect(writes(calls).map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /api/v1/messages/upload-url/',
      'POST https://s3.test/bucket',
      'POST /api/v1/messages/',
    ]),
  );
  expect(writes(calls)[0]?.body).toEqual({ content_type: 'audio/mp4' });
  const sent = writes(calls)[2]?.body as { waveform: number[] };
  expect(sent).toMatchObject({ kind: 'voice', media_key: 'couples/3/messages/k.m4a' });
  // Metering at -20 dB becomes tall bars, resampled to a fixed count.
  expect(sent.waveform).toHaveLength(48);
  expect(sent.waveform.every((bar) => bar > 50 && bar <= 100)).toBe(true);
});

it('throws the note away when the finger slides left before release', async () => {
  const calls = backend();
  await render();
  await screen.findByTestId('messages-empty');
  await holdMic(300);
  await screen.findByTestId('recording-timer');
  await wait(700);
  await fireEvent(screen.getByTestId('message-record'), 'touchMove', {
    nativeEvent: { pageX: 150 },
  });
  expect(screen.getByTestId('release-to-cancel')).toBeTruthy();
  await releaseMic();
  await wait(50);
  expect(writes(calls)).toEqual([]);
  expect(
    (jest.requireMock('expo-audio') as { __recorder: { stop: jest.Mock } }).__recorder.stop,
  ).toHaveBeenCalled();
});

it('a quick tap explains how to record and sends nothing', async () => {
  const calls = backend();
  await render();
  await screen.findByTestId('messages-empty');
  await holdMic();
  await releaseMic();
  expect(await screen.findByTestId('record-hint')).toBeTruthy();
  expect(writes(calls)).toEqual([]);
});

it('explains a refused microphone without crashing', async () => {
  backend();
  audio.requestRecordingPermissionsAsync.mockResolvedValueOnce({ granted: false } as never);
  await render();
  await screen.findByTestId('messages-empty');
  await holdMic();
  await releaseMic();
  expect(await screen.findByTestId('mic-denied')).toBeTruthy();
  expect(screen.queryByTestId('recording-timer')).toBeNull();
});

it('plays a voice note', async () => {
  backend([message(3, { kind: 'voice', media_url: 'https://s3.test/n.m4a', duration_ms: 4200 })]);
  await render();
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Écouter la note vocale (0:04)' }),
  );
  expect(
    (jest.requireMock('expo-audio') as { __player: { play: jest.Mock } }).__player.play,
  ).toHaveBeenCalled();
});

it('deletes my own message after confirmation, never the other’s', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const calls = backend([
    message(2, { text: 'Oups', author: 'me' }),
    message(1, { text: 'Coucou' }),
  ]);
  await render();
  await fireEvent(await screen.findByTestId('message-1'), 'longPress');
  expect(alert).not.toHaveBeenCalled();
  await fireEvent(screen.getByTestId('message-2'), 'longPress');
  (alert.mock.calls[0]?.[2] as AlertButton[]).find((b) => b.style === 'destructive')?.onPress?.();
  await waitFor(() => expect(screen.queryByText('Oups')).toBeNull());
  expect(writes(calls)).toEqual([
    { method: 'DELETE', path: '/api/v1/messages/2/', body: undefined },
  ]);
});

it('has calm loading and error states', async () => {
  mockFetch().mockReturnValue(new Promise(() => {}));
  await render();
  expect(screen.getByTestId('messages-loading')).toBeTruthy();
});
