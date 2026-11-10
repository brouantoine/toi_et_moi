import '@/i18n';

import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '@/ui';

import { WelcomeScreen } from '../WelcomeScreen';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'fr' }] }));

it('renders the welcome copy in French with the brand name', async () => {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <ThemeProvider scheme="light">
        <WelcomeScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  expect(screen.getByText('Bolingo')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Créer mon compte' })).toBeTruthy();
  // The couple, with their little moments floating around them.
  expect(screen.getByRole('image', { name: /un couple enlacé/ })).toBeTruthy();
  expect(screen.getAllByTestId('welcome-bubble', { includeHiddenElements: true })).toHaveLength(7);
});

it('offers sign up first, and sign in for people who already have an account', async () => {
  const router = jest.requireMock<{ __router: { push: jest.Mock } }>('expo-router').__router;
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <ThemeProvider scheme="dark">
        <WelcomeScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Créer mon compte' }));
  expect(router.push).toHaveBeenLastCalledWith('/register');
  await fireEvent.press(screen.getByRole('button', { name: 'J’ai déjà un compte' }));
  expect(router.push).toHaveBeenLastCalledWith('/login');
});
