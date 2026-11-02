import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { useTheme } from './theme';

type Props = { children: ReactNode; style?: ViewStyle; testID?: string };

export function Card({ children, style, testID }: Props) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radii.lg,
          padding: spacing.lg,
          gap: spacing.sm,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
