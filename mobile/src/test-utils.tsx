/** Shared test helpers: render inside theme + safe area (+ i18n in French). */
import '@/i18n';

import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '@/ui/theme';
import type { ColorScheme } from '@/ui/tokens';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

export function renderWithProviders(ui: ReactElement, scheme: ColorScheme = 'light') {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider scheme={scheme}>{ui}</ThemeProvider>
    </SafeAreaProvider>,
  );
}
