import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';
import { Alert, type AlertButton } from 'react-native';

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
import { registerOfflineMutations } from '@/api/offline';
import { toIsoDate } from '@/ui';

import { agendaRange, dayTitle, groupByDay, relativeDay, toInstant } from '../agenda/agendaDates';
import { eventPayload, emptyEventForm } from '../agenda/eventForm';
import { EventFormScreen } from '../agenda/EventFormScreen';
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

function render(ui: React.ReactElement) {
  const client = createTestQueryClient();
  registerOfflineMutations(client);
  client.setQueryData(meKey, me);
  client.setQueryData(coupleKey, couple);
  return renderWithProviders(ui, 'light', client);
}

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    title: 'Dîner chez tes parents',
    kind: 'event',
    place: 'Lyon',
    all_day: true,
    date: toIsoDate(new Date()),
    starts_at: null,
    ends_at: null,
    recurrence: 'none',
    concerns: 'us',
    reminder_minutes: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

type Call = { method: string; path: string; body?: unknown };

function backend(occurrences: unknown[] = [], detail = event()) {
  const calls: Call[] = [];
  mockFetch().mockImplementation(async (arg) => {
    const request = arg as Request;
    const url = new URL(request.url);
    const text = ['POST', 'PATCH'].includes(request.method) ? await request.clone().text() : '';
    calls.push({
      method: request.method,
      path: url.pathname,
      body: text ? JSON.parse(text) : undefined,
    });
    if (url.pathname === '/api/v1/me/') return jsonResponse(me);
    if (url.pathname === '/api/v1/couple/') return jsonResponse(couple);
    if (url.pathname.endsWith('/occurrences/')) return jsonResponse(occurrences);
    if (request.method === 'DELETE') return new Response(null, { status: 204 });
    return jsonResponse(detail, request.method === 'POST' ? 201 : 200);
  });
  return calls;
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('fr');
});
afterEach(() => onlineManager.setOnline(true));

describe('agenda helpers', () => {
  it('computes the range and relative days', () => {
    const today = new Date(2026, 10, 7, 9);
    expect(agendaRange(today)).toEqual({ start: '2026-11-07', end: '2027-02-05' });
    expect(relativeDay('2026-11-07', today)).toBe('today');
    expect(relativeDay('2026-11-08', today)).toBe('tomorrow');
    expect(relativeDay('2026-11-09', today)).toBeNull();
    expect(dayTitle('2026-11-09', 'fr')).toBe('Lundi 9 novembre');
  });

  it('groups occurrences by day and builds UTC instants from local time', () => {
    expect(
      groupByDay([{ date: 'a' }, { date: 'a' }, { date: 'b' }]).map((s) => s.data.length),
    ).toEqual([2, 1]);
    expect(new Date(toInstant('2026-11-09', '19:30')).getHours()).toBe(19);
  });

  it('turns form values into the API body', () => {
    const base = { ...emptyEventForm(new Date(2026, 10, 7)), title: '  Ciné  ' };
    expect(eventPayload(base)).toEqual({
      title: 'Ciné',
      kind: 'event',
      place: '',
      concerns: 'us',
      recurrence: 'none',
      reminder_minutes: null,
      all_day: true,
      date: '2026-11-07',
    });
    const timed = eventPayload({
      ...base,
      allDay: false,
      time: '20:15',
      yearly: true,
      reminder: 'day',
    });
    expect(timed).toMatchObject({ all_day: false, recurrence: 'yearly', reminder_minutes: 1440 });
    expect(timed).not.toHaveProperty('date');
    expect(new Date((timed as { starts_at: string }).starts_at).getMinutes()).toBe(15);
  });
});

describe('Organize tab — agenda', () => {
  it('shows a skeleton, then a kind empty state with an action', async () => {
    let resolve: (r: Response) => void = () => {};
    mockFetch().mockReturnValue(new Promise((r) => (resolve = r)));
    await render(<OrganizeScreen />);
    expect(screen.getByTestId('agenda-loading')).toBeTruthy();
    await act(async () => resolve(jsonResponse([])));
    expect(await screen.findByTestId('agenda-empty')).toBeTruthy();
  });

  it('groups by day, names who it is for, and opens an event', async () => {
    const today = toIsoDate(new Date());
    backend([
      { date: today, starts_at: null, ends_at: null, event: event() },
      {
        date: '2099-06-21',
        starts_at: '2099-06-21T17:30:00Z',
        ends_at: null,
        event: event({
          id: 8,
          title: 'Anniversaire de Sam',
          kind: 'birthday',
          recurrence: 'yearly',
          concerns: 'you',
          all_day: false,
        }),
      },
    ]);
    await render(<OrganizeScreen />);
    expect(await screen.findByText('Dîner chez tes parents')).toBeTruthy();
    expect(screen.getByText('Aujourd’hui')).toBeTruthy();
    expect(screen.getByText('Journée')).toBeTruthy();
    expect(screen.getByText('Chaque année')).toBeTruthy();
    expect(screen.getAllByText('Sam').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByTestId(`agenda-event-7-${today}`));
    expect(routerMock().push).toHaveBeenCalledWith('/organize/event/7');
  });

  it('shows a calm error with retry', async () => {
    mockFetch().mockRejectedValue(new TypeError('Network request failed'));
    await render(<OrganizeScreen />);
    expect(await screen.findByTestId('agenda-error')).toBeTruthy();
  });

  it('keeps the other sections as "coming soon" for now', async () => {
    backend();
    await render(<OrganizeScreen />);
    await fireEvent.press(screen.getByTestId('organize-section-budget'));
    expect(screen.getByTestId('organize-budget-soon')).toBeTruthy();
  });

  it('shows an offline banner', async () => {
    backend();
    onlineManager.setOnline(false);
    await render(<OrganizeScreen />);
    expect(screen.getByTestId('organize-offline')).toBeTruthy();
  });
});

describe('Event form', () => {
  it('asks for a title', async () => {
    const calls = backend();
    await render(<EventFormScreen />);
    await fireEvent.press(screen.getByTestId('event-form-save'));
    expect(await screen.findByText('Donne un titre à cet événement.')).toBeTruthy();
    expect(calls.filter((c) => c.method !== 'GET')).toHaveLength(0);
  });

  it('creates a timed, yearly birthday for the partner', async () => {
    const calls = backend();
    await render(<EventFormScreen />);
    await fireEvent.changeText(screen.getByTestId('event-form-title'), 'Anniversaire de Sam');
    await fireEvent.press(screen.getByTestId('event-form-kind-birthday'));
    await fireEvent(screen.getByTestId('event-form-all-day'), 'valueChange', false);
    expect(screen.getByTestId('event-form-time')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('event-form-concerns-you'));
    await fireEvent(screen.getByTestId('event-form-yearly'), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('event-form-reminder-day'));
    await fireEvent.press(screen.getByTestId('event-form-save'));
    await waitFor(() => expect(routerMock().back).toHaveBeenCalled());
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.path).toBe('/api/v1/events/');
    expect(post?.body).toMatchObject({
      title: 'Anniversaire de Sam',
      kind: 'birthday',
      all_day: false,
      concerns: 'you',
      recurrence: 'yearly',
      reminder_minutes: 1440,
    });
  });

  it('edits and deletes an existing event after confirmation', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const calls = backend([], event({ title: 'Ciné' }));
    await render(<EventFormScreen eventId={7} />);
    expect(await screen.findByDisplayValue('Ciné')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('event-form-title'), 'Ciné en plein air');
    await fireEvent.press(screen.getByTestId('event-form-save'));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(calls.find((c) => c.method === 'PATCH')?.path).toBe('/api/v1/events/7/');

    await fireEvent.press(screen.getByTestId('event-form-delete'));
    const buttons = alert.mock.calls[0]?.[2] as AlertButton[];
    buttons.find((b) => b.style === 'destructive')?.onPress?.();
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'DELETE' && c.path === '/api/v1/events/7/')).toBe(true),
    );
  });

  it('queues the write when offline and closes', async () => {
    const calls = backend();
    onlineManager.setOnline(false);
    await render(<EventFormScreen />);
    await fireEvent.changeText(screen.getByTestId('event-form-title'), 'Pique-nique');
    await fireEvent.press(screen.getByTestId('event-form-save'));
    await waitFor(() => expect(routerMock().back).toHaveBeenCalled());
    expect(calls.filter((c) => c.method !== 'GET')).toHaveLength(0);
  });
});
