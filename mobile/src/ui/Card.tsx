import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from './theme';

type Variant = 'elevated' | 'muted';

type Props = {
  children: ReactNode;
  /** `elevated`: paper surface with a soft shadow. `muted`: flat tinted fill. */
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Card({ children, variant = 'elevated', style, testID }: Props) {
  const { radii, spacing } = useTheme();
  const surface = useSurfaceStyle(variant);
  return (
    <View
      testID={testID}
      style={[
        styles.base,
        surface,
        { borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Background, shadow and hairline of a surface, shared by every card-like element. */
export function useSurfaceStyle(variant: Variant = 'elevated'): ViewStyle {
  const { colors, elevation } = useTheme();
  if (variant === 'muted') return { backgroundColor: colors.surfaceMuted };
  return {
    backgroundColor: colors.surface,
    boxShadow: elevation.card === 'none' ? undefined : elevation.card,
    borderWidth: elevation.hairline ? StyleSheet.hairlineWidth : 0,
    borderColor: colors.border,
  };
}

const styles = StyleSheet.create({
  base: { borderCurve: 'continuous' },
});
