import { AlertCircle, Info, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';
import { MIN_TOUCH_TARGET, type Palette } from './tokens';

type Tone = 'info' | 'warning';

type Props = {
  message: string;
  tone?: Tone;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
};

const TONES: Record<Tone, { bg: keyof Palette; fg: keyof Palette; icon: LucideIcon }> = {
  info: { bg: 'secondarySoft', fg: 'onSecondarySoft', icon: Info },
  warning: { bg: 'primarySoft', fg: 'onPrimarySoft', icon: AlertCircle },
};

/** Calm inline message, announced to screen readers, with an optional text action. */
export function Notice({ message, tone = 'info', icon, actionLabel, onAction, testID }: Props) {
  const { colors, radii, spacing } = useTheme();
  const { bg, fg, icon: defaultIcon } = TONES[tone];
  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      style={[
        styles.root,
        {
          backgroundColor: colors[bg],
          borderRadius: radii.md,
          padding: spacing.md,
          gap: spacing.smd,
        },
      ]}
    >
      <Icon icon={icon ?? defaultIcon} size={20} color={fg} />
      <View style={[styles.body, { gap: spacing.xs }]}>
        <Text variant="caption" color={fg}>
          {message}
        </Text>
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            onPress={onAction}
            hitSlop={{ top: 12, bottom: 12 }}
            style={styles.action}
          >
            <Text variant="caption" color={fg} style={styles.actionText}>
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'flex-start', borderCurve: 'continuous' },
  body: { flex: 1 },
  action: { alignSelf: 'flex-start', minHeight: MIN_TOUCH_TARGET / 2, justifyContent: 'center' },
  actionText: { fontWeight: '700', textDecorationLine: 'underline' },
});
