import '@/i18n';
// Registers the background location task (must exist before the system wakes the app).
import '@/features/distance/background';

import {
  Fraunces_400Regular_Italic,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
} from '@expo-google-fonts/fraunces';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { QueryProvider } from '@/api/QueryProvider';
import { useCoupleAccent } from '@/features/couple/useCouple';
import { useGate } from '@/navigation/useGate';
import { configureNotifications } from '@/notifications/setup';
import { BackButton, ThemeProvider, useTheme } from '@/ui';

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

  useEffect(() => {
    void configureNotifications(t).catch(() => {});
  }, [t]);
  // The window behind the screens (transitions, keyboard, rotation) follows day and night,
  // so no white flash shows through at night.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);
  // Pushed screens: the round back button on the left, and a swipe from anywhere on the
  // screen goes back (iOS; Android has its system back gesture).
  const header = {
    headerShown: true,
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.primary,
    headerTitleStyle: { color: colors.text, fontWeight: '700' as const },
    // Centred on both platforms: on Android a left-aligned title would touch the button.
    headerTitleAlign: 'center' as const,
    headerShadowVisible: false,
    headerBackVisible: false,
    headerLeft: () => <BackButton />,
    // iOS 26 wraps bar items in a shared glass capsule: the round button already is one.
    ...(Platform.OS === 'ios'
      ? {
          unstable_headerLeftItems: () => [
            { type: 'custom' as const, element: <BackButton />, hidesSharedBackground: true },
          ],
        }
      : {}),
  };

  useEffect(() => {
    if (gate !== 'loading' && fontsReady) void SplashScreen.hideAsync();
  }, [gate, fontsReady]);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="join/[code]" />
        <Stack.Protected guard={gate === 'auth'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={gate === 'couple'}>
          <Stack.Screen name="couple/index" />
          {/* Opened from the setup screen: the round back button returns to it. */}
          <Stack.Screen
            name="couple/join"
            options={{ ...header, title: t('couple.join.title'), headerTitle: '' }}
          />
        </Stack.Protected>
        <Stack.Protected guard={gate === 'app'}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="settings/profile"
            // The page carries its own large title; the bar keeps only the back button.
            options={{ ...header, title: t('me.profile'), headerTitle: '' }}
          />
          <Stack.Screen
            name="settings/notifications"
            options={{ ...header, title: t('notifications.settings.title'), headerTitle: '' }}
          />
          <Stack.Screen
            name="memories/index"
            options={{ ...header, title: t('tabs.memories.title'), headerTitle: '' }}
          />
          <Stack.Screen
            name="games/list"
            options={{ ...header, title: t('games.title'), headerTitle: '' }}
          />
          <Stack.Screen
            name="games/[id]"
            // Swipe from the left edge only: the middle of the screen is for drawing.
            options={{ fullScreenGestureEnabled: false }}
          />
          <Stack.Screen name="premium" options={{ presentation: 'modal' }} />
          <Stack.Screen name="coach" options={{ ...header, title: t('coach.title') }} />
          <Stack.Screen
            name="distance"
            options={{ ...header, title: t('distance.title'), headerTitle: '' }}
          />
          <Stack.Screen
            name="settings/avatar"
            options={{ ...header, title: t('avatar.title'), headerTitle: '' }}
          />
          <Stack.Screen
            name="settings/couple"
            options={{ ...header, title: t('me.couple'), headerTitle: '' }}
          />
          <Stack.Screen
            name="memories/[id]/index"
            // Swipe back from the left edge only: the photos scroll sideways.
            options={{ fullScreenGestureEnabled: false }}
          />
          <Stack.Screen name="memories/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="organize/list/[id]" />
          <Stack.Screen name="organize/event/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="organize/expense/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="organize/expense/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="organize/event/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="memories/[id]/edit" options={{ presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

/** The whole app takes the couple's colour (Settings > Our couple). */
function CoupleThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeProvider accent={useCoupleAccent()}>{children}</ThemeProvider>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryProvider>
        <CoupleThemeProvider>
          <GuardedStack />
        </CoupleThemeProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
