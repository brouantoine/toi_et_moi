import { BACKOFF_MS, invalidationKeysFor, PING_MS, SyncClient, syncUrl } from '../realtime';

class FakeSocket {
  sent: string[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
  }
  serverSays(message: object) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

function setup(token: string | null = 'jwt-1') {
  const sockets: FakeSocket[] = [];
  const onChanged = jest.fn();
  const onReady = jest.fn();
  const onUnauthorized = jest.fn(async () => undefined);
  let current = token;
  const client = new SyncClient({
    url: 'wss://api.test/ws/v1/sync/',
    getToken: () => current,
    onChanged,
    onReady,
    onUnauthorized,
    createSocket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
  });
  return {
    client,
    sockets,
    onChanged,
    onReady,
    onUnauthorized,
    setToken: (t: string) => (current = t),
  };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('helpers', () => {
  it('builds the ws url from the api url', () => {
    expect(syncUrl('https://api.nousdeux.app/')).toBe('wss://api.nousdeux.app/ws/v1/sync/');
    expect(syncUrl('http://192.168.1.10:8000')).toBe('ws://192.168.1.10:8000/ws/v1/sync/');
  });

  it('maps changes to query keys to refresh', () => {
    expect(
      invalidationKeysFor({
        type: 'changed',
        resource: 'list_items',
        id: 1,
        action: 'upsert',
        list_id: 2,
      }),
    ).toEqual([['lists']]);
    expect(
      invalidationKeysFor({ type: 'changed', resource: 'expenses', id: 1, action: 'delete' }),
    ).toEqual([['expenses']]);
    expect(
      invalidationKeysFor({ type: 'changed', resource: 'unknown', id: 1, action: 'upsert' }),
    ).toEqual([]);
  });
});

describe('SyncClient', () => {
  it('authenticates with the first message, never in the url, then forwards changes', () => {
    const { client, sockets, onChanged, onReady } = setup();
    client.start();
    const socket = sockets[0]!;
    socket.onopen?.();
    expect(JSON.parse(socket.sent[0]!)).toEqual({ type: 'auth', token: 'jwt-1' });
    socket.serverSays({ type: 'ready' });
    expect(onReady).toHaveBeenCalled();
    socket.serverSays({ type: 'changed', resource: 'lists', id: 4, action: 'upsert' });
    expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ resource: 'lists', id: 4 }));
    socket.onmessage?.({ data: 'not json' });
    client.stop();
  });

  it('pings regularly once ready', () => {
    const { client, sockets } = setup();
    client.start();
    sockets[0]!.onopen?.();
    sockets[0]!.serverSays({ type: 'ready' });
    jest.advanceTimersByTime(PING_MS);
    expect(sockets[0]!.sent.map((s) => JSON.parse(s).type)).toEqual(['auth', 'ping']);
    client.stop();
  });

  it('reconnects with a growing backoff after a drop', () => {
    const { client, sockets } = setup();
    client.start();
    sockets[0]!.onclose?.({ code: 1006 });
    jest.advanceTimersByTime(BACKOFF_MS[0] - 1);
    expect(sockets).toHaveLength(1);
    jest.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);
    sockets[1]!.onclose?.({ code: 1006 });
    jest.advanceTimersByTime(BACKOFF_MS[1]);
    expect(sockets).toHaveLength(3);
    client.stop();
  });

  it('refreshes the token when refused, then retries with the new one', async () => {
    const { client, sockets, onUnauthorized, setToken } = setup('expired');
    onUnauthorized.mockImplementation(async () => {
      setToken('fresh');
    });
    client.start();
    sockets[0]!.onclose?.({ code: 4401 });
    expect(onUnauthorized).toHaveBeenCalled();
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(BACKOFF_MS[0]);
    sockets[1]!.onopen?.();
    expect(JSON.parse(sockets[1]!.sent[0]!)).toEqual({ type: 'auth', token: 'fresh' });
    client.stop();
  });

  it('never throws when the socket is closing (an uncaught error closed the app)', () => {
    jest.useFakeTimers();
    try {
      const { client, sockets } = setup();
      client.start();
      const socket = sockets[0] as FakeSocket & { readyState?: number };
      socket.onopen?.();
      socket.serverSays({ type: 'ready' });
      // Closing, before onclose fires: React Native's WebSocket throws INVALID_STATE_ERR.
      socket.readyState = 2;
      socket.send = () => {
        throw new Error('INVALID_STATE_ERR');
      };
      expect(() => client.sendTyping(true)).not.toThrow();
      expect(client.sendSignal(1, { sdp: 'x' })).toBe(false);
      expect(() => jest.advanceTimersByTime(PING_MS)).not.toThrow();
    } finally {
      jest.useRealTimers();
    }
  });

  it('stays quiet when stopped or signed out', () => {
    const signedOut = setup(null);
    signedOut.client.start();
    expect(signedOut.sockets).toHaveLength(0);

    const { client, sockets } = setup();
    client.start();
    client.stop();
    expect(sockets[0]!.closed).toBe(true);
    sockets[0]!.onclose?.({ code: 1000 });
    jest.advanceTimersByTime(60000);
    expect(sockets).toHaveLength(1);
  });
});
