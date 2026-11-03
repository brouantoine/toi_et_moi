import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BRAND } from '@/config/brand';
import { Button, Text, useTheme } from '@/ui';

const DISC = 156;
const OVERLAP = 56;

/** Two overlapping discs: two people, one shared space. Purely decorative. */
function TwoDiscs() {
  const { colors } = useTheme();
  const disc = { width: DISC, height: DISC, borderRadius: DISC / 2 };
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={{ width: DISC * 2 - OVERLAP, height: DISC }}
    >
      <View style={[styles.disc, disc, { left: 0, backgroundColor: colors.primarySoft }]} />
      <View
        style={[
          styles.disc,
          disc,
          { left: DISC - OVERLAP, backgroundColor: colors.secondarySoft, opacity: 0.92 },
        ]}
      />
      <View
        style={[
          styles.lens,
          {
            left: DISC - OVERLAP,
            width: OVERLAP,
            borderRadius: OVERLAP / 2,
            backgroundColor: colors.primary,
          },
        ]}
      />
    </View>
  );
}

/** First screen for signed-out people: who we are, then sign up or sign in. */
export function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing } = useTheme();
  return (
    <SafeAreaView
      testID="welcome-screen"
      style={[styles.root, { backgroundColor: colors.background, padding: spacing.lg }]}
    >
      <Text variant="overline" color="primary" style={styles.center}>
        {BRAND.name}
      </Text>

      <View style={[styles.hero, { gap: spacing.xl }]}>
        <TwoDiscs />
        <View style={[styles.copy, { gap: spacing.md }]}>
          <Text variant="display" style={styles.center}>
            {t('welcome.title', { brand: BRAND.name })}
          </Text>
          <Text variant="lead" muted style={styles.center}>
            {t('welcome.subtitle')}
          </Text>
        </View>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between' },
  center: { textAlign: 'center' },
  hero: { alignItems: 'center' },
  copy: { maxWidth: 340, alignItems: 'center' },
  disc: { position: 'absolute', top: 0 },
  // The shared part: a small terracotta lens where the two discs meet.
  lens: { position: 'absolute', top: (DISC - 96) / 2, height: 96, opacity: 0.18 },
});
