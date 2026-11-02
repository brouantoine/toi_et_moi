import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

type Props = {
  icon: LucideIcon;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
};

/** Kind, encouraging empty state. Never guilt-tripping. */
export function EmptyState({ icon, title, message, actionLabel, onAction, testID }: Props) {
  const { spacing } = useTheme();
  return (
    <View testID={testID} style={[styles.root, { gap: spacing.md, padding: spacing.xl }]}>
      <Icon icon={icon} size={40} color="secondary" />
      <Text variant="heading" style={styles.center}>
        {title}
      </Text>
      {message ? (
        <Text muted style={styles.center}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
