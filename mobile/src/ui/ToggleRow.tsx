import { StyleSheet, Switch, View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';
import { MIN_TOUCH_TARGET } from './tokens';

type Props = {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID?: string;
};

/** A labelled native switch; the whole row is one accessible control. */
export function ToggleRow({ label, hint, value, onChange, testID }: Props) {
  const { colors, scheme, spacing } = useTheme();
  return (
    <View style={[styles.row, { gap: spacing.md }]}>
      <View style={styles.text} importantForAccessibility="no-hide-descendants">
        <Text variant="label">{label}</Text>
        {hint ? (
          <Text variant="caption" muted>
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={hint}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.border }}
        // The thumb must contrast with its track: at night a dark thumb on the grey "off"
        // track disappeared, and a light one vanishes on the light "on" track of `encre`.
        thumbColor={
          value ? colors.onPrimary : scheme === 'dark' ? colors.textMuted : colors.surface
        }
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: MIN_TOUCH_TARGET, flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1 },
});
