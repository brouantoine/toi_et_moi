import '@/i18n';

import { render, screen } from '@testing-library/react-native';
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
  expect(screen.getByText('Bienvenue dans Nous Deux')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Commencer' })).toBeTruthy();
});
