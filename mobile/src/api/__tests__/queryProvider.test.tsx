import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { act, render } from '@testing-library/react-native';

import { useAuthStore } from '@/auth/authStore';

import { queryPersister } from '../queryClient';
import { QueryProvider } from '../QueryProvider';

jest.mock('@/auth/tokenStorage', () => ({
  readTokens: jest.fn(async () => null),
  saveTokens: jest.fn(async () => undefined),
  clearTokens: jest.fn(async () => undefined),
}));

describe('QueryProvider', () => {
  it('wipes the cached couple data when the session ends', async () => {
    const removeClient = jest.spyOn(queryPersister, 'removeClient');
    let client: QueryClient | undefined;
    function Probe() {
      client = useQueryClient();
      return null;
    }
    await act(async () => {
      await useAuthStore.getState().signIn({ access: 'a', refresh: 'r' });
    });
    await render(
      <QueryProvider>
        <Probe />
      </QueryProvider>,
    );
    act(() => client!.setQueryData(['messages'], ['private']));

    // Expired session: the middleware calls signOut directly, not the sign-out screen.
    await act(async () => {
      await useAuthStore.getState().signOut();
    });

    expect(client!.getQueryData(['messages'])).toBeUndefined();
    expect(removeClient).toHaveBeenCalled();
  });
});
