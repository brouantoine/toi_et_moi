import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { CalendarHeart, ChevronRight, History, PartyPopper, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useCouple } from '@/features/couple/useCouple';
import { DistancePill } from '@/features/distance/DistancePill';
import { usePartner } from '@/features/couple/usePartner';
import { useMe } from '@/features/me/useProfile';
import { EVENT_KIND_HUES, EVENT_KIND_ICONS } from '@/features/organize/agenda/eventKinds';
import { relativeDay, dayTitle, timeLabel } from '@/features/organize/agenda/agendaDates';
import {
  Avatar,
  Celebration,
  Icon,
  PressableScale,
  Ring,
  Text,
  useSurfaceStyle,
  useTheme,
} from '@/ui';

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

const AVATAR = 88;
const DASHES = Array.from({ length: 9 }, (_, index) => index);

/** Both of you, linked by the distance between you. My avatar opens the avatar picker. */
function LinkedAvatars({ tone }: { tone: 'onScrim' | 'text' }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const couple = useCouple({ enabled: false });
  const me = useMe();
  const partner = usePartner();
  if (!me.data) return null;
  const myMember = couple.data?.members.find((m) => m.id === me.data?.id);
  return (
    <View testID="couple-link" style={styles.link}>
      <PressableScale
        testID="hero-my-avatar"
        accessibilityRole="button"
        accessibilityLabel={t('avatar.edit')}
        onPress={() => router.push('/settings/avatar')}
        scaleTo={0.94}
      >
        <Avatar
          name={me.data.display_name}
          uri={myMember?.avatar_url ?? me.data.avatar_url}
          preset={me.data.avatar_preset}
          size={AVATAR}
          ring
        />
        <View
          style={[styles.edit, { backgroundColor: colors.primary, borderColor: colors.surface }]}
        >
          <Icon icon={Plus} size={14} color="onPrimary" strokeWidth={3} />
        </View>
      </PressableScale>
      <View style={styles.bridge}>
        <View style={styles.dashes} importantForAccessibility="no-hide-descendants">
          {DASHES.map((dash) => (
            <View key={dash} style={[styles.dash, { backgroundColor: colors[tone] }]} />
          ))}
        </View>
        <DistancePill />
      </View>
      <Avatar
        name={partner?.display_name ?? '?'}
        uri={partner?.avatar_url}
        preset={partner?.avatar_preset}
        size={AVATAR}
        ring
      />
    </View>
  );
}

/** The couple, first: both of you and the distance, names, days together, next milestone. */
export function CoupleHero() {
  const { t } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  const couple = useCouple();
  const me = useMe();
  const partner = usePartner();
  const data = couple.data;
  if (!data || !me.data) return null;
  const names = t('today.couple', {
    me: me.data.display_name,
    partner: partner?.display_name ?? '',
  });
  const start = data.start_date;
  const milestoneToday = start ? nextMilestone(start)?.inDays === 0 : false;
  const tone = data.photo_url ? 'onScrim' : 'text';

  const content = (
    <View
      style={[
        styles.heroContent,
        {
          gap: spacing.md,
          paddingVertical: spacing.lg,
          paddingHorizontal: data.photo_url ? spacing.lg : 0,
        },
      ]}
    >
      <LinkedAvatars tone={tone} />
      <View style={[styles.heroText, { gap: spacing.xs }]}>
        <Text variant="title" color={tone} style={styles.textCenter}>
          {names}
        </Text>
        {start ? (
          // Like the lock-screen widget: a ring, then the exact number of days.
          <View style={[styles.daysRow, { gap: spacing.sm }]}>
            <Icon icon={Ring} size={20} color={tone} strokeWidth={2} />
            <Text testID="days-together" color={tone}>
              {t('today.together', { count: daysTogether(start) })}
            </Text>
          </View>
        ) : (
          <Text variant="caption" color={tone} style={styles.textCenter}>
            {t('today.togetherHint')}
          </Text>
        )}
        {start ? <MilestonePill start={start} /> : null}
      </View>
      <Celebration
        testID="milestone-celebration"
        play={milestoneToday ? `milestone-${start}` : false}
      />
    </View>
  );

  // Without a couple photo the card has no box: it sits on the screen's red wash.
  return (
    <View
      testID="couple-hero"
      style={[styles.hero, { borderRadius: data.photo_url ? radii.xl : 0 }]}
    >
      {data.photo_url ? (
        <>
          <Image
            source={{ uri: data.photo_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />
        </>
      ) : null}
      {content}
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
  daysRow: { flexDirection: 'row', alignItems: 'center' },
  hero: { overflow: 'hidden', borderCurve: 'continuous' },
  heroContent: { alignItems: 'stretch' },
  heroText: { alignItems: 'center' },
  textCenter: { textAlign: 'center' },
  link: { flexDirection: 'row', alignItems: 'center' },
  bridge: { flex: 1, alignItems: 'center', justifyContent: 'center', marginHorizontal: -6 },
  dashes: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    opacity: 0.45,
  },
  dash: { width: 7, height: 2.5, borderRadius: 1.25 },
  edit: {
    position: 'absolute',
    left: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    alignSelf: 'center',
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
