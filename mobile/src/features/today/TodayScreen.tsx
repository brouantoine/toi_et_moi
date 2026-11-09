import { BellRing } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api';
import { enablePush, pushStatus } from '@/notifications/push';
import { Button, Card, ErrorState, Skeleton, Text, useTheme } from '@/ui';

import { MyMorningCard, PartnerMorningCard } from './MorningCards';
import { CoupleHero, NextMomentCard, OnThisDayCard } from './TodayCards';
import { useMorning } from './useMorning';

function EnablePushCard() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    void pushStatus().then((status) => setVisible(status === 'undetermined'));
  }, []);
  if (!visible) return null;
  return (
    <Card testID="today-enable-push" variant="muted">
      <Text variant="label">{t('morning.enableTitle')}</Text>
      <Text variant="caption" muted>
        {t('morning.enableMessage')}
      </Text>
      <Button
        testID="today-enable-push-button"
        variant="soft"
        icon={BellRing}
        label={t('notifications.settings.enable')}
        onPress={() => void enablePush().finally(() => setVisible(false))}
      />
    </Card>
  );
}

/** Today: how each of us feels this morning, first of all. */
export function TodayScreen() {
  const { t, i18n } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  const morning = useMorning();
  const date = new Intl.DateTimeFormat(i18n.language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  let body;
  if (morning.isPending) {
    body = (
      <View testID="today-loading" style={{ gap: spacing.md }}>
        <Skeleton height={300} radius={radii.xl} />
        <Skeleton height={140} radius={radii.xl} />
      </View>
    );
  } else if (morning.isError && !morning.data) {
    body = (
      <ErrorState
        testID="today-error"
        code={morning.error instanceof ApiError ? morning.error.code : 'network'}
        onRetry={() => void morning.refetch()}
      />
    );
  } else {
    body = (
      <>
        <MyMorningCard today={morning.data} />
        <PartnerMorningCard today={morning.data} />
        <NextMomentCard />
        <OnThisDayCard />
      </>
    );
  }

  return (
    <SafeAreaView
      testID="tab-today"
      edges={['top']}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={morning.isRefetching}
            onRefresh={() => void morning.refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View>
          <Text variant="overline" color="primary">
            {date.charAt(0).toLocaleUpperCase(i18n.language) + date.slice(1)}
          </Text>
          <Text variant="title">{t('tabs.today.title')}</Text>
        </View>
        <CoupleHero />
        <EnablePushCard />
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
