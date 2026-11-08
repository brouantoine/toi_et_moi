import { Stack } from 'expo-router';

import { useTheme } from '@/ui';

/** Signed-out screens (welcome, onboarding, sign up, sign in): one group the root can guard. */
export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    />
  );
}
