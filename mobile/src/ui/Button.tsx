import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';
import { MIN_TOUCH_TARGET } from './tokens';

type Variant = 'primary' | 'secondary' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityHint,
  testID,
}: Props) {
  const { colors, radii, spacing } = useTheme();
  const inactive = disabled || loading;

  const background =
    variant === 'primary'
      ? colors.primary
      : variant === 'secondary'
        ? colors.secondary
        : 'transparent';
  const foreground =
    variant === 'primary'
      ? colors.onPrimary
      : variant === 'secondary'
        ? colors.onSecondary
        : colors.primary;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: background,
          borderRadius: radii.pill,
          paddingHorizontal: spacing.lg,
          opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={foreground} />
        ) : (
          <Text variant="label" style={{ color: foreground }}>
            {label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
  content: { alignItems: 'center', justifyContent: 'center' },
});
