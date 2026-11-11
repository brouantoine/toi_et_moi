import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton, useTheme } from '@/ui';

type Props = {
  children: ReactNode;
  testID?: string;
  /** Round back button above the content (pushed screens without a navigation bar). */
  back?: boolean;
  /** Custom back action (default: back in the stack, or home). */
  onBack?: () => void;
};

/**
 * A screen with text fields: the keyboard never hides the focused field (iOS insets),
 * and a tap on a button while the keyboard is open acts at once instead of only
 * closing the keyboard.
 */
export function FormScreen({ children, testID, back = true, onBack }: Props) {
  const { colors, spacing } = useTheme();
  return (
    <SafeAreaView testID={testID} style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      >
        {back ? (
          <View style={styles.back}>
            <BackButton onPress={onBack} />
          </View>
        ) : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  back: { alignSelf: 'flex-start' },
});
