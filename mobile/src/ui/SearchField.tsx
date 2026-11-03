import { Search, X } from 'lucide-react-native';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Icon } from './Icon';
import { useTheme } from './theme';
import { MIN_TOUCH_TARGET } from './tokens';

type Props = Omit<TextInputProps, 'style' | 'value' | 'onChangeText'> & {
  value: string;
  onChangeText: (text: string) => void;
  /** Announced by screen readers (the field has no visible label). */
  label: string;
  /** Accessible label of the clear button. */
  clearLabel: string;
};

/** Compact search field: tinted pill, leading magnifier, clear button when filled. */
export function SearchField({ value, onChangeText, label, clearLabel, testID, ...rest }: Props) {
  const { colors, radii, spacing, typography } = useTheme();
  return (
    <View
      style={[
        styles.field,
        {
          backgroundColor: colors.surfaceMuted,
          borderRadius: radii.md,
          paddingLeft: spacing.smd,
          gap: spacing.sm,
        },
      ]}
    >
      <Icon icon={Search} size={18} color="textMuted" />
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        autoCorrect={false}
        style={[styles.input, typography.body, { color: colors.text }]}
        {...rest}
      />
      {value ? (
        <Pressable
          testID={testID ? `${testID}-clear` : undefined}
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          onPress={() => onChangeText('')}
          style={styles.clear}
        >
          <Icon icon={X} size={18} color="textMuted" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    borderCurve: 'continuous',
  },
  input: { flex: 1, paddingVertical: 10 },
  clear: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
