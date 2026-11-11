import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { BolingoLoader } from './BolingoLoader';
import { useTheme } from './theme';

export function LoadingState({ testID }: { testID?: string }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      style={[styles.root, { padding: spacing.xl }]}
    >
      <BolingoLoader size={56} decorative />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 160, alignItems: 'center', justifyContent: 'center' },
});
