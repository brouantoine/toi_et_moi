/**
 * openapi-fetch middleware: adds the Bearer token, and on a 401 refreshes the token
 * pair once (single flight shared by concurrent requests) then replays the request.
 * If the refresh fails, the user is signed out.
 */
import type { Middleware } from 'openapi-fetch';

import { useAuthStore } from '@/auth/authStore';
import type { Tokens } from '@/auth/tokenStorage';

const REFRESH_PATH = '/api/v1/auth/token/refresh/';
const NO_AUTH_PATHS = [
  '/api/v1/auth/token/',
  REFRESH_PATH,
  '/api/v1/auth/register/',
  '/api/v1/auth/social/',
  '/api/v1/auth/password-reset/',
];

const originals = new WeakMap<Request, Request>();
let refreshing: Promise<Tokens | null> | null = null;

function isPublic(url: string): boolean {
  const path = new URL(url).pathname;
  return NO_AUTH_PATHS.some((p) => path.startsWith(p));
}

async function refreshTokens(baseUrl: string): Promise<Tokens | null> {
  const current = useAuthStore.getState().tokens;
  if (!current) return null;
  try {
    const response = await fetch(`${baseUrl}${REFRESH_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refresh: current.refresh }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { access: string; refresh?: string };
    const tokens = { access: body.access, refresh: body.refresh ?? current.refresh };
    await useAuthStore.getState().updateTokens(tokens);
    return tokens;
  } catch {
    return null;
  }
}

/** Shared refresh: concurrent 401s trigger a single refresh call. */
export function refreshOnce(baseUrl: string): Promise<Tokens | null> {
  refreshing ??= refreshTokens(baseUrl).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export function authMiddleware(baseUrl: string): Middleware {
  return {
    onRequest({ request }) {
      if (isPublic(request.url)) return request;
      const access = useAuthStore.getState().tokens?.access;
      if (access) request.headers.set('Authorization', `Bearer ${access}`);
      originals.set(request, request.clone());
      return request;
    },
    async onResponse({ request, response }) {
      if (response.status !== 401 || isPublic(request.url)) return response;
      const original = originals.get(request);
      const tokens = await refreshOnce(baseUrl);
      if (!tokens || !original) {
        await useAuthStore.getState().signOut();
        return response;
      }
      const retry = original.clone();
      retry.headers.set('Authorization', `Bearer ${tokens.access}`);
      return fetch(retry);
    },
  };
}
