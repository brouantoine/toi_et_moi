import { Text as RNText, type TextProps } from 'react-native';

import { useTheme } from './theme';
import type { TypographyVariant } from './tokens';

type Props = TextProps & {
  variant?: TypographyVariant;
  muted?: boolean;
};

/** Themed text. Font scaling stays enabled for dynamic type. */
export function Text({ variant = 'body', muted = false, style, ...rest }: Props) {
  const { colors, typography } = useTheme();
  const isHeading = variant === 'title' || variant === 'heading';
  return (
    <RNText
      accessibilityRole={isHeading ? 'header' : undefined}
      style={[typography[variant], { color: muted ? colors.textMuted : colors.text }, style]}
      {...rest}
    />
  );
}
