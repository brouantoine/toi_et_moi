import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Vibration } from 'react-native';

import i18n from '@/i18n';
import {
  jsonResponse,
  mockFetch,
  renderWithProviders,
  requestBody,
  routerMock,
} from '@/test-utils';

import { CallButtons } from '../CallButtons';
import { callDuration, CallScreen } from '../CallScreen';
import { CallWatcher } from '../CallWatcher';
import type { Call } from '../useCalls';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Medium: 'medium' },
}));

const urlOf = (arg: Request | string) => (typeof arg === 'string' ? arg : arg.url);
const methodOf = (arg: Request | string) => (typeof arg === 'string' ? 'GET' : arg.method);

function call(fields: Partial<Call> = {}): Call {
  return {
    id: 7,
    kind: 'audio',
    state: 'ringing',
    direction: 'incoming',
    created_at: '2026-11-11T20:00:00Z',
    answered_at: null,
    ended_at: null,
    media_ready: false,
    ...fields,
  };
}

function backend(current: Call | null, afterAction?: Call) {
  return mockFetch().mockImplementation(async (input) => {
    const url = urlOf(input);
    if (url.endsWith('/me/')) return jsonResponse({ id: 1, display_name: 'Antoine' });
    if (url.endsWith('/couple/')) {
      return jsonResponse({
        id: 3,
        status: 'active',
        members: [
          { id: 1, display_name: 'Antoine', avatar_url: null },
          { id: 2, display_name: 'Sam', avatar_url: null },
        ],
      });
    }
    if (url.includes('/calls/current/')) return jsonResponse({ call: current });
    if (methodOf(input) === 'POST') {
      return jsonResponse(afterAction ?? call(), url.endsWith('/calls/') ? 201 : 200);
    }
    return jsonResponse({}, 404);
  });
}

async function lastPost(fetchMock: ReturnType<typeof backend>) {
  return waitFor(() => {
    const found = fetchMock.mock.calls.filter(([i]) => methodOf(i) === 'POST').pop();
    expect(found).toBeTruthy();
    return found![0];
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('fr');
});

it('formats the call duration', () => {
  const start = '2026-11-11T20:00:00Z';
  expect(callDuration(start, new Date(start).getTime() + 135_000)).toBe('02:15');
  expect(callDuration(null, Date.now())).toBe('00:00');
});

it('calls or video calls from the conversation, then opens the call screen', async () => {
  const fetchMock = backend(null, call({ direction: 'outgoing', kind: 'video' }));
  await renderWithProviders(<CallButtons />);
  await fireEvent.press(screen.getByTestId('call-video'));
  const post = await lastPost(fetchMock);
  expect(urlOf(post)).toContain('/api/v1/calls/');
  expect(await requestBody(post)).toEqual({ kind: 'video' });
  await waitFor(() => expect(routerMock().push).toHaveBeenCalledWith('/call'));
});

it('rings with vibration, then answers an incoming call', async () => {
  const fetchMock = backend(
    call(),
    call({ state: 'ongoing', answered_at: '2026-11-11T20:00:05Z' }),
  );
  await renderWithProviders(<CallScreen />);
  expect(await screen.findByText('t’appelle')).toBeTruthy();
  expect(Vibration.vibrate).toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('call-accept'));
  expect(urlOf(await lastPost(fetchMock))).toContain('/calls/7/accept/');
});

it('declines an incoming video call', async () => {
  const fetchMock = backend(call({ kind: 'video' }), call({ state: 'declined' }));
  await renderWithProviders(<CallScreen />);
  expect(await screen.findByText('t’appelle en vidéo')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('call-decline'));
  expect(urlOf(await lastPost(fetchMock))).toContain('/calls/7/decline/');
});

it('shows the running call honestly, then hangs up', async () => {
  const ongoing = call({ state: 'ongoing', answered_at: new Date().toISOString() });
  const fetchMock = backend(ongoing, call({ state: 'ended' }));
  await renderWithProviders(<CallScreen />);
  expect(await screen.findByTestId('call-media-note')).toBeTruthy();
  expect(screen.getByTestId('call-status')).toHaveTextContent(/00:0\d/);
  expect(screen.getByTestId('call-mute').props.accessibilityState).toMatchObject({
    disabled: true,
  });
  await fireEvent.press(screen.getByTestId('call-hangup'));
  expect(urlOf(await lastPost(fetchMock))).toContain('/calls/7/end/');
  expect(await screen.findByText('Appel terminé')).toBeTruthy();
});

it('opens the call screen from anywhere when the partner calls', async () => {
  backend(call());
  await renderWithProviders(<CallWatcher />);
  await waitFor(() => expect(routerMock().push).toHaveBeenCalledWith('/call'));
});
