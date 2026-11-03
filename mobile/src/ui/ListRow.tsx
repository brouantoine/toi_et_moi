import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';
import { MIN_TOUCH_TARGET } from './tokens';

type Props = {
  icon: LucideIcon;
  label: string;
  hint?: string;
  onPress: () => void;
  testID?: string;
};

/** Navigation row for settings-like menus. */
export function ListRow({ icon, label, hint, onPress, testID }: Props) {
  const { colors, spacing } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { gap: spacing.md, paddingVertical: spacing.sm, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Icon icon={icon} color="secondary" />
      <View style={styles.text}>
        <Text>{label}</Text>
        {hint ? (
          <Text variant="caption" muted>
            {hint}
          </Text>
        ) : null}
      </View>
      <Icon icon={ChevronRight} size={20} color="textMuted" />
      <View style={[styles.separator, { backgroundColor: colors.border }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: MIN_TOUCH_TARGET, flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1 },
  separator: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
});
