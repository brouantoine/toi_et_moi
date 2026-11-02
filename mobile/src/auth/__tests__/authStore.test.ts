import * as SecureStore from 'expo-secure-store';

import { useAuthStore } from '../authStore';
import { readTokens } from '../tokenStorage';

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

beforeEach(() => {
  store.clear();
  useAuthStore.setState({ status: 'loading', tokens: null });
});

describe('auth store', () => {
  it('hydrates as signed out when no tokens are stored', async () => {
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().status).toBe('signedOut');
  });

  it('signs in, persists to the secure store and hydrates back', async () => {
    await useAuthStore.getState().signIn({ access: 'a1', refresh: 'r1' });
    expect(await readTokens()).toEqual({ access: 'a1', refresh: 'r1' });
    useAuthStore.setState({ status: 'loading', tokens: null });
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn', tokens: { access: 'a1' } });
  });

  it('signs out and wipes the secure store', async () => {
    await useAuthStore.getState().signIn({ access: 'a1', refresh: 'r1' });
    await useAuthStore.getState().signOut();
    expect(useAuthStore.getState().status).toBe('signedOut');
    expect(await readTokens()).toBeNull();
  });
});
