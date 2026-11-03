import { CloudOff, RotateCcw } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Medallion } from './Medallion';
import { Text } from './Text';
import { useTheme } from './theme';

type Props = {
  /** Stable error code (ApiError.code); mapped to a calm, translated message. */
  code?: string;
  onRetry?: () => void;
  testID?: string;
};

const KNOWN = ['network', 'server', 'not_found', 'throttled', 'unauthorized'];

export function ErrorState({ code, onRetry, testID }: Props) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const key = code && KNOWN.includes(code) ? code : 'generic';
  return (
    <View testID={testID} accessibilityRole="alert" style={[styles.root, { padding: spacing.xl }]}>
      <Medallion icon={CloudOff} tone="neutral" />
      <View style={[styles.copy, { gap: spacing.sm, marginTop: spacing.lg }]}>
        <Text variant="heading" style={styles.center}>
          {t('errors.title')}
        </Text>
        <Text muted style={styles.center}>
          {t(`errors.${key}`)}
        </Text>
      </View>
      {onRetry ? (
        <Button
          label={t('common.retry')}
          variant="soft"
          icon={RotateCcw}
          onPress={onRetry}
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
