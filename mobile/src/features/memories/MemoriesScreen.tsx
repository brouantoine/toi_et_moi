import { useRouter } from 'expo-router';
import { BookHeart, Plus, SearchX } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api';
import {
  EmptyState,
  ErrorState,
  Icon,
  Input,
  Skeleton,
  Text,
  useTheme,
  MIN_TOUCH_TARGET,
} from '@/ui';

import { MemoryCard } from './MemoryCard';
import { MEMORY_TYPES, useMemories, type Memory, type MemoryType } from './useMemories';

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function TypeChips({
  value,
  onChange,
}: {
  value: MemoryType | undefined;
  onChange: (type: MemoryType | undefined) => void;
}) {
  const { t } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  const options: (MemoryType | undefined)[] = [undefined, ...MEMORY_TYPES];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
    >
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option ?? 'all'}
            testID={`memories-filter-${option ?? 'all'}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option)}
            style={[
              styles.chip,
              {
                borderRadius: radii.pill,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? colors.primary : colors.surface,
                paddingHorizontal: spacing.md,
              },
            ]}
          >
            <Text variant="label" style={{ color: selected ? colors.onPrimary : colors.text }}>
              {option ? t(`memories.types.${option}`) : t('memories.all')}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function MemoriesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const [type, setType] = useState<MemoryType | undefined>();
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const list = useMemories({ type, q });
  const filtered = Boolean(type || q.trim());

  const openMemory = useCallback((id: number) => router.push(`/memories/${id}`), [router]);
  const addMemory = () => router.push('/memories/new');

  const renderItem = useCallback(
    ({ item }: { item: Memory }) => <MemoryCard memory={item} onPress={openMemory} />,
    [openMemory],
  );

  let body;
  if (list.isPending) {
    body = (
      <View testID="memories-loading" style={{ padding: spacing.lg, gap: spacing.md }}>
        <Skeleton height={180} />
        <Skeleton height={180} />
      </View>
    );
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
      <FlatList
        testID="memories-list"
        data={list.memories}
        keyExtractor={(m) => String(m.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={list.isRefetching && !list.isFetchingNextPage}
            onRefresh={() => void list.refetch()}
            tintColor={colors.primary}
          />
        }
        initialNumToRender={6}
        windowSize={7}
        removeClippedSubviews
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
      <View style={[styles.header, { paddingHorizontal: spacing.lg, paddingTop: spacing.md }]}>
        <Text variant="title" style={styles.title}>
          {t('tabs.memories.title')}
        </Text>
        <Pressable
          testID="memories-add"
          accessibilityRole="button"
          accessibilityLabel={t('memories.add')}
          onPress={addMemory}
          style={styles.addButton}
        >
          <Icon icon={Plus} color="primary" size={28} />
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
        <Input
          testID="memories-search"
          label={t('memories.searchLabel')}
          placeholder={t('memories.searchPlaceholder')}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
      </View>
      <TypeChips value={type} onChange={setType} />
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1 },
  addButton: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', borderWidth: 1 },
});
