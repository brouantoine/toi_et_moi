import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from './theme';

type Props = { children: ReactNode; scroll?: boolean; testID?: string };

/** Base screen container: safe area, themed background, generous spacing. */
export function Screen({ children, scroll = true, testID }: Props) {
  const { colors, spacing } = useTheme();
  const content = { padding: spacing.lg, gap: spacing.lg };
  return (
    <SafeAreaView testID={testID} style={[styles.root, { backgroundColor: colors.background }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={content}>{children}</ScrollView>
      ) : (
        <>{children}</>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
