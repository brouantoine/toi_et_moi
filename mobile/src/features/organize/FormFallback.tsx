import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton, useTheme } from '@/ui';

/**
 * Frame of a modal form while it loads or fails to load: the close button stays there,
 * so the sheet can always be left (Android has no swipe-down to dismiss).
 */
export function FormFallback({
  closeTestID,
  children,
}: {
  closeTestID: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing } = useTheme();
  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View style={[styles.topBar, { paddingHorizontal: spacing.md }]}>
        <IconButton
          testID={closeTestID}
          icon={X}
          variant="plain"
          label={t('common.close')}
          onPress={() => router.back()}
        />
      </View>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
});
