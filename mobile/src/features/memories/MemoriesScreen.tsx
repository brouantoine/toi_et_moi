import { useRouter } from 'expo-router';
import { BookHeart, Plus, SearchX } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api';
import {
  Chip,
  EmptyState,
  ErrorState,
  IconButton,
  SearchField,
  Skeleton,
  Text,
  useTheme,
} from '@/ui';

import { MemoryCard } from './MemoryCard';
import { MEMORY_TYPE_ICONS } from './memoryTypes';
import { groupByMonth, railDate, type TimelineSection } from './timeline';
import { MEMORY_TYPES, useMemories, type Memory, type MemoryType } from './useMemories';

/** Width of the left rail holding the day number and the thread. */
const RAIL = 48;

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function TypeFilters({
  value,
  onChange,
}: {
  value: MemoryType | undefined;
  onChange: (type: MemoryType | undefined) => void;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xs,
      }}
    >
      <Chip
        testID="memories-filter-all"
        label={t('memories.all')}
        selected={value === undefined}
        onPress={() => onChange(undefined)}
      />
      {MEMORY_TYPES.map((type) => (
        <Chip
          key={type}
          testID={`memories-filter-${type}`}
          label={t(`memories.types.${type}`)}
          icon={MEMORY_TYPE_ICONS[type]}
          selected={type === value}
          onPress={() => onChange(type === value ? undefined : type)}
        />
      ))}
    </ScrollView>
  );
}

/** One memory on the timeline: day on the rail, the thread, then the card. */
function TimelineItem({
  memory,
  isLast,
  onPress,
}: {
  memory: Memory;
  isLast: boolean;
  onPress: (id: number) => void;
}) {
  const { i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const { day, weekday } = railDate(memory.happened_on, i18n.language);
  return (
    <View style={[styles.item, { paddingHorizontal: spacing.lg }]}>
      <View style={[styles.rail, { width: RAIL }]} importantForAccessibility="no-hide-descendants">
        <Text variant="heading" style={styles.day}>
          {day}
        </Text>
        <Text variant="overline" muted>
          {weekday}
        </Text>
        {isLast ? null : (
          <View
            style={[styles.thread, { backgroundColor: colors.border, marginTop: spacing.sm }]}
          />
        )}
      </View>
      <View style={[styles.cardSlot, { paddingBottom: spacing.lg, paddingLeft: spacing.smd }]}>
        <MemoryCard memory={memory} onPress={onPress} />
      </View>
    </View>
  );
}

function TimelineSkeleton() {
  const { spacing, radii } = useTheme();
  return (
    <View
      testID="memories-loading"
      style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.lg }}
    >
      <Skeleton width={140} height={24} />
      {[0, 1].map((i) => (
        <View key={i} style={styles.item}>
          <View style={{ width: RAIL, gap: spacing.xs }}>
            <Skeleton width={28} height={24} />
            <Skeleton width={30} height={12} />
          </View>
          <View style={[styles.cardSlot, { paddingLeft: spacing.smd, gap: spacing.smd }]}>
            <Skeleton height={190} radius={radii.lg} />
            <Skeleton width="70%" height={22} />
            <Skeleton width="45%" height={14} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function MemoriesScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const [type, setType] = useState<MemoryType | undefined>();
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const list = useMemories({ type, q });
  const filtered = Boolean(type || q.trim());

  const sections = useMemo(
    () => groupByMonth(list.memories, i18n.language),
    [list.memories, i18n.language],
  );

  const openMemory = useCallback((id: number) => router.push(`/memories/${id}`), [router]);
  const addMemory = useCallback(() => router.push('/memories/new'), [router]);

  const renderItem = useCallback(
    ({ item, index, section }: { item: Memory; index: number; section: TimelineSection }) => (
      <TimelineItem memory={item} isLast={index === section.data.length - 1} onPress={openMemory} />
    ),
    [openMemory],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: TimelineSection }) => (
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.md,
        }}
      >
        <Text variant="heading" testID={`memories-month-${section.key}`}>
          {section.title}
        </Text>
      </View>
    ),
    [spacing],
  );

  let body;
  if (list.isPending) {
    body = <TimelineSkeleton />;
  } else if (list.isError && list.memories.length === 0) {
    body = (
      <ErrorState
        testID="memories-error"
        code={list.error instanceof ApiError ? list.error.code : 'network'}
        onRetry={() => void list.refetch()}
      />
    );
  } else {
    body = (
      <SectionList
        testID="memories-list"
        sections={sections}
        keyExtractor={(m) => String(m.id)}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: spacing.xxl }]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={list.isRefetching && !list.isFetchingNextPage}
            onRefresh={() => void list.refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        initialNumToRender={6}
        windowSize={7}
        removeClippedSubviews
        ListFooterComponent={
          list.isFetchingNextPage ? (
            <ActivityIndicator
              testID="memories-loading-more"
              accessibilityLabel={t('memories.loadingMore')}
              color={colors.primary}
              style={{ paddingVertical: spacing.lg }}
            />
          ) : undefined
        }
        ListEmptyComponent={
          filtered ? (
            <EmptyState
              testID="memories-no-match"
              icon={SearchX}
              title={t('memories.noMatchTitle')}
              message={t('memories.noMatchMessage')}
            />
          ) : (
            <EmptyState
              testID="memories-empty"
              icon={BookHeart}
              title={t('memories.emptyTitle')}
              message={t('memories.emptyMessage')}
              actionLabel={t('memories.add')}
              actionIcon={Plus}
              onAction={addMemory}
            />
          )
        }
      />
    );
  }

  return (
    <SafeAreaView
      testID="tab-memories"
      edges={['top']}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.header,
          { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
        ]}
      >
        <View style={styles.headerText}>
          <Text variant="overline" color="primary">
            {t('memories.eyebrow')}
          </Text>
          <Text variant="title">{t('tabs.memories.title')}</Text>
        </View>
        <IconButton
          testID="memories-add"
          icon={Plus}
          variant="primary"
          label={t('memories.add')}
          onPress={addMemory}
        />
      </View>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <SearchField
          testID="memories-search"
          label={t('memories.searchLabel')}
          clearLabel={t('memories.clearSearch')}
          placeholder={t('memories.searchPlaceholder')}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <View style={{ paddingVertical: spacing.smd }}>
        <TypeFilters value={type} onChange={setType} />
      </View>
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-end' },
  headerText: { flex: 1 },
  listContent: { flexGrow: 1 },
  item: { flexDirection: 'row' },
  rail: { alignItems: 'center', paddingTop: 2 },
  day: { fontVariant: ['tabular-nums'] },
  thread: { flex: 1, width: StyleSheet.hairlineWidth * 2, borderRadius: 1 },
  cardSlot: { flex: 1 },
});
