import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BRAND } from '@/config/brand';
import { Button, FadeIn, palettes, Text, ThemeProvider, useTheme } from '@/ui';

import { CoupleIllustration } from './CoupleIllustration';

/** The caricature and the logo are drawn on ink: this one screen is dark, on purpose. */
const INK = palettes.light.text;

/**
 * First screen for signed-out people: the couple and their little moments floating
 * around, what the app is in one line, then create an account or sign in.
 */
export function WelcomeScreen() {
  const { accent } = useTheme();
  return (
    <ThemeProvider scheme="dark" accent={accent}>
      <WelcomeContent />
    </ThemeProvider>
  );
}

function WelcomeContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const { spacing } = useTheme();
  return (
    <SafeAreaView testID="welcome-screen" style={[styles.root, { backgroundColor: INK }]}>
      <StatusBar style="light" />
      <ScrollView
        bounces={false}
        contentContainerStyle={[styles.content, { padding: spacing.lg, gap: spacing.xl }]}
      >
        <View style={[styles.hero, { gap: spacing.lg }]}>
          <CoupleIllustration accessibilityLabel={t('welcome.illustration')} />
          <FadeIn delay={200}>
            <View style={[styles.copy, { gap: spacing.sm }]}>
              <Text variant="display" style={styles.center}>
                {t('welcome.title', { brand: BRAND.name })}
              </Text>
              <Text variant="lead" muted style={styles.center}>
                {t('welcome.subtitle')}
              </Text>
            </View>
          </FadeIn>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Button
            testID="welcome-start"
            size="lg"
            label={t('welcome.start')}
            onPress={() => router.push('/register')}
          />
          <Button
            testID="welcome-login"
            variant="ghost"
            label={t('welcome.login')}
            onPress={() => router.push('/login')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'space-between' },
  center: { textAlign: 'center' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  copy: { maxWidth: 340, alignItems: 'center' },
});
