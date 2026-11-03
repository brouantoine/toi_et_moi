import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { useTheme } from './theme';
import { MIN_TOUCH_TARGET } from './tokens';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: LucideIcon;
  /** Category hue for the icon while not selected (see `hues`). */
  tint?: string;
  testID?: string;
};

const VISUAL_HEIGHT = 40;
/** Keeps the touch target at MIN_TOUCH_TARGET while the pill stays visually light. */
const SLOP = (MIN_TOUCH_TARGET - VISUAL_HEIGHT) / 2;

/** Selectable filter pill. Selected = ink fill, otherwise a quiet tinted fill. */
export function Chip({ label, selected, onPress, icon, tint, testID }: Props) {
  const { colors, radii, spacing } = useTheme();
  const fg = selected ? 'background' : 'text';
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={{ top: SLOP, bottom: SLOP }}
      style={[
        styles.chip,
        {
          borderRadius: radii.pill,
          paddingHorizontal: spacing.md,
          backgroundColor: selected ? colors.text : colors.surfaceMuted,
        },
      ]}
    >
      <View style={[styles.row, { gap: spacing.xs + 2 }]}>
        {icon ? (
          <Icon
            icon={icon}
            size={16}
            color={fg}
            tint={selected ? undefined : tint}
            strokeWidth={2}
          />
        ) : null}
        <Text variant="caption" color={fg} style={selected ? styles.labelOn : styles.label}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: { height: VISUAL_HEIGHT, justifyContent: 'center', borderCurve: 'continuous' },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { fontWeight: '500' },
  labelOn: { fontWeight: '600' },
});
