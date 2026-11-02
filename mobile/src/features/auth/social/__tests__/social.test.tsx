import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

import { useAuthStore } from '@/auth/authStore';
import { jsonResponse, mockFetch, renderWithProviders, requestBody } from '@/test-utils';

import { SocialButtons } from '../SocialButtons';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'fr' }],
  getCalendars: () => [{ timeZone: 'Europe/Paris' }],
}));

const appleSignIn = AppleAuthentication.signInAsync as jest.Mock;
const TOKENS = { access: 'acc', refresh: 'ref', user: { id: 1 }, created: true };

beforeEach(() => {
  useAuthStore.setState({ status: 'signedOut', tokens: null });
  Platform.OS = 'ios';
});

describe('SocialButtons', () => {
  it('signs in with Apple, sending the raw nonce and Apple the hashed one', async () => {
    appleSignIn.mockResolvedValue({ identityToken: 'apple-jwt', fullName: { givenName: 'Alex' } });
    const fetchMock = mockFetch().mockResolvedValue(jsonResponse(TOKENS));
    await renderWithProviders(<SocialButtons />);
    await fireEvent.press(await screen.findByTestId('social-apple'));
    await waitFor(() => expect(useAuthStore.getState().status).toBe('signedIn'));
    expect(appleSignIn.mock.calls[0][0].nonce).toBe('hashed-nonce');
    const [request] = fetchMock.mock.calls[0]!;
    expect((request as Request).url).toContain('/api/v1/auth/social/apple/');
    expect(await requestBody(request)).toEqual({
      id_token: 'apple-jwt',
      nonce: 'raw-nonce',
      first_name: 'Alex',
      language: 'fr',
    });
  });

  it('does nothing when the user cancels Apple sign-in', async () => {
    appleSignIn.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });
    const fetchMock = mockFetch();
    await renderWithProviders(<SocialButtons />);
    await fireEvent.press(await screen.findByTestId('social-apple'));
    await waitFor(() => expect(appleSignIn).toHaveBeenCalled());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('social-error')).toBeNull();
    expect(useAuthStore.getState().status).toBe('signedOut');
  });

  it('explains server-side refusals calmly', async () => {
    appleSignIn.mockResolvedValue({ identityToken: 'apple-jwt', fullName: null });
    mockFetch().mockResolvedValue(jsonResponse({ code: 'email_in_use' }, 400));
    await renderWithProviders(<SocialButtons />);
    await fireEvent.press(await screen.findByTestId('social-apple'));
    expect(await screen.findByText(/Un compte existe déjà avec cet email/)).toBeTruthy();
  });

  it('signs in with Google when configured (Android, no Apple button)', async () => {
    Platform.OS = 'android';
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client';
    try {
      const { GoogleSignin } = jest.requireMock<{
        GoogleSignin: Record<string, jest.Mock>;
      }>('@react-native-google-signin/google-signin');
      GoogleSignin.signIn!.mockResolvedValue({
        type: 'success',
        data: { idToken: 'google-jwt', user: { givenName: 'Gabi' } },
      });
      const fetchMock = mockFetch().mockResolvedValue(jsonResponse(TOKENS));
      await renderWithProviders(<SocialButtons />);
      expect(screen.queryByTestId('social-apple')).toBeNull();
      await fireEvent.press(screen.getByTestId('social-google'));
      await waitFor(() => expect(useAuthStore.getState().status).toBe('signedIn'));
      expect(GoogleSignin.configure).toHaveBeenCalledWith({
        webClientId: 'web-client',
        iosClientId: undefined,
      });
      expect(GoogleSignin.hasPlayServices).toHaveBeenCalled();
      const [request] = fetchMock.mock.calls[0]!;
      expect((request as Request).url).toContain('/api/v1/auth/social/google/');
      expect(await requestBody(request)).toMatchObject({ id_token: 'google-jwt', nonce: null });
    } finally {
      delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    }
  });

  it('treats a cancelled Google flow as a no-op', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client';
    try {
      const { GoogleSignin } = jest.requireMock<{
        GoogleSignin: Record<string, jest.Mock>;
      }>('@react-native-google-signin/google-signin');
      GoogleSignin.signIn!.mockResolvedValue({ type: 'cancelled', data: null });
      const fetchMock = mockFetch();
      await renderWithProviders(<SocialButtons />);
      await fireEvent.press(await screen.findByTestId('social-google'));
      await waitFor(() => expect(GoogleSignin.signIn).toHaveBeenCalled());
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    }
  });

  it('hides Apple outside iOS and renders nothing without any provider', async () => {
    Platform.OS = 'android';
    await renderWithProviders(<SocialButtons />);
    await waitFor(() => expect(screen.queryByTestId('social-buttons')).toBeNull());
  });
});
