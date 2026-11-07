import { BellRing } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api';
import { useMe, useUpdateMe } from '@/features/me/useProfile';
import { enablePush, pushStatus, type PushStatus } from '@/notifications/push';
import {
  Button,
  Card,
  ErrorState,
  LoadingState,
  Notice,
  Text,
  TimeField,
  ToggleRow,
  useTheme,
} from '@/ui';

import { hhmm, usePreferences, useUpdatePreferences, type Preferences } from './usePreferences';

const KINDS = [
  'morning_mood',
  'partner_mood',
  'memory_of_day',
  'daily_question',
  'check_in',
  'thinking_of_you',
  'pause',
  'organization',
] as const satisfies readonly (keyof Preferences)[];

function PermissionCard() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<PushStatus | 'unavailable' | null>(null);
  useEffect(() => {
    void pushStatus().then(setStatus);
  }, []);
  if (status === null || status === 'granted') return null;
  if (status === 'denied') {
    return (
      <Notice
        testID="notif-denied"
        tone="warning"
        message={t('notifications.settings.denied')}
        actionLabel={t('notifications.settings.openSettings')}
        onAction={() => void Linking.openSettings()}
      />
    );
  }
  if (status === 'unavailable') {
    return <Notice testID="notif-unavailable" message={t('notifications.settings.unavailable')} />;
  }
  return (
    <Card testID="notif-enable-card">
      <Text variant="label">{t('notifications.settings.enable')}</Text>
      <Text variant="caption" muted>
        {t('notifications.settings.enableHint')}
      </Text>
      <Button
        testID="notif-enable"
        icon={BellRing}
        label={t('notifications.settings.enable')}
        onPress={() => {
          void enablePush().then((result) =>
            setStatus(
              result === 'enabled' ? 'granted' : result === 'denied' ? 'denied' : 'unavailable',
            ),
          );
        }}
      />
    </Card>
  );
}

export function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const prefs = usePreferences();
  const update = useUpdatePreferences();
  const me = useMe();
  const updateMe = useUpdateMe();

  if (prefs.isPending) return <LoadingState testID="notif-loading" />;
  if (prefs.isError) {
    return (
      <ErrorState
        testID="notif-error"
        code={prefs.error instanceof ApiError ? prefs.error.code : 'network'}
        onRetry={() => void prefs.refetch()}
      />
    );
  }
  const p = prefs.data;
  const set = (patch: Partial<Preferences>) => update.mutate(patch);

  return (
    <ScrollView
      testID="notification-settings"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
    >
      <Text variant="title">{t('notifications.settings.title')}</Text>
      <PermissionCard />

      <View style={{ gap: spacing.sm }}>
        <Text variant="overline" muted>
          {t('notifications.settings.morningSection')}
        </Text>
        <Card>
          <TimeField
            testID="notif-morning-time"
            label={t('notifications.settings.morningTime')}
            value={hhmm(p.morning_time, '08:00')}
            onChange={(value) => set({ morning_time: value })}
          />
          <ToggleRow
            testID="notif-discreet"
            label={t('notifications.settings.discreet')}
            hint={t('notifications.settings.discreetHint')}
            value={p.discreet ?? false}
            onChange={(value) => set({ discreet: value })}
          />
        </Card>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="overline" muted>
          {t('notifications.settings.kindsSection')}
        </Text>
        <Card style={styles.compact}>
          {KINDS.map((kind) => (
            <ToggleRow
              key={kind}
              testID={`notif-kind-${kind}`}
              label={t(`notifications.settings.kinds.${kind}`)}
              value={p[kind] ?? true}
              onChange={(value) => set({ [kind]: value })}
            />
          ))}
        </Card>
      </View>

      {me.data ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="overline" muted>
            {t('notifications.settings.quietSection')}
          </Text>
          <Card>
            <Text variant="caption" muted>
              {t('notifications.settings.quietHint')}
            </Text>
            <TimeField
              testID="notif-quiet-start"
              label={t('notifications.settings.quietStart')}
              value={hhmm(me.data.quiet_hours_start, '22:00')}
              onChange={(value) => updateMe.mutate({ quiet_hours_start: value })}
            />
            <TimeField
              testID="notif-quiet-end"
              label={t('notifications.settings.quietEnd')}
              value={hhmm(me.data.quiet_hours_end, '08:00')}
              onChange={(value) => updateMe.mutate({ quiet_hours_end: value })}
            />
          </Card>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ compact: { gap: 0 } });
