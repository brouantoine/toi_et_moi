/** Shared test helpers: render inside query client + theme + safe area (+ i18n). */
import '@/i18n';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '@/ui/theme';
import type { ColorScheme } from '@/ui/tokens';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  scheme: ColorScheme = 'light',
  queryClient: QueryClient = createTestQueryClient(),
) {
  return render(
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider initialMetrics={METRICS}>
        <ThemeProvider scheme={scheme}>{ui}</ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>,
  );
}

/** Router spies from the global expo-router mock (see jest.setup.ts). */
export function routerMock(): Record<'push' | 'replace' | 'back' | 'dismissAll', jest.Mock> {
  return jest.requireMock<{
    __router: Record<'push' | 'replace' | 'back' | 'dismissAll', jest.Mock>;
  }>('expo-router').__router;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Replaces global fetch; returns the mock for per-test responses. */
export function mockFetch(): jest.Mock<Promise<Response>, [Request | string, RequestInit?]> {
  const fn = jest.fn<Promise<Response>, [Request | string, RequestInit?]>();
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

export async function requestBody(arg: Request | string): Promise<unknown> {
  return typeof arg === 'string' ? undefined : JSON.parse(await arg.clone().text());
}
