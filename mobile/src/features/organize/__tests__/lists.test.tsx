import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import { registerOfflineMutations } from '@/api/offline';
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

import { ListScreen } from '../lists/ListScreen';
import { moved } from '../lists/useLists';
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
const groceries = {
  id: 3,
  title: 'Courses',
  kind: 'groceries',
  position: 0,
  open_items: 2,
  created_at: '',
  updated_at: '',
};

function item(id: number, text: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    text,
    done: false,
    done_by: null,
    done_at: null,
    position: id,
    created_at: '',
    ...extra,
  };
}

type Call = { method: string; path: string; body?: unknown };

function backend({
  lists = [groceries],
  items = [item(1, 'Pain'), item(2, 'Lait', { done: true, done_by: 'you' })],
  failWrites = false,
} = {}) {
  const calls: Call[] = [];
  let state = items.map((i) => ({ ...i }));
  mockFetch().mockImplementation(async (arg) => {
    const request = arg as Request;
    const { pathname } = new URL(request.url);
    const text = ['POST', 'PATCH'].includes(request.method) ? await request.clone().text() : '';
    const body = text ? JSON.parse(text) : undefined;
    calls.push({ method: request.method, path: pathname, body });
    if (pathname === '/api/v1/me/') return jsonResponse(me);
    if (pathname === '/api/v1/couple/') return jsonResponse(couple);
    if (request.method !== 'GET' && failWrites) return jsonResponse({ code: 'server' }, 500);
    if (pathname.endsWith('/occurrences/')) return jsonResponse([]);
    if (pathname === '/api/v1/lists/' && request.method === 'GET') return jsonResponse(lists);
    if (pathname.endsWith('/items/') && request.method === 'GET') return jsonResponse(state);
    const itemId = Number(pathname.match(/items\/(\d+)\/$/)?.[1]);
    if (pathname.endsWith('/items/') && request.method === 'POST')
      state.push(item(100 + state.length, body.text));
    else if (request.method === 'PATCH' && itemId)
      state = state.map((i) =>
        i.id === itemId ? { ...i, ...body, done_by: body.done ? 'me' : null } : i,
      );
    else if (request.method === 'DELETE' && itemId) state = state.filter((i) => i.id !== itemId);
    else if (pathname.endsWith('clear-done/')) state = state.filter((i) => !i.done);
    else if (pathname.endsWith('reorder/') && body?.ids)
      state = body.ids.map((id: number) => state.find((i) => i.id === id)!);
    if (
      request.method === 'DELETE' ||
      pathname.endsWith('reorder/') ||
      pathname.endsWith('clear-done/')
    )
      return new Response(null, { status: 204 });
    return jsonResponse({}, request.method === 'POST' ? 201 : 200);
  });
  return calls;
}

function render(ui: React.ReactElement) {
  const client = createTestQueryClient();
  registerOfflineMutations(client);
  client.setQueryData(meKey, me);
  client.setQueryData(coupleKey, couple);
  return renderWithProviders(ui, 'light', client);
}

const writes = (calls: Call[]) => calls.filter((c) => c.method !== 'GET');

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('fr');
});

it('moves ids up and down, unchanged at the edges', () => {
  expect(moved([1, 2, 3], 3, -1)).toEqual([1, 3, 2]);
  expect(moved([1, 2, 3], 1, -1)).toEqual([1, 2, 3]);
  expect(moved([1, 2, 3], 3, 1)).toEqual([1, 2, 3]);
});

describe('Lists section', () => {
  it('shows lists with what is left to do, opens one, and creates a new one', async () => {
    const calls = backend();
    await render(<OrganizeScreen />);
    await fireEvent.press(screen.getByTestId('organize-section-lists'));
    expect(await screen.findByText('Courses')).toBeTruthy();
    expect(screen.getByText('2 à faire')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('list-card-3'));
    expect(routerMock().push).toHaveBeenCalledWith('/organize/list/3');

    await fireEvent.changeText(screen.getByTestId('lists-new-title'), 'Films à voir');
    await fireEvent.press(screen.getByTestId('lists-new-kind-free'));
    await fireEvent.press(screen.getByTestId('lists-create'));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0]).toEqual({
      method: 'POST',
      path: '/api/v1/lists/',
      body: { title: 'Films à voir', kind: 'free' },
    });
  });

  it('has a kind empty state', async () => {
    backend({ lists: [] });
    await render(<OrganizeScreen />);
    await fireEvent.press(screen.getByTestId('organize-section-lists'));
    expect(await screen.findByTestId('lists-empty')).toBeTruthy();
  });
});

describe('List screen', () => {
  it('ticks instantly and says who ticked what', async () => {
    const calls = backend();
    await render(<ListScreen listId={3} />);
    expect(await screen.findByText('Coché par Sam')).toBeTruthy();
    const pain = screen.getByTestId('list-item-1');
    expect(pain.props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(pain);
    expect(screen.getByTestId('list-item-1').props.accessibilityState).toMatchObject({
      checked: true,
    });
    await waitFor(() =>
      expect(writes(calls)[0]).toEqual({
        method: 'PATCH',
        path: '/api/v1/lists/3/items/1/',
        body: { done: true },
      }),
    );
  });

  it('adds items one after the other', async () => {
    const calls = backend();
    await render(<ListScreen listId={3} />);
    await screen.findByText('Pain');
    await fireEvent.changeText(screen.getByTestId('list-add-input'), '  Clémentines ');
    await fireEvent(screen.getByTestId('list-add-input'), 'submitEditing');
    expect(await screen.findByText('Clémentines')).toBeTruthy();
    expect(screen.getByTestId('list-add-input').props.value).toBe('');
    await waitFor(() => expect(writes(calls)[0]?.body).toEqual({ text: 'Clémentines' }));
  });

  it('reorders with accessible up/down buttons', async () => {
    const calls = backend();
    await render(<ListScreen listId={3} />);
    await screen.findByText('Pain');
    await fireEvent.press(screen.getByTestId('list-reorder'));
    await fireEvent.press(screen.getByRole('button', { name: 'Descendre Pain' }));
    await waitFor(() =>
      expect(writes(calls)[0]).toEqual({
        method: 'POST',
        path: '/api/v1/lists/3/items/reorder/',
        body: { ids: [2, 1] },
      }),
    );
  });

  it('removes ticked items and deletes the list after confirmation', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const calls = backend();
    await render(<ListScreen listId={3} />);
    await screen.findByText('Lait');
    await fireEvent.press(screen.getByTestId('list-clear-done'));
    await waitFor(() => expect(screen.queryByText('Lait')).toBeNull());
    await fireEvent.press(screen.getByTestId('list-delete'));
    (alert.mock.calls[0]?.[2] as AlertButton[]).find((b) => b.style === 'destructive')?.onPress?.();
    await waitFor(() => expect(routerMock().back).toHaveBeenCalled());
    expect(writes(calls).map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /api/v1/lists/3/items/clear-done/',
      'DELETE /api/v1/lists/3/',
    ]);
  });

  it('rolls back when the server refuses', async () => {
    backend({ failWrites: true });
    await render(<ListScreen listId={3} />);
    await screen.findByText('Pain');
    await fireEvent.press(screen.getByTestId('list-item-1'));
    await waitFor(() =>
      expect(screen.getByTestId('list-item-1').props.accessibilityState).toMatchObject({
        checked: false,
      }),
    );
    expect(within(screen.getByTestId('list-screen')).getByText('Pain')).toBeTruthy();
  });
});
