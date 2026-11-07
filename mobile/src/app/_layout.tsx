import '@/i18n';

import {
  Fraunces_400Regular_Italic,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
} from '@expo-google-fonts/fraunces';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { QueryProvider } from '@/api/QueryProvider';
import { useGate } from '@/navigation/useGate';
import { fonts, ThemeProvider, useTheme } from '@/ui';

void SplashScreen.preventAutoHideAsync();

/**
 * Route access is enforced with Stack.Protected: a screen whose guard is false cannot be
 * reached (deep links included), and the router falls back to an allowed screen.
 */
function GuardedStack() {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const gate = useGate();
  // A font error is not fatal: the type ramp falls back to the system face.
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_400Regular_Italic,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
  });
  const fontsReady = fontsLoaded || Boolean(fontError);
  const header = {
    headerShown: true,
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.primary,
    headerTitleStyle: { color: colors.text, fontFamily: fonts.displayMedium },
    headerShadowVisible: false,
  };

  useEffect(() => {
    if (gate !== 'loading' && fontsReady) void SplashScreen.hideAsync();
  }, [gate, fontsReady]);

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
          <Stack.Screen
            name="settings/profile"
            // The page carries its own large title; the bar keeps only the back button.
            options={{ ...header, title: t('me.profile'), headerTitle: '' }}
          />
          <Stack.Screen
            name="settings/couple"
            options={{ ...header, title: t('me.couple'), headerTitle: '' }}
          />
          <Stack.Screen name="memories/[id]/index" />
          <Stack.Screen name="memories/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="organize/event/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="organize/event/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="memories/[id]/edit" options={{ presentation: 'modal' }} />
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
