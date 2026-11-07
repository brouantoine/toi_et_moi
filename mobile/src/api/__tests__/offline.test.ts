import NetInfo from '@react-native-community/netinfo';
import {
  dehydrate,
  hydrate,
  MutationObserver,
  onlineManager,
  QueryClient,
} from '@tanstack/react-query';

import { jsonResponse, mockFetch } from '@/test-utils';

import {
  OFFLINE_MUTATION_KEY,
  optimistic,
  registerOfflineMutations,
  setupOnlineManager,
  type QueuedRequest,
} from '../offline';

const clients: QueryClient[] = [];

/** Mounted like in the app (the provider subscribes it to network changes). */
function newClient(): QueryClient {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  registerOfflineMutations(client);
  client.mount();
  clients.push(client);
  return client;
}

const addItem: QueuedRequest = {
  method: 'POST',
  path: '/api/v1/lists/{list_pk}/items/',
  pathParams: { list_pk: 3 },
  body: { text: 'Pain' },
};

function urlOf(arg: Request | string): string {
  return typeof arg === 'string' ? arg : arg.url;
}

afterEach(() => {
  onlineManager.setOnline(true);
  clients.splice(0).forEach((c) => c.unmount());
});

describe('offline writes', () => {
  it('pauses a write while offline and sends it when the network is back', async () => {
    const fetch = mockFetch();
    fetch.mockResolvedValue(jsonResponse({ id: 9, text: 'Pain' }, 201));
    const client = newClient();
    onlineManager.setOnline(false);

    const observer = new MutationObserver(client, { mutationKey: OFFLINE_MUTATION_KEY });
    const sent = observer.mutate(addItem as never);
    await Promise.resolve();
    expect(observer.getCurrentResult().isPaused).toBe(true);
    expect(fetch).not.toHaveBeenCalled();

    onlineManager.setOnline(true);
    await expect(sent).resolves.toEqual({ id: 9, text: 'Pain' });
    const [request] = fetch.mock.calls[0] ?? [];
    expect(request && urlOf(request)).toMatch(/\/api\/v1\/lists\/3\/items\/$/);
    expect(typeof request === 'string' ? undefined : request?.method).toBe('POST');
  });

  it('keeps queued writes across a restart (persisted, then resumed)', async () => {
    const fetch = mockFetch();
    fetch.mockResolvedValue(jsonResponse({ id: 9 }, 201));
    const before = newClient();
    onlineManager.setOnline(false);
    void new MutationObserver(before, { mutationKey: OFFLINE_MUTATION_KEY })
      .mutate(addItem as never)
      .catch(() => {});
    await Promise.resolve();
    const saved = JSON.parse(JSON.stringify(dehydrate(before)));
    expect(saved.mutations).toHaveLength(1);

    // "Restart": a fresh client restores the cache, then resumes once online.
    const after = newClient();
    hydrate(after, saved);
    onlineManager.setOnline(true);
    await after.resumePausedMutations();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(urlOf(fetch.mock.calls[0]![0])).toMatch(/\/lists\/3\/items\/$/);
  });
});

describe('optimistic', () => {
  it('applies the change at once and can roll it back', async () => {
    const client = newClient();
    client.setQueryData(['lists'], ['Courses']);
    const rollback = await optimistic<string[]>(client, ['lists'], (current = []) => [
      ...current,
      'Films',
    ]);
    expect(client.getQueryData(['lists'])).toEqual(['Courses', 'Films']);
    rollback();
    expect(client.getQueryData(['lists'])).toEqual(['Courses']);
  });
});

describe('setupOnlineManager', () => {
  it('follows the device network state', () => {
    const listeners: ((state: object) => void)[] = [];
    jest.mocked(NetInfo.addEventListener).mockImplementation((listener) => {
      listeners.push(listener as (state: object) => void);
      return () => {};
    });
    const stop = setupOnlineManager();
    listeners.forEach((l) => l({ isConnected: false, isInternetReachable: false }));
    expect(onlineManager.isOnline()).toBe(false);
    listeners.forEach((l) => l({ isConnected: true, isInternetReachable: true }));
    expect(onlineManager.isOnline()).toBe(true);
    stop();
  });
});
