import type { LucideIcon } from 'lucide-react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { useTheme } from './theme';
import { MIN_TOUCH_TARGET, type Palette } from './tokens';

type Variant = 'primary' | 'secondary' | 'soft' | 'ghost';
type Size = 'md' | 'lg';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  /** Optional leading Lucide icon. */
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  testID?: string;
  /** Layout only (margins, alignSelf, flex). */
  style?: StyleProp<ViewStyle>;
};

const VARIANTS: Record<Variant, { bg: keyof Palette | null; fg: keyof Palette }> = {
  primary: { bg: 'primary', fg: 'onPrimary' },
  secondary: { bg: 'secondary', fg: 'onSecondary' },
  soft: { bg: 'primarySoft', fg: 'onPrimarySoft' },
  ghost: { bg: null, fg: 'primary' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  loading = false,
  accessibilityHint,
  testID,
  style,
}: Props) {
  const { colors, radii, spacing, elevation } = useTheme();
  const inactive = disabled || loading;
  const { bg, fg } = VARIANTS[variant];
  const foreground = colors[fg];
  const filled = bg !== null;

  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={[
        styles.base,
        {
          minHeight: size === 'lg' ? 56 : MIN_TOUCH_TARGET,
          backgroundColor: filled ? colors[bg] : 'transparent',
          borderRadius: radii.pill,
          paddingHorizontal: size === 'lg' ? spacing.xl : spacing.lg,
          boxShadow: variant === 'primary' && !inactive ? elevation.card : undefined,
        },
        style,
      ]}
    >
      <View style={[styles.content, { gap: spacing.sm }]}>
        {loading ? (
          <ActivityIndicator color={foreground} />
        ) : (
          <>
            {icon ? <Icon icon={icon} size={20} color={fg} strokeWidth={2} /> : null}
            <Text variant="label" style={{ color: foreground }}>
              {label}
            </Text>
          </>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { justifyContent: 'center', borderCurve: 'continuous' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
