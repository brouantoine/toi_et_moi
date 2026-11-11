import { useState, type ComponentRef, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';
import { MIN_TOUCH_TARGET } from './tokens';

type Props = Omit<TextInputProps, 'style' | 'ref'> & {
  ref?: Ref<ComponentRef<typeof TextInput>>;
  label: string;
  /** Already translated error message. */
  error?: string;
  hint?: string;
};

export function Input({ ref, label, error, hint, testID, onFocus, onBlur, ...rest }: Props) {
  const { colors, radii, scheme, spacing, typography } = useTheme();
  const [focused, setFocused] = useState(false);
  // Filled field: the border only shows on focus or error.
  const borderColor = error ? colors.danger : focused ? colors.primary : 'transparent';
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="label">{label}</Text>
      <TextInput
        ref={ref}
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.textMuted}
        // Caret and selection in the couple's colour instead of the system blue.
        selectionColor={colors.primary}
        cursorColor={colors.primary}
        keyboardAppearance={scheme}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          typography.body,
          {
            color: colors.text,
            backgroundColor: colors.surfaceMuted,
            borderColor,
            borderRadius: radii.md,
            borderCurve: 'continuous',
            paddingHorizontal: spacing.md,
          },
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" style={{ color: colors.danger }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" muted>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: MIN_TOUCH_TARGET, borderWidth: 1, paddingVertical: 10 },
});
