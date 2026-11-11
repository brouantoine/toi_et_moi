import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import { useAuthStore } from '@/auth/authStore';
import {
  jsonResponse,
  mockFetch,
  renderWithProviders,
  requestBody,
  routerMock,
} from '@/test-utils';

import { ForgotPasswordScreen } from '../ForgotPasswordScreen';
import { LoginScreen } from '../LoginScreen';
import { RegisterScreen } from '../RegisterScreen';
import { registerFieldError } from '../useAuthActions';
import { ApiError } from '@/api';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'fr' }],
  getCalendars: () => [{ timeZone: 'Europe/Paris' }],
}));

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const TOKENS = { access: 'acc', refresh: 'ref' };

beforeEach(() => {
  store.clear();
  useAuthStore.setState({ status: 'signedOut', tokens: null });
});

function urlOf(arg: Request | string): string {
  return typeof arg === 'string' ? arg : arg.url;
}

describe('LoginScreen', () => {
  it('validates fields before calling the API', async () => {
    const fetchMock = mockFetch();
    await renderWithProviders(<LoginScreen />);
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText('Indique ton email.')).toBeTruthy();
    expect(screen.getByText('Indique ton mot de passe.')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('login-email'), 'pas-un-email');
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText('Cet email ne semble pas valide.')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('signs in and stores tokens on success', async () => {
    const fetchMock = mockFetch().mockResolvedValue(jsonResponse(TOKENS));
    await renderWithProviders(<LoginScreen />);
    await fireEvent.changeText(screen.getByTestId('login-email'), ' lea@example.com ');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'mon-mot-de-passe');
    await fireEvent.press(screen.getByTestId('login-submit'));
    await waitFor(() => expect(useAuthStore.getState().status).toBe('signedIn'));
    const [request] = fetchMock.mock.calls[0]!;
    expect(urlOf(request)).toContain('/api/v1/auth/token/');
    expect(await requestBody(request)).toEqual({
      email: 'lea@example.com',
      password: 'mon-mot-de-passe',
    });
    expect(store.get('nd.access')).toBe('acc');
  });

  it('shows a calm message on bad credentials', async () => {
    mockFetch().mockResolvedValue(jsonResponse({ detail: 'No active account' }, 401));
    await renderWithProviders(<LoginScreen />);
    await fireEvent.changeText(screen.getByTestId('login-email'), 'lea@example.com');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'faux');
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText('Email ou mot de passe incorrect.')).toBeTruthy();
    expect(useAuthStore.getState().status).toBe('signedOut');
  });

  it('links to register and forgot password', async () => {
    await renderWithProviders(<LoginScreen />);
    await fireEvent.press(screen.getByTestId('login-to-register'));
    await fireEvent.press(screen.getByTestId('login-forgot'));
    expect(routerMock().push.mock.calls).toEqual([['/forgot-password']]);
    // Sign in and sign up swap places: no pile of screens to go back through.
    expect(routerMock().replace).toHaveBeenCalledWith('/register');
  });

  it('has a round back button', async () => {
    await renderWithProviders(<LoginScreen />);
    expect(screen.getByTestId('back-button')).toBeTruthy();
  });
});

describe('RegisterScreen', () => {
  async function fill(password = 'une-phrase-solide') {
    await fireEvent.changeText(screen.getByTestId('register-first-name'), 'Léa');
    await fireEvent.changeText(screen.getByTestId('register-email'), 'lea@example.com');
    await fireEvent.changeText(screen.getByTestId('register-password'), password);
  }

  it('requires a 10+ character password', async () => {
    const fetchMock = mockFetch();
    await renderWithProviders(<RegisterScreen />);
    await fill('court');
    await fireEvent.press(screen.getByTestId('register-submit'));
    expect(await screen.findByText('Au moins 10 caractères, s’il te plaît.')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('registers with device language and timezone, then signs in', async () => {
    const fetchMock = mockFetch().mockResolvedValue(
      jsonResponse({ ...TOKENS, user: { id: 1 } }, 201),
    );
    await renderWithProviders(<RegisterScreen />);
    await fill();
    await fireEvent.press(screen.getByTestId('register-submit'));
    await waitFor(() => expect(useAuthStore.getState().status).toBe('signedIn'));
    expect(await requestBody(fetchMock.mock.calls[0]![0])).toEqual({
      email: 'lea@example.com',
      password: 'une-phrase-solide',
      first_name: 'Léa',
      language: 'fr',
      timezone: 'Europe/Paris',
    });
  });

  it('maps a taken email to the email field', async () => {
    mockFetch().mockResolvedValue(jsonResponse({ email: ['exists'] }, 400));
    await renderWithProviders(<RegisterScreen />);
    await fill();
    await fireEvent.press(screen.getByTestId('register-submit'));
    expect(
      await screen.findByText('Un compte existe déjà avec cet email. Tu peux te connecter.'),
    ).toBeTruthy();
  });

  it('maps server password rejection to the password field', () => {
    const error = new ApiError(400, 'invalid', { password: ['too common'] });
    expect(registerFieldError(error)).toEqual({
      field: 'password',
      key: 'auth.errors.passwordWeak',
    });
    expect(registerFieldError(new ApiError(500, 'server', {}))).toBeNull();
    expect(registerFieldError(new Error('x'))).toBeNull();
  });

  it('shows a general message on server errors', async () => {
    mockFetch().mockResolvedValue(jsonResponse({}, 503));
    await renderWithProviders(<RegisterScreen />);
    await fill();
    await fireEvent.press(screen.getByTestId('register-submit'));
    expect(await screen.findByTestId('register-error')).toBeTruthy();
  });
});

describe('ForgotPasswordScreen', () => {
  it('always confirms calmly after sending', async () => {
    const fetchMock = mockFetch().mockResolvedValue(new Response(null, { status: 204 }));
    await renderWithProviders(<ForgotPasswordScreen />);
    await fireEvent.changeText(screen.getByTestId('forgot-email'), 'lea@example.com');
    await fireEvent.press(screen.getByTestId('forgot-submit'));
    expect(await screen.findByText('Regarde tes emails')).toBeTruthy();
    expect(urlOf(fetchMock.mock.calls[0]![0])).toContain('/api/v1/auth/password-reset/');
    // Back to the sign-in screen it came from, not a second copy of it.
    const router = routerMock() as ReturnType<typeof routerMock> & { canGoBack?: jest.Mock };
    router.canGoBack = jest.fn(() => true);
    await fireEvent.press(screen.getByTestId('forgot-back-to-login'));
    expect(router.back).toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });
});
