import { Stack } from 'expo-router';

import { useTheme } from '@/ui';

/** Signed-out screens (welcome, onboarding, sign up, sign in): one group the root can guard. */
export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      // Same as the rest of the app: swipe back from anywhere on the screen (iOS).
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      }}
    />
  );
}
