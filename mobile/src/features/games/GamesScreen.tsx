import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ChevronRight, Lock, Search } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api';
import {
  Chip,
  ErrorState,
  FadeIn,
  Icon,
  IconButton,
  PressableScale,
  Skeleton,
  Text,
  useTheme,
} from '@/ui';

import { EMOJI, kindArt, topicArt } from './art';
import { PackCard } from './PackCard';
import { useGamesHome, type GamesHome, type Topic } from './useGames';

const FILTERS = ['your_turn', 'waiting', 'done'] as const;

function filterCount(home: GamesHome, state: (typeof FILTERS)[number]): number {
  if (state === 'your_turn') return home.your_turn_count;
  return state === 'waiting' ? home.waiting_count : home.done_count;
}

export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <View>
      <Text variant="heading">{title}</Text>
      {hint ? (
        <Text variant="caption" muted>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** Days in a row you both played. Shown as a fact, never as a reproach. */
export function StreakBadge({ streak }: { streak: GamesHome['streak'] }) {
  const { t } = useTranslation();
  const { hues, radii, spacing } = useTheme();
  const hue = hues.amber;
  return (
    <View
      testID="streak-badge"
      accessible
      accessibilityLabel={`${t('games.streak', { count: streak.count })}. ${t(
        streak.today_done ? 'games.streakDone' : 'games.streakHint',
      )}`}
      style={[
        styles.streak,
        {
          backgroundColor: hue.bg,
          borderRadius: radii.pill,
          paddingHorizontal: spacing.smd,
          gap: spacing.xs,
          opacity: streak.today_done || streak.count === 0 ? 1 : 0.75,
        },
      ]}
    >
      <Text variant="label" style={[styles.percent, { color: hue.fg, minWidth: 0 }]}>
        {streak.count}
      </Text>
      <Image source={EMOJI.fire} style={styles.streakArt} contentFit="contain" />
    </View>
  );
}

function KindsRow({ kinds }: { kinds: GamesHome['kinds'] }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { hues, radii, spacing } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -spacing.lg }}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.smd }}
    >
      {kinds.map((kind, index) => {
        const art = kindArt(kind.slug);
        const hue = hues[art.hue];
        return (
          <PressableScale
            key={kind.slug}
            testID={`kind-${kind.slug}`}
            accessibilityRole="button"
            accessibilityLabel={`${kind.name}, ${t('games.packsCount', { count: kind.total })}`}
            onPress={() => router.push(`/games/list?kind=${kind.slug}`)}
            style={[
              styles.kind,
              {
                backgroundColor: hue.bg,
                borderRadius: radii.xl,
                padding: spacing.md,
                transform: [{ rotate: index % 2 ? '2deg' : '-2deg' }],
              },
            ]}
          >
            <Image source={art.image} style={styles.kindArt} contentFit="contain" />
            <Text variant="label" numberOfLines={2}>
              {kind.name}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

function TopicRow({ topic }: { topic: Topic }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, hues, radii, spacing } = useTheme();
  const art = topicArt(topic.slug);
  const hue = hues[art.hue];
  return (
    <PressableScale
      testID={`topic-${topic.slug}`}
      accessibilityRole="button"
      accessibilityLabel={`${topic.name}, ${
        topic.locked
          ? t('games.locked')
          : t('games.progress', { done: topic.done, total: topic.total })
      }`}
      onPress={() => router.push(`/games/list?topic=${topic.slug}`)}
      style={[
        styles.topic,
        { backgroundColor: hue.bg, borderRadius: radii.xl, padding: spacing.md, gap: spacing.md },
      ]}
    >
      <Image source={art.image} style={styles.topicArt} contentFit="contain" />
      <View style={[styles.flex, { gap: spacing.sm }]}>
        <Text variant="label">{topic.name}</Text>
        <View style={[styles.row, { gap: spacing.sm }]}>
          <View style={[styles.track, { backgroundColor: colors.surface }]}>
            <View style={[styles.fill, { width: `${topic.percent}%`, backgroundColor: hue.fg }]} />
          </View>
          <Text variant="caption" style={[styles.percent, { color: hue.fg }]}>
            {`${topic.percent} %`}
          </Text>
        </View>
      </View>
      <Icon icon={topic.locked ? Lock : ChevronRight} size={20} tint={hue.fg} strokeWidth={2.2} />
    </PressableScale>
  );
}

/** The games tab: kinds of games, today's packs, then every topic with its progress. */
export function GamesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, radii, spacing } = useTheme();
  const query = useGamesHome();
  const home = query.home;

  let body;
  if (query.isPending) {
    body = (
      <View testID="games-loading" style={{ gap: spacing.md }}>
        <Skeleton height={130} radius={radii.xl} />
        <Skeleton height={150} radius={radii.xl} />
        <Skeleton height={84} radius={radii.xl} />
      </View>
    );
  } else if (!home) {
    body = (
      <ErrorState
        testID="games-error"
        code={query.error instanceof ApiError ? query.error.code : 'network'}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  } else {
    body = (
      <>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -spacing.lg }}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            gap: spacing.sm,
            alignItems: 'center',
          }}
        >
          <IconButton
            testID="games-search"
            icon={Search}
            label={t('games.search')}
            onPress={() => router.push('/games/list?search=1')}
          />
          {FILTERS.map((state) => {
            const count = filterCount(home, state);
            return (
              <Chip
                key={state}
                testID={`games-filter-${state}`}
                label={
                  count ? `${t(`games.filters.${state}`)} (${count})` : t(`games.filters.${state}`)
                }
                selected={false}
                onPress={() => router.push(`/games/list?state=${state}`)}
              />
            );
          })}
        </ScrollView>
        <FadeIn>
          <View style={{ gap: spacing.smd }}>
            <SectionTitle title={t('games.kindsTitle')} />
            <KindsRow kinds={home.kinds} />
          </View>
        </FadeIn>
        <FadeIn delay={80}>
          <View style={{ gap: spacing.smd }}>
            <View style={[styles.row, { gap: spacing.sm }]}>
              <View style={styles.flex}>
                <SectionTitle title={t('games.dailyTitle')} hint={t('games.dailyHint')} />
              </View>
              <StreakBadge streak={home.streak} />
            </View>
            {home.daily.map((pack) => (
              <PackCard key={pack.id} pack={pack} />
            ))}
          </View>
        </FadeIn>
        <FadeIn delay={160}>
          <View style={{ gap: spacing.smd }}>
            <SectionTitle title={t('games.topicsTitle')} />
            {home.topics.map((topic) => (
              <TopicRow key={topic.slug} topic={topic} />
            ))}
          </View>
        </FadeIn>
      </>
    );
  }

  return (
    <SafeAreaView
      testID="tab-games"
      edges={['top']}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        <Text variant="title">{t('games.title')}</Text>
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  kind: { width: 136, height: 150, justifyContent: 'space-between', borderCurve: 'continuous' },
  kindArt: { width: 56, height: 56 },
  topic: { flexDirection: 'row', alignItems: 'center', borderCurve: 'continuous' },
  topicArt: { width: 52, height: 52 },
  streak: { flexDirection: 'row', alignItems: 'center', height: 36 },
  streakArt: { width: 20, height: 20 },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  percent: { fontWeight: '700', fontVariant: ['tabular-nums'], minWidth: 44, textAlign: 'right' },
});
