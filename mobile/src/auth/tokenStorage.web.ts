/**
 * Browser preview only (the app ships on iOS and Android): there is no keychain on the
 * web, so the pair lives in sessionStorage and disappears with the tab.
 */
import type { Tokens } from './tokenStorage';

const ACCESS = 'nd.access';
const REFRESH = 'nd.refresh';

export async function readTokens(): Promise<Tokens | null> {
  const access = globalThis.sessionStorage?.getItem(ACCESS);
  const refresh = globalThis.sessionStorage?.getItem(REFRESH);
  return access && refresh ? { access, refresh } : null;
}

export async function saveTokens(tokens: Tokens): Promise<void> {
  globalThis.sessionStorage?.setItem(ACCESS, tokens.access);
  globalThis.sessionStorage?.setItem(REFRESH, tokens.refresh);
}

export async function clearTokens(): Promise<void> {
  globalThis.sessionStorage?.removeItem(ACCESS);
  globalThis.sessionStorage?.removeItem(REFRESH);
}
