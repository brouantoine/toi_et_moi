import { MapPinned, Navigation, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api';
import { usePartner } from '@/features/couple/usePartner';
import {
  Button,
  Card,
  ErrorState,
  Icon,
  LoadingState,
  Notice,
  Text,
  ToggleRow,
  useTheme,
} from '@/ui';

import { DistanceMap } from './DistanceMap';
import { formatAgo, formatKm } from './format';
import {
  ContinuousError,
  LocationDeniedError,
  useAcceptTerms,
  useDistance,
  useSetContinuous,
  useSharePosition,
  useStopSharing,
  type Distance,
} from './useDistance';

function Terms({ version, name }: { version: number; name: string }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const [accepted, setAccepted] = useState(false);
  const accept = useAcceptTerms();
  const share = useSharePosition();
  const busy = accept.isPending || share.isPending;
  return (
    <Card testID="distance-terms">
      <View style={[styles.row, { gap: spacing.sm }]}>
        <Icon icon={ShieldCheck} size={22} color="primary" />
        <Text variant="heading" style={styles.flex}>
          {t('distance.termsTitle', { name })}
        </Text>
      </View>
      {[1, 2, 3, 4, 5].map((n) => (
        <Text key={n} muted>
          {`${n}. ${t(`distance.term${n}`, { name })}`}
        </Text>
      ))}
      <ToggleRow
        testID="distance-accept"
        label={t('distance.accept')}
        value={accepted}
        onChange={setAccepted}
      />
      <ShareError error={share.error ?? accept.error} />
      <Button
        testID="distance-share"
        icon={Navigation}
        label={t('distance.share')}
        disabled={!accepted}
        loading={busy}
        onPress={() => accept.mutate(version, { onSuccess: () => share.mutate() })}
      />
    </Card>
  );
}

function ShareError({ error }: { error: Error | null }) {
  const { t } = useTranslation();
  if (!error) return null;
  if (error instanceof LocationDeniedError) {
    return (
      <Notice
        testID="distance-denied"
        tone="warning"
        message={t('distance.denied')}
        actionLabel={t('distance.openSettings')}
        onAction={() => void Linking.openSettings()}
      />
    );
  }
  return <Notice testID="distance-error" tone="warning" message={t('distance.error')} />;
}

function Shared({ data, name }: { data: Distance; name: string }) {
  const { t, i18n } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  const share = useSharePosition();
  const stop = useStopSharing();
  const continuous = useSetContinuous();
  const mine = data.mine.position;
  const theirs = data.partner.position;
  const points = [mine, theirs].filter(Boolean);
  // Android maps need a paid-account Google Maps key: Android shows the summary card only.
  // iOS keeps the map (Apple Maps, no key).
  const showMap = Platform.OS !== 'android' && points.length > 0;

  const confirmStop = () =>
    Alert.alert(t('distance.stopTitle'), t('distance.stopMessage', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('distance.stopConfirm'), style: 'destructive', onPress: () => stop.mutate() },
    ]);

  return (
    <>
      {showMap ? (
        <View
          testID="distance-map"
          style={[styles.map, { borderRadius: radii.xl, backgroundColor: colors.surfaceMuted }]}
        >
          <DistanceMap
            mine={mine}
            theirs={theirs}
            partnerName={name}
            partnerSeen={theirs ? formatAgo(theirs.located_at, i18n.language) : undefined}
          />
        </View>
      ) : null}

      <Card testID="distance-summary">
        {data.km != null ? (
          <Text variant="title" testID="distance-km">
            {data.km === 0
              ? t('distance.under1')
              : t('distance.km', { km: formatKm(data.km, i18n.language) })}
          </Text>
        ) : (
          <Text muted testID="distance-waiting">
            {t('distance.waiting', { name })}
          </Text>
        )}
        {data.partner.city && theirs ? (
          <View style={{ gap: spacing.xxs }}>
            <Text variant="label">
              {t('distance.partnerAt', { name, city: data.partner.city.name })}
            </Text>
            <Text variant="caption" muted>
              {t('distance.updated', { when: formatAgo(theirs.located_at, i18n.language) })}
            </Text>
          </View>
        ) : null}
      </Card>

      <Card>
        <ToggleRow
          testID="distance-continuous"
          label={t('distance.continuous')}
          hint={t('distance.continuousHint')}
          value={data.mine.continuous}
          onChange={(enabled) => continuous.mutate(enabled)}
        />
        {continuous.error instanceof ContinuousError ? (
          <Notice
            testID={`distance-continuous-${continuous.error.reason}`}
            tone="warning"
            message={t(
              continuous.error.reason === 'denied'
                ? 'distance.continuousDenied'
                : 'distance.continuousUnavailable',
            )}
            actionLabel={
              continuous.error.reason === 'denied' ? t('distance.openSettings') : undefined
            }
            onAction={
              continuous.error.reason === 'denied' ? () => void Linking.openSettings() : undefined
            }
          />
        ) : null}
        {data.partner.continuous ? (
          <Text variant="caption" muted testID="distance-partner-continuous">
            {t('distance.partnerContinuous', { name })}
          </Text>
        ) : null}
      </Card>

      <ShareError error={share.error} />
      <Button
        testID="distance-refresh"
        variant="soft"
        icon={Navigation}
        label={t('distance.refresh')}
        loading={share.isPending}
        onPress={() => share.mutate()}
      />
      <Button
        testID="distance-stop"
        variant="ghost"
        label={t('distance.stop')}
        loading={stop.isPending}
        onPress={confirmStop}
      />
    </>
  );
}

/** Distance and map between the two of you, after both accepted the terms. */
export function DistanceScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, spacing } = useTheme();
  const query = useDistance();
  const partner = usePartner();
  const name = partner?.display_name ?? '';

  if (query.isPending) return <LoadingState testID="distance-loading" />;
  if (query.isError) {
    return (
      <ErrorState
        testID="distance-load-error"
        code={query.error instanceof ApiError ? query.error.code : 'network'}
        onRetry={() => void query.refetch()}
      />
    );
  }
  const data = query.data;
  return (
    <ScrollView
      testID="distance-screen"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        padding: spacing.lg,
        gap: spacing.lg,
        paddingBottom: insets.bottom + spacing.xl,
      }}
    >
      <View style={[styles.row, { gap: spacing.sm }]}>
        <Icon icon={MapPinned} size={28} color="primary" />
        <Text variant="title">{t('distance.title')}</Text>
      </View>
      {data.mine.consented && data.mine.sharing ? (
        <Shared data={data} name={name} />
      ) : (
        <Terms version={data.terms_version} name={name} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  map: { height: 360, overflow: 'hidden', borderCurve: 'continuous' },
});
