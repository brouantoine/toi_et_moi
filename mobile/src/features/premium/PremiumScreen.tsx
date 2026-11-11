import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePartner } from '@/features/couple/usePartner';
import { Button, Icon, IconButton, Notice, palettes, PressableScale, Text, useTheme } from '@/ui';

const COUPLE = require('../../../assets/welcome/couple.png');
const INK = palettes.light.text;

/**
 * Proposed prices, shown before purchases exist. The real ones will come from the
 * stores (localized) once the subscription products are created — see HUMAN_TODO.
 */
export const PLANS = [
  { id: 'monthly', price: '1,99 €' },
  { id: 'yearly', price: '9,99 €' },
] as const;
type PlanId = (typeof PLANS)[number]['id'];

const FEATURES = [1, 2, 3, 4, 5] as const;

/** Premium offer: one purchase covers both partners. Purchases open at store release. */
export function PremiumScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, radii, spacing } = useTheme();
  const partner = usePartner();
  const [plan, setPlan] = useState<PlanId>('yearly');
  const [asked, setAsked] = useState(false);

  return (
    <View testID="premium-screen" style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <View style={[styles.hero, { backgroundColor: INK }]}>
          <Image source={COUPLE} style={styles.image} contentFit="contain" />
        </View>
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
            <Text variant="title" style={styles.center}>
              {t('premium.title')}
            </Text>
            <Text variant="label" color="primary" style={styles.center}>
              {partner
                ? t('premium.partnerFree', { name: partner.display_name })
                : t('premium.partnerFreeAlone')}
            </Text>
          </View>
          <View style={{ gap: spacing.smd }}>
            {FEATURES.map((n) => (
              <View key={n} style={[styles.row, { gap: spacing.smd }]}>
                <View style={[styles.check, { backgroundColor: colors.primarySoft }]}>
                  <Icon icon={Check} size={16} color="onPrimarySoft" strokeWidth={3} />
                </View>
                <Text style={styles.flex}>{t(`premium.feature${n}`)}</Text>
              </View>
            ))}
          </View>
          <View accessibilityRole="radiogroup" style={{ gap: spacing.smd }}>
            {PLANS.map(({ id, price }) => {
              const selected = plan === id;
              return (
                <PressableScale
                  key={id}
                  testID={`premium-plan-${id}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setPlan(id)}
                  style={[
                    styles.plan,
                    {
                      borderRadius: radii.xl,
                      padding: spacing.md,
                      backgroundColor: selected ? colors.primarySoft : colors.surfaceMuted,
                      borderColor: selected ? colors.primary : 'transparent',
                    },
                  ]}
                >
                  <View style={styles.flex}>
                    <Text variant="heading">{t(`premium.${id}`)}</Text>
                    <Text muted>
                      {t(id === 'monthly' ? 'premium.perMonth' : 'premium.perYear', { price })}
                    </Text>
                  </View>
                  {id === 'yearly' ? (
                    <View style={[styles.save, { backgroundColor: colors.primary }]}>
                      <Text variant="caption" color="onPrimary" style={styles.bold}>
                        {t('premium.save')}
                      </Text>
                    </View>
                  ) : null}
                </PressableScale>
              );
            })}
          </View>
          {asked ? <Notice testID="premium-not-yet" message={t('premium.notYet')} /> : null}
          <Button
            testID="premium-continue"
            size="lg"
            label={t('premium.continue')}
            onPress={() => setAsked(true)}
          />
        </View>
      </ScrollView>
      <View style={[styles.close, { top: insets.top + spacing.xs, left: spacing.md }]}>
        <IconButton
          testID="premium-close"
          icon={X}
          variant="overlay"
          label={t('premium.close')}
          // Opened from a link or a notification there may be nothing to go back to.
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { height: 280, justifyContent: 'flex-end', alignItems: 'center' },
  image: { width: '100%', height: 250 },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plan: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderCurve: 'continuous' },
  save: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  close: { position: 'absolute' },
});
