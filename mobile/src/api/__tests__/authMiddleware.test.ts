import * as SecureStore from 'expo-secure-store';

import { useAuthStore } from '@/auth/authStore';

import { authMiddleware } from '../authMiddleware';
import { createApiClient } from '../client';

const BASE = 'https://api.example.com';
const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fetchMock = jest.fn<Promise<Response>, [Request | string, RequestInit?]>();

function urlOf(arg: Request | string): string {
  return typeof arg === 'string' ? arg : arg.url;
}

function authHeader(arg: Request | string): string | null {
  return typeof arg === 'string' ? null : arg.headers.get('Authorization');
}

beforeEach(async () => {
  store.clear();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  await useAuthStore.getState().signIn({ access: 'old-access', refresh: 'old-refresh' });
});

const client = () => createApiClient(BASE, [authMiddleware(BASE)]);

it('adds the bearer token to authenticated requests', async () => {
  fetchMock.mockResolvedValue(json({ id: 1 }));
  await client().GET('/api/v1/me/');
  expect(authHeader(fetchMock.mock.calls[0]![0])).toBe('Bearer old-access');
});

it('never sends the token to public auth endpoints', async () => {
  fetchMock.mockResolvedValue(json({ access: 'a', refresh: 'r' }));
  await client().POST('/api/v1/auth/token/', { body: { email: 'a@b.c', password: 'x' } });
  expect(authHeader(fetchMock.mock.calls[0]![0])).toBeNull();
});

it('refreshes once on 401 and replays the request with the new token', async () => {
  fetchMock.mockImplementation(async (input) => {
    const url = urlOf(input);
    if (url.endsWith('/auth/token/refresh/'))
      return json({ access: 'new-access', refresh: 'new-r' });
    return authHeader(input) === 'Bearer new-access' ? json({ id: 7 }) : json({}, 401);
  });
  const { data } = await client().GET('/api/v1/me/');
  expect(data).toEqual({ id: 7 });
  expect(useAuthStore.getState().tokens).toEqual({ access: 'new-access', refresh: 'new-r' });
  expect(fetchMock.mock.calls.filter(([i]) => urlOf(i).endsWith('/refresh/'))).toHaveLength(1);
});

it('shares a single refresh between concurrent 401s', async () => {
  fetchMock.mockImplementation(async (input) => {
    if (urlOf(input).endsWith('/auth/token/refresh/')) return json({ access: 'new-access' });
    return authHeader(input) === 'Bearer new-access' ? json({ ok: true }) : json({}, 401);
  });
  await Promise.all([client().GET('/api/v1/me/'), client().GET('/api/v1/couple/')]);
  expect(fetchMock.mock.calls.filter(([i]) => urlOf(i).endsWith('/refresh/'))).toHaveLength(1);
  expect(useAuthStore.getState().tokens?.refresh).toBe('old-refresh');
});

it('signs out when the refresh token is rejected', async () => {
  fetchMock.mockImplementation(async (input) =>
    urlOf(input).endsWith('/auth/token/refresh/') ? json({}, 401) : json({}, 401),
  );
  const { response } = await client().GET('/api/v1/me/');
  expect(response.status).toBe(401);
  expect(useAuthStore.getState().status).toBe('signedOut');
});

it('signs out when the refresh request fails on the network', async () => {
  fetchMock.mockImplementation(async (input) => {
    if (urlOf(input).endsWith('/auth/token/refresh/')) throw new TypeError('Network');
    return json({}, 401);
  });
  await client().GET('/api/v1/me/');
  expect(useAuthStore.getState().status).toBe('signedOut');
});

/**
 * On a phone, React Native's fetch returns its own Response class: not `instanceof` the
 * global one openapi-fetch checks. Reproduced here with a look-alike object.
 */
function foreign(real: Response): Response {
  const lookAlike = {
    status: real.status,
    statusText: real.statusText,
    ok: real.ok,
    headers: real.headers,
    body: real.body,
    bodyUsed: false,
    json: () => real.json(),
    text: () => real.text(),
    blob: () => real.blob(),
    clone: () => foreign(real.clone()),
  };
  return lookAlike as unknown as Response;
}

describe('with React Native responses (not instanceof Response)', () => {
  it('signs in: a public request whose response is not modified', async () => {
    fetchMock.mockResolvedValueOnce(foreign(json({ access: 'a', refresh: 'r' })));
    const result = await client().POST('/api/v1/auth/token/', {
      body: { email: 'lea@example.com', password: 'x' },
    });
    expect(result.data).toEqual({ access: 'a', refresh: 'r' });
  });

  it('reads an authenticated request', async () => {
    fetchMock.mockResolvedValueOnce(foreign(json({ id: 1 })));
    const result = await client().GET('/api/v1/me/');
    expect(result.data).toEqual({ id: 1 });
  });

  it('refreshes on 401 and replays, returning a proper Response', async () => {
    fetchMock
      .mockResolvedValueOnce(foreign(json({ detail: 'expired' }, 401)))
      .mockResolvedValueOnce(foreign(json({ access: 'new-access', refresh: 'new-refresh' })))
      .mockResolvedValueOnce(foreign(json({ id: 1 })));
    const result = await client().GET('/api/v1/me/');
    expect(result.data).toEqual({ id: 1 });
    expect(authHeader(fetchMock.mock.calls[2]![0])).toBe('Bearer new-access');
  });
});
