import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { CalendarHeart, ChevronRight, History, PartyPopper } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useCouple } from '@/features/couple/useCouple';
import { usePartner } from '@/features/couple/usePartner';
import { useMe } from '@/features/me/useProfile';
import { EVENT_KIND_HUES, EVENT_KIND_ICONS } from '@/features/organize/agenda/eventKinds';
import { relativeDay, dayTitle, timeLabel } from '@/features/organize/agenda/agendaDates';
import { Avatar, Celebration, Icon, PressableScale, Text, useSurfaceStyle, useTheme } from '@/ui';

import { daysTogether, nextMilestone } from './milestones';
import { useNextMoment, useOnThisDay } from './useToday';

function MilestonePill({ start }: { start: string }) {
  const { t } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  const milestone = nextMilestone(start);
  if (!milestone) return null;
  const today = milestone.inDays === 0;
  const text =
    milestone.kind === 'years'
      ? t(today ? 'today.milestoneTodayYears' : 'today.milestoneYears', {
          count: milestone.value,
          days: milestone.inDays,
        })
      : t(today ? 'today.milestoneTodayDays' : 'today.milestoneDays', {
          value: milestone.value,
          days: milestone.inDays,
        });
  return (
    <View
      testID="milestone"
      style={[
        styles.pill,
        {
          backgroundColor: today ? colors.primary : colors.surface,
          borderRadius: radii.pill,
          paddingHorizontal: spacing.smd,
          gap: spacing.xs,
        },
      ]}
    >
      {today ? <Icon icon={PartyPopper} size={14} color="onPrimary" /> : null}
      <Text variant="caption" color={today ? 'onPrimary' : 'onPrimarySoft'} style={styles.bold}>
        {text}
      </Text>
    </View>
  );
}

/** The couple, first: photo or both avatars, names, days together, next milestone. */
export function CoupleHero() {
  const { t } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  const couple = useCouple();
  const me = useMe();
  const partner = usePartner();
  const data = couple.data;
  if (!data || !me.data) return null;
  const myMember = data.members.find((m) => m.id === me.data?.id);
  const names = t('today.couple', {
    me: me.data.display_name,
    partner: partner?.display_name ?? '',
  });
  const start = data.start_date;
  const milestoneToday = start ? nextMilestone(start)?.inDays === 0 : false;

  const text = (
    <View style={{ gap: spacing.xs }}>
      <Text variant="title" color={data.photo_url ? 'onScrim' : 'onPrimarySoft'}>
        {names}
      </Text>
      {start ? (
        <Text testID="days-together" color={data.photo_url ? 'onScrim' : 'onPrimarySoft'}>
          {t('today.together', { count: daysTogether(start) })}
        </Text>
      ) : (
        <Text variant="caption" color={data.photo_url ? 'onScrim' : 'onPrimarySoft'}>
          {t('today.togetherHint')}
        </Text>
      )}
      {start ? <MilestonePill start={start} /> : null}
    </View>
  );

  if (data.photo_url) {
    return (
      <View testID="couple-hero" style={[styles.hero, { borderRadius: radii.xl }]}>
        <Image
          source={{ uri: data.photo_url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />
        <View style={[styles.heroText, { padding: spacing.lg }]}>{text}</View>
        <Celebration
          testID="milestone-celebration"
          play={milestoneToday ? `milestone-${start}` : false}
        />
      </View>
    );
  }
  return (
    <View
      testID="couple-hero"
      style={[
        styles.heroPlain,
        {
          backgroundColor: colors.primarySoft,
          borderRadius: radii.xl,
          padding: spacing.lg,
          gap: spacing.md,
        },
      ]}
    >
      <View
        style={styles.avatars}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[styles.ring, { borderColor: colors.primarySoft }]}>
          <Avatar name={me.data.display_name} uri={myMember?.avatar_url} size={60} />
        </View>
        <View style={[styles.ring, styles.overlap, { borderColor: colors.primarySoft }]}>
          <Avatar name={partner?.display_name ?? '?'} uri={partner?.avatar_url} size={60} />
        </View>
      </View>
      {text}
      <Celebration
        testID="milestone-celebration"
        play={milestoneToday ? `milestone-${start}` : false}
      />
    </View>
  );
}

/** The next moment in the shared calendar. */
export function NextMomentCard() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { hues, radii, spacing } = useTheme();
  const surface = useSurfaceStyle();
  const next = useNextMoment();
  if (next.isPending || next.isError) return null;
  const occurrence = next.data;
  const kind = occurrence?.event.kind ?? 'event';
  const hue = hues[EVENT_KIND_HUES[kind]];
  const relative = occurrence ? relativeDay(occurrence.date) : null;
  const when = occurrence
    ? [
        relative ? t(`today.${relative}`) : dayTitle(occurrence.date, i18n.language),
        occurrence.starts_at ? timeLabel(occurrence.starts_at, i18n.language) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;
  return (
    <PressableScale
      testID="next-moment"
      accessibilityRole="button"
      accessibilityLabel={
        occurrence
          ? `${t('today.nextMoment')} : ${occurrence.event.title}, ${when}`
          : t('today.nextEmpty')
      }
      onPress={() => router.push('/organize')}
      style={[
        surface,
        styles.row,
        { borderRadius: radii.xl, padding: spacing.lg, gap: spacing.md },
      ]}
    >
      <View style={[styles.badge, { backgroundColor: hue.bg, borderRadius: radii.lg }]}>
        <Icon icon={occurrence ? EVENT_KIND_ICONS[kind] : CalendarHeart} size={26} tint={hue.fg} />
      </View>
      <View style={styles.flex}>
        <Text variant="overline" muted>
          {t('today.nextMoment')}
        </Text>
        {occurrence ? (
          <>
            <Text variant="heading" numberOfLines={1}>
              {occurrence.event.title}
            </Text>
            <Text variant="caption" style={{ color: hue.fg, fontWeight: '600' }}>
              {when}
            </Text>
          </>
        ) : (
          <Text muted>{t('today.nextEmpty')}</Text>
        )}
      </View>
      <Icon icon={ChevronRight} size={20} color="textMuted" />
    </PressableScale>
  );
}

/** "N years ago today": the memory comes back, with its photo. */
export function OnThisDayCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { hues, radii, spacing } = useTheme();
  const surface = useSurfaceStyle();
  const query = useOnThisDay();
  const item = query.data?.items[0];
  if (!item) return null;
  const { memory } = item;
  const cover = memory.photos[0];
  return (
    <PressableScale
      testID="on-this-day"
      accessibilityRole="button"
      accessibilityLabel={`${t('today.onThisDay', { count: item.years_ago })} : ${memory.title}`}
      onPress={() => router.push(`/memories/${memory.id}`)}
      style={[surface, styles.clip, { borderRadius: radii.xl }]}
    >
      {cover ? (
        <Image
          source={{ uri: cover.thumbnail_url ?? cover.url ?? undefined }}
          style={styles.cover}
          contentFit="cover"
          transition={200}
        />
      ) : null}
      <View style={{ padding: spacing.lg, gap: spacing.xs }}>
        <View style={[styles.row, { gap: spacing.xs }]}>
          <Icon icon={History} size={16} tint={hues.violet.fg} />
          <Text variant="overline" style={{ color: hues.violet.fg }}>
            {t('today.onThisDay', { count: item.years_ago })}
          </Text>
        </View>
        <Text variant="heading">{memory.title}</Text>
        {memory.body ? (
          <Text muted numberOfLines={2}>
            {memory.body}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  hero: { height: 220, overflow: 'hidden', borderCurve: 'continuous', justifyContent: 'flex-end' },
  heroText: { justifyContent: 'flex-end' },
  heroPlain: { borderCurve: 'continuous' },
  avatars: { flexDirection: 'row' },
  ring: { borderWidth: 3, borderRadius: 40 },
  overlap: { marginLeft: -16 },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    marginTop: 4,
  },
  bold: { fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', borderCurve: 'continuous' },
  badge: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  clip: { overflow: 'hidden', borderCurve: 'continuous' },
  cover: { width: '100%', aspectRatio: 16 / 9 },
});
