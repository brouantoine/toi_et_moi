import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

import { NotificationSettingsScreen } from '@/features/notifications/NotificationSettingsScreen';
import { meKey } from '@/features/me/useProfile';
import i18n from '@/i18n';
import { createTestQueryClient, jsonResponse, mockFetch, renderWithProviders } from '@/test-utils';

import { enablePush, forgetThisPhone } from '../push';
import { handleResponse, routeFor, runAction } from '../responses';
import { configureNotifications, moodAction, replyAction } from '../setup';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'fr' }],
  getCalendars: () => [{ timeZone: 'Europe/Paris' }],
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'proj-1' } } } },
}));

const notif = jest.mocked(Notifications);
type Call = { method: string; path: string; body?: unknown };

function backend(prefs: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  mockFetch().mockImplementation(async (arg) => {
    const request = arg as Request;
    const { pathname } = new URL(request.url);
    const text = ['POST', 'PATCH', 'PUT'].includes(request.method)
      ? await request.clone().text()
      : '';
    const body = text ? JSON.parse(text) : undefined;
    calls.push({ method: request.method, path: pathname, body });
    if (pathname === '/api/v1/notifications/preferences/') {
      return jsonResponse({
        morning_mood: true,
        partner_mood: true,
        memory_of_day: true,
        daily_question: true,
        check_in: true,
        thinking_of_you: true,
        pause: true,
        organization: true,
        morning_time: '08:00:00',
        discreet: false,
        ...prefs,
        ...(body ?? {}),
      });
    }
    if (pathname === '/api/v1/me/')
      return jsonResponse({
        id: 1,
        display_name: 'Antoine',
        quiet_hours_start: '22:00:00',
        quiet_hours_end: '08:00:00',
        ...(body ?? {}),
      });
    return new Response(null, { status: 204 });
  });
  return calls;
}

const writes = (calls: Call[]) => calls.filter((c) => c.method !== 'GET');

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await i18n.changeLanguage('fr');
});

describe('registration', () => {
  it('registers this phone once permission is given', async () => {
    const calls = backend();
    expect(await enablePush()).toBe('enabled');
    expect(notif.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'proj-1' });
    expect(writes(calls)[0]).toMatchObject({
      method: 'POST',
      path: '/api/v1/notifications/devices/',
      body: { token: 'ExponentPushToken[test]' },
    });
    await forgetThisPhone();
    expect(writes(calls)[1]).toMatchObject({
      path: '/api/v1/notifications/devices/forget/',
      body: { token: 'ExponentPushToken[test]' },
    });
  });

  it('accepts a refusal without crashing', async () => {
    const calls = backend();
    notif.requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' } as never);
    expect(await enablePush()).toBe('denied');
    expect(writes(calls)).toHaveLength(0);
  });

  it('skips registration while EAS is not set up', async () => {
    const calls = backend();
    const extra = Constants.expoConfig!.extra!;
    const saved = extra.eas;
    delete extra.eas;
    expect(await enablePush()).toBe('unavailable');
    extra.eas = saved;
    expect(writes(calls)).toHaveLength(0);
  });
});

describe('taps and buttons', () => {
  it('registers action buttons in the person’s language', async () => {
    await configureNotifications(i18n.t.bind(i18n));
    const [category, actions] = notif.setNotificationCategoryAsync.mock.calls[0]!;
    expect(category).toBe('morning_mood');
    expect(actions.map((a) => [a.identifier, a.buttonTitle])).toEqual([
      ['mood:joyful', 'Grande joie'],
      ['mood:happy', 'Bonne humeur'],
      ['mood:upset', 'Contrariété'],
      ['mood:angry', 'Énervement'],
    ]);
  });

  it('answers straight from the notification, then opens the right screen', async () => {
    const calls = backend();
    await runAction(moodAction('angry'));
    await runAction(replyAction('here'));
    await runAction('mood:unknown');
    expect(writes(calls)).toEqual([
      { method: 'PUT', path: '/api/v1/morning/today/', body: { mood: 'angry', need: '' } },
      { method: 'POST', path: '/api/v1/morning/reply/', body: { reply: 'here' } },
    ]);
    expect(routeFor({ screen: 'memories' })).toBe('/memories');
    expect(routeFor({ screen: '../../evil' })).toBe('/today');

    const navigate = jest.fn();
    await handleResponse(
      {
        actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
        notification: { request: { content: { data: { screen: 'today' } } } },
      } as never,
      navigate,
    );
    expect(navigate).toHaveBeenCalledWith('/today');
    expect(writes(calls)).toHaveLength(2);
  });
});

describe('Notification settings', () => {
  function render() {
    const client = createTestQueryClient();
    client.setQueryData(meKey, {
      id: 1,
      display_name: 'Antoine',
      quiet_hours_start: '22:00:00',
      quiet_hours_end: '08:00:00',
    });
    return renderWithProviders(<NotificationSettingsScreen />, 'light', client);
  }

  it('offers to turn notifications on, gently', async () => {
    const calls = backend();
    await render();
    await fireEvent.press(await screen.findByTestId('notif-enable'));
    await waitFor(() => expect(screen.queryByTestId('notif-enable-card')).toBeNull());
    expect(writes(calls).some((c) => c.path === '/api/v1/notifications/devices/')).toBe(true);
  });

  it('saves each switch, the discreet mode and the morning time', async () => {
    const calls = backend();
    await render();
    await fireEvent(await screen.findByTestId('notif-kind-memory_of_day'), 'valueChange', false);
    await fireEvent(screen.getByTestId('notif-discreet'), 'valueChange', true);
    await waitFor(() =>
      expect(writes(calls).map((c) => c.body)).toEqual([
        { memory_of_day: false },
        { discreet: true },
      ]),
    );
    expect(screen.getByTestId('notif-discreet').props.value).toBe(true);
  });

  it('explains when notifications are off in the phone settings', async () => {
    backend();
    notif.getPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);
    await render();
    expect(await screen.findByTestId('notif-denied')).toBeTruthy();
    notif.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' } as never);
  });
});
