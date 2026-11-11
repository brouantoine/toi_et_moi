import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenWash } from './ScreenWash';
import { useTheme } from './theme';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  testID?: string;
  /** The couple's colour washing down from the top (main tabs). */
  wash?: boolean;
};

/** Base screen container: safe area, themed background, generous spacing. */
export function Screen({ children, scroll = true, testID, wash = false }: Props) {
  const { colors, spacing } = useTheme();
  const content = { padding: spacing.lg, gap: spacing.lg };
  return (
    <SafeAreaView testID={testID} style={[styles.root, { backgroundColor: colors.background }]}>
      {wash ? <ScreenWash /> : null}
      {scroll ? (
        <ScrollView contentContainerStyle={content}>{children}</ScrollView>
      ) : (
        <>{children}</>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
