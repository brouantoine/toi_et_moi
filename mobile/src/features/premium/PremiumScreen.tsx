import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Check, Crown, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_URL } from '@/config/env';
import { coupleKey, useCouple } from '@/features/couple/useCouple';
import { usePartner } from '@/features/couple/usePartner';
import { Button, Icon, IconButton, Notice, palettes, PressableScale, Text, useTheme } from '@/ui';

import {
  APPLE_EULA_URL,
  buy,
  isPlusActive,
  loadPlans,
  openManage,
  purchasesAvailable,
  restore,
  type Plan,
} from './purchases';

const COUPLE = require('../../../assets/welcome/couple.png');
const INK = palettes.light.text;
const FEATURES = [1, 2, 3, 4, 5] as const;

/** Public pages served by the backend (also given to the stores). */
export function legalUrl(page: 'privacy' | 'terms' | 'support', language: string): string {
  const base = API_URL.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
  const path = page === 'support' ? '/support/' : `/legal/${page}/`;
  return `${base}${path}?lang=${language === 'en' ? 'en' : 'fr'}`;
}

/** "jusqu'au 12 décembre 2026" */
function untilDate(iso: string, language: string): string {
  return new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

function PlanCard({
  plan,
  selected,
  onPress,
}: {
  plan: Plan;
  selected: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  return (
    <PressableScale
      testID={`premium-plan-${plan.period}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
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
        <Text variant="heading">{t(`premium.${plan.period}`)}</Text>
        <Text muted>
          {t(plan.period === 'monthly' ? 'premium.perMonth' : 'premium.perYear', {
            price: plan.price,
          })}
        </Text>
        {plan.intro ? (
          <Text variant="caption" color="primary" style={styles.bold}>
            {plan.intro.price.match(/[1-9]/)
              ? t('premium.introPrice', { price: plan.intro.price })
              : t(`premium.trial.${plan.intro.periodUnit.toLowerCase()}`, {
                  count: plan.intro.periodNumberOfUnits,
                })}
          </Text>
        ) : null}
      </View>
      {plan.period === 'yearly' ? (
        <View style={[styles.save, { backgroundColor: colors.primary }]}>
          <Text variant="caption" color="onPrimary" style={styles.bold}>
            {t('premium.save')}
          </Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

/** Bolingo Plus: one subscription for both partners, sold through the stores. */
export function PremiumScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const { colors, spacing } = useTheme();
  const partner = usePartner();
  const couple = useCouple({ enabled: false });
  const available = purchasesAvailable();
  const plans = useQuery({ queryKey: ['plans'], queryFn: loadPlans, enabled: available });
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'info' | 'warning'; key: string } | null>(null);

  const plusUntil = couple.data?.plus_until;
  // The time is read once when the screen opens (pure render).
  const [openedAt] = useState(() => Date.now());
  const active = isPlusActive(plusUntil, openedAt);
  const list = plans.data ?? [];
  const chosen = list.find((p) => p.id === picked) ?? list[0];

  const afterStore = async (ok: boolean, success: string) => {
    if (ok) {
      setNotice({ tone: 'info', key: success });
      // The store tells our server within seconds; refresh to show it.
      await client.invalidateQueries({ queryKey: coupleKey });
    }
  };
  const purchase = async () => {
    if (!chosen) return;
    setBusy('buy');
    setNotice(null);
    try {
      await afterStore((await buy(chosen)) === 'bought', 'premium.thanks');
    } catch {
      setNotice({ tone: 'warning', key: 'premium.buyError' });
    } finally {
      setBusy(null);
    }
  };
  const restoreAll = async () => {
    setBusy('restore');
    setNotice(null);
    try {
      const found = await restore();
      if (found) await afterStore(true, 'premium.restored');
      else setNotice({ tone: 'info', key: 'premium.nothingToRestore' });
    } catch {
      setNotice({ tone: 'warning', key: 'premium.restoreError' });
    } finally {
      setBusy(null);
    }
  };
  const open = (url: string) => () => void Linking.openURL(url).catch(() => {});

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

          {active && plusUntil ? (
            <View testID="premium-active" style={{ gap: spacing.smd }}>
              <Notice
                icon={Crown}
                message={t('premium.active', { date: untilDate(plusUntil, i18n.language) })}
              />
              {available ? (
                <Button
                  testID="premium-manage"
                  variant="ghost"
                  label={t('premium.manage')}
                  onPress={() => void openManage().catch(() => {})}
                />
              ) : null}
            </View>
          ) : !available ? (
            <Notice testID="premium-not-yet" message={t('premium.notYet')} />
          ) : (
            <View style={{ gap: spacing.smd }}>
              <View accessibilityRole="radiogroup" style={{ gap: spacing.smd }}>
                {list.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    selected={plan.id === chosen?.id}
                    onPress={() => setPicked(plan.id)}
                  />
                ))}
              </View>
              {plans.isError ? (
                <Notice
                  testID="premium-plans-error"
                  tone="warning"
                  message={t('premium.plansError')}
                  actionLabel={t('common.retry')}
                  onAction={() => void plans.refetch()}
                />
              ) : null}
              <Button
                testID="premium-continue"
                size="lg"
                label={t('premium.continue')}
                disabled={!chosen || busy !== null}
                loading={busy === 'buy' || plans.isPending}
                onPress={() => void purchase()}
              />
              {/* App Store 3.1.2: renewal terms right next to the purchase button. Each store is
                  named only on its own platform (App Store 2.3.10). */}
              <Text testID="premium-renewal" variant="caption" muted style={styles.center}>
                {t(Platform.OS === 'android' ? 'premium.renewalAndroid' : 'premium.renewal')}
              </Text>
            </View>
          )}

          {notice ? (
            <Notice testID="premium-notice" tone={notice.tone} message={t(notice.key)} />
          ) : null}

          <View style={[styles.links, { gap: spacing.xs }]}>
            {available && !active ? (
              <Button
                testID="premium-restore"
                variant="ghost"
                label={t('premium.restore')}
                loading={busy === 'restore'}
                disabled={busy !== null}
                onPress={() => void restoreAll()}
              />
            ) : null}
            <View style={[styles.row, styles.wrap, { gap: spacing.md, justifyContent: 'center' }]}>
              <Text
                testID="premium-terms"
                variant="caption"
                color="primary"
                accessibilityRole="link"
                onPress={open(legalUrl('terms', i18n.language))}
                style={styles.link}
              >
                {t('legal.terms')}
              </Text>
              <Text
                testID="premium-privacy"
                variant="caption"
                color="primary"
                accessibilityRole="link"
                onPress={open(legalUrl('privacy', i18n.language))}
                style={styles.link}
              >
                {t('legal.privacy')}
              </Text>
              {/* Apple's licence agreement concerns App Store purchases only. */}
              {Platform.OS === 'ios' ? (
                <Text
                  testID="premium-eula"
                  variant="caption"
                  color="primary"
                  accessibilityRole="link"
                  onPress={open(APPLE_EULA_URL)}
                  style={styles.link}
                >
                  {t('legal.eula')}
                </Text>
              ) : null}
            </View>
          </View>
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
  wrap: { flexWrap: 'wrap' },
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
  links: { alignItems: 'center' },
  link: { paddingVertical: 12, textDecorationLine: 'underline' },
});
