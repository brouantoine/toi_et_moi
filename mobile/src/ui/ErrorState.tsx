import { CloudOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Icon } from './Icon';
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
    <View
      testID={testID}
      accessibilityRole="alert"
      style={[styles.root, { gap: spacing.md, padding: spacing.xl }]}
    >
      <Icon icon={CloudOff} size={40} color="textMuted" />
      <Text variant="heading" style={styles.center}>
        {t('errors.title')}
      </Text>
      <Text muted style={styles.center}>
        {t(`errors.${key}`)}
      </Text>
      {onRetry ? <Button label={t('common.retry')} variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
