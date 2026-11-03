import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Medallion } from './Medallion';
import { Text } from './Text';
import { useTheme } from './theme';

type Props = {
  icon: LucideIcon;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Optional leading icon of the action button. */
  actionIcon?: LucideIcon;
  testID?: string;
};

/** Kind, encouraging empty state. Never guilt-tripping. */
export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  actionIcon,
  testID,
}: Props) {
  const { spacing } = useTheme();
  return (
    <View testID={testID} style={[styles.root, { padding: spacing.xl }]}>
      <Medallion icon={icon} />
      <View style={[styles.copy, { gap: spacing.sm, marginTop: spacing.lg }]}>
        <Text variant="heading" style={styles.center}>
          {title}
        </Text>
        {message ? (
          <Text muted style={styles.center}>
            {message}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          icon={actionIcon}
          style={{ marginTop: spacing.lg }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  copy: { maxWidth: 320, alignItems: 'center' },
  center: { textAlign: 'center' },
});
