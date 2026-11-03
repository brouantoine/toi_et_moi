import { useRouter } from 'expo-router';
import { Ban, HeartHandshake, Sprout, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { BRAND } from '@/config/brand';
import { Button, Card, Icon, Screen, Text, useTheme } from '@/ui';

import { useOnboarding } from './onboardingStore';

const SLIDES: readonly { key: string; icon: LucideIcon }[] = [
  { key: 'together', icon: HeartHandshake },
  { key: 'gentle', icon: Sprout },
  { key: 'never', icon: Ban },
];

const NEVER_ITEMS = ['streaks', 'tracking', 'ads', 'private'] as const;

export function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const complete = useOnboarding((s) => s.complete);
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index] ?? SLIDES[0]!;
  const last = index === SLIDES.length - 1;

  const finish = async () => {
    await complete();
    router.replace('/welcome');
  };

  return (
    <Screen testID={`onboarding-${slide.key}`}>
      <View style={[styles.header, { gap: spacing.md }]}>
        <Icon icon={slide.icon} size={48} color="primary" />
        <Text variant="title">{t(`onboarding.${slide.key}.title`, { brand: BRAND.name })}</Text>
        <Text muted>{t(`onboarding.${slide.key}.body`)}</Text>
      </View>
      {slide.key === 'never' ? (
        <Card>
          {NEVER_ITEMS.map((item) => (
            <Text key={item} testID={`onboarding-never-${item}`}>
              {t(`onboarding.never.items.${item}`)}
            </Text>
          ))}
        </Card>
      ) : null}
      <View
        style={styles.dots}
        accessibilityLabel={t('onboarding.progress', { current: index + 1, total: SLIDES.length })}
        accessible
      >
        {SLIDES.map((s, i) => (
          <View
            key={s.key}
            style={[styles.dot, { backgroundColor: i === index ? colors.primary : colors.border }]}
          />
        ))}
      </View>
      <Button
        testID="onboarding-next"
        label={last ? t('onboarding.start') : t('onboarding.next')}
        onPress={() => (last ? void finish() : setIndex(index + 1))}
      />
      {!last ? (
        <Button
          testID="onboarding-skip"
          variant="ghost"
          label={t('onboarding.skip')}
          onPress={() => void finish()}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'flex-start' },
  dots: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
