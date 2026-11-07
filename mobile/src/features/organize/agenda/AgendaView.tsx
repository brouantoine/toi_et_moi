import { useRouter } from 'expo-router';
import { CalendarHeart, MapPin, Plus, Repeat } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api';
import {
  EmptyState,
  ErrorState,
  Icon,
  PressableScale,
  Skeleton,
  Text,
  useSurfaceStyle,
  useTheme,
} from '@/ui';

import { usePersonLabel } from '../usePersonLabel';
import { dayTitle, groupByDay, relativeDay, timeLabel } from './agendaDates';
import { EVENT_KIND_HUES, EVENT_KIND_ICONS } from './eventKinds';
import { useAgenda, type Occurrence } from './useAgenda';

function OccurrenceCard({ occurrence }: { occurrence: Occurrence }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { hues, radii, spacing } = useTheme();
  const surface = useSurfaceStyle();
  const person = usePersonLabel();
  const { event } = occurrence;
  const kind = event.kind ?? 'event';
  const hue = hues[EVENT_KIND_HUES[kind]];
  const when = occurrence.starts_at
    ? timeLabel(occurrence.starts_at, i18n.language)
    : t('organize.agenda.allDay');
  const who = person(event.concerns ?? 'us');

  return (
    <PressableScale
      testID={`agenda-event-${event.id}-${occurrence.date}`}
      accessibilityRole="button"
      accessibilityLabel={[when, event.title, event.place, who].filter(Boolean).join(', ')}
      onPress={() => router.push(`/organize/event/${event.id}`)}
      style={[
        surface,
        styles.card,
        { borderRadius: radii.lg, padding: spacing.md, gap: spacing.md },
      ]}
    >
      <View style={[styles.badge, { backgroundColor: hue.bg, borderRadius: radii.md }]}>
        <Icon icon={EVENT_KIND_ICONS[kind]} size={20} tint={hue.fg} strokeWidth={2} />
      </View>
      <View style={[styles.flex, { gap: 2 }]}>
        <Text variant="caption" style={{ color: hue.fg, fontWeight: '600' }}>
          {when}
        </Text>
        <Text variant="label" numberOfLines={2}>
          {event.title}
        </Text>
        <View style={[styles.row, { gap: spacing.smd }]}>
          {event.place ? (
            <View style={[styles.row, styles.shrink, { gap: spacing.xs }]}>
              <Icon icon={MapPin} size={14} color="textMuted" />
              <Text variant="caption" muted numberOfLines={1} style={styles.shrink}>
                {event.place}
              </Text>
            </View>
          ) : null}
          {event.recurrence === 'yearly' ? (
            <View style={[styles.row, { gap: spacing.xs }]}>
              <Icon icon={Repeat} size={14} color="textMuted" />
              <Text variant="caption" muted>
                {t('organize.agenda.yearly')}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <Text variant="overline" muted>
        {who}
      </Text>
    </PressableScale>
  );
}

export function AgendaView() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { spacing, radii } = useTheme();
  const agenda = useAgenda();
  const sections = useMemo(() => groupByDay(agenda.data ?? []), [agenda.data]);

  if (agenda.isPending) {
    return (
      <View testID="agenda-loading" style={{ padding: spacing.lg, gap: spacing.md }}>
        <Skeleton width={120} height={20} />
        <Skeleton height={76} radius={radii.lg} />
        <Skeleton height={76} radius={radii.lg} />
      </View>
    );
  }
  if (agenda.isError && !agenda.data) {
    return (
      <ErrorState
        testID="agenda-error"
        code={agenda.error instanceof ApiError ? agenda.error.code : 'network'}
        onRetry={() => void agenda.refetch()}
      />
    );
  }
  return (
    <SectionList
      testID="agenda-list"
      sections={sections}
      keyExtractor={(o) => `${o.event.id}-${o.date}`}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={{
        padding: spacing.lg,
        paddingTop: spacing.sm,
        gap: spacing.sm,
        flexGrow: 1,
      }}
      renderSectionHeader={({ section }) => {
        const relative = relativeDay(section.date);
        return (
          <Text variant="heading" style={{ marginTop: spacing.md }}>
            {relative ? t(`organize.agenda.${relative}`) : dayTitle(section.date, i18n.language)}
          </Text>
        );
      }}
      renderItem={({ item }) => <OccurrenceCard occurrence={item} />}
      ListEmptyComponent={
        <EmptyState
          testID="agenda-empty"
          icon={CalendarHeart}
          title={t('organize.agenda.emptyTitle')}
          message={t('organize.agenda.emptyMessage')}
          actionLabel={t('organize.agenda.add')}
          actionIcon={Plus}
          onAction={() => router.push('/organize/event/new')}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderCurve: 'continuous' },
  badge: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
