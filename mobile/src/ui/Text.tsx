import { Text as RNText, type TextProps } from 'react-native';

import { useTheme } from './theme';
import type { Palette, TypographyVariant } from './tokens';

type Props = TextProps & {
  variant?: TypographyVariant;
  muted?: boolean;
  /** Palette color for the text. Overrides `muted`. */
  color?: keyof Palette;
};

const HEADINGS: ReadonlySet<TypographyVariant> = new Set(['display', 'title', 'heading']);

/** Themed text. Font scaling stays enabled for dynamic type. */
export function Text({ variant = 'body', muted = false, color, style, ...rest }: Props) {
  const { colors, typography } = useTheme();
  const tone = color ? colors[color] : muted ? colors.textMuted : colors.text;
  return (
    <RNText
      accessibilityRole={HEADINGS.has(variant) ? 'header' : undefined}
      style={[
        typography[variant],
        variant === 'overline' && { textTransform: 'uppercase' },
        { color: tone },
        style,
      ]}
      {...rest}
    />
  );
}
