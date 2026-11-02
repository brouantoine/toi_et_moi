import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';

export function LoadingState({ testID }: { testID?: string }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      style={[styles.root, { gap: spacing.md, padding: spacing.xl }]}
    >
      <ActivityIndicator color={colors.primary} />
      <Text muted>{t('common.loading')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ root: { alignItems: 'center', justifyContent: 'center' } });
