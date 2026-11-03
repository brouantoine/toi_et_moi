import '@/i18n';

import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { QueryProvider } from '@/api/QueryProvider';
import { useGate } from '@/navigation/useGate';
import { ThemeProvider, useTheme } from '@/ui';

void SplashScreen.preventAutoHideAsync();

/**
 * Route access is enforced with Stack.Protected: a screen whose guard is false cannot be
 * reached (deep links included), and the router falls back to an allowed screen.
 */
function GuardedStack() {
  const { colors, scheme } = useTheme();
  const gate = useGate();

  useEffect(() => {
    if (gate !== 'loading') void SplashScreen.hideAsync();
  }, [gate]);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="join/[code]" />
        <Stack.Protected guard={gate === 'auth'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={gate === 'couple'}>
          <Stack.Screen name="couple/index" />
          <Stack.Screen name="couple/join" />
        </Stack.Protected>
        <Stack.Protected guard={gate === 'app'}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryProvider>
        <ThemeProvider>
          <GuardedStack />
        </ThemeProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
