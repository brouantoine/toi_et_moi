import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { CircleCheck, Clock, Inbox } from 'lucide-react-native';
import { useDeferredValue, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api';
import { usePartner } from '@/features/couple/usePartner';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  SearchField,
  Text,
  useTheme,
} from '@/ui';

import { kindArt, topicArt } from './art';
import { PackCard } from './PackCard';
import { useGamesHome, usePacks, useSetAdult, type PackFilter } from './useGames';

const STATES: readonly NonNullable<PackFilter['state']>[] = [
  'unanswered',
  'your_turn',
  'waiting',
  'done',
];

/** 18+ packs: each partner turns them on for themselves; they open when both did. */
function AdultGate({ hidden }: { hidden: number }) {
  const { t } = useTranslation();
  const { home } = useGamesHome();
  const partner = usePartner();
  const setAdult = useSetAdult();
  const mine = home?.adult.mine ?? false;
  return (
    <Card testID="adult-gate">
      <Text variant="heading">{t('games.adultTitle')}</Text>
      <Text muted>{t('games.adultExplain', { count: hidden })}</Text>
      {mine && !home?.adult.partner ? (
        <Notice message={t('games.adultWaiting', { name: partner?.display_name ?? '' })} />
      ) : null}
      <Button
        testID="adult-toggle"
        variant={mine ? 'ghost' : 'primary'}
        label={t(mine ? 'games.adultDisable' : 'games.adultEnable')}
        loading={setAdult.isPending}
        onPress={() => setAdult.mutate(!mine)}
      />
    </Card>
  );
}

/** Packs of one kind, one topic, one state ("your turn"…) or a search. */
export function PackListScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, spacing } = useTheme();
  const params = useLocalSearchParams<{
    topic?: string;
    kind?: string;
    state?: string;
    search?: string;
  }>();
  const fixed = STATES.find((state) => state === params.state);
  const [picked, setPicked] = useState<PackFilter['state']>();
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const searching = params.search === '1';
  const { home } = useGamesHome();
  const query = usePacks({
    kind: params.kind,
    topic: params.topic,
    state: fixed ?? picked,
    q: searching ? q : undefined,
  });

  const topic = home?.topics.find((item) => item.slug === params.topic);
  const kind = home?.kinds.find((item) => item.slug === params.kind);
  const title =
    topic?.name ??
    kind?.name ??
    (fixed ? t(`games.listTitle.${fixed}`) : searching ? t('games.search') : t('games.title'));
  const art = params.topic ? topicArt(params.topic) : params.kind ? kindArt(params.kind) : null;
  const packs = query.data?.packs ?? [];
  const hidden = query.data?.adult_hidden ?? 0;
  const showGate = hidden > 0 || (topic?.adult ?? false);

  const header = (
    <View style={{ gap: spacing.md }}>
      <View style={[styles.row, { gap: spacing.md }]}>
        {art ? <Image source={art.image} style={styles.art} contentFit="contain" /> : null}
        <View style={styles.flex}>
          <Text variant="title">{title}</Text>
          {topic && !topic.locked ? (
            <Text muted>{t('games.progress', { done: topic.done, total: topic.total })}</Text>
          ) : null}
        </View>
      </View>
      {searching ? (
        <SearchField
          testID="games-search-field"
          label={t('games.search')}
          clearLabel={t('games.clearSearch')}
          placeholder={t('games.searchPlaceholder')}
          value={search}
          onChangeText={setSearch}
          autoFocus
        />
      ) : null}
      {fixed ? null : (
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Chip
            testID="filter-unanswered"
            icon={Clock}
            label={t('games.filters.unanswered')}
            selected={picked === 'unanswered'}
            onPress={() => setPicked(picked === 'unanswered' ? undefined : 'unanswered')}
          />
          <Chip
            testID="filter-done"
            icon={CircleCheck}
            label={t('games.filters.done')}
            selected={picked === 'done'}
            onPress={() => setPicked(picked === 'done' ? undefined : 'done')}
          />
        </View>
      )}
      {showGate ? <AdultGate hidden={hidden} /> : null}
    </View>
  );

  let empty: ReactElement | undefined;
  if (query.isPending) empty = <LoadingState testID="packs-loading" />;
  else if (query.isError)
    empty = (
      <ErrorState
        testID="packs-error"
        code={query.error instanceof ApiError ? query.error.code : 'network'}
        onRetry={() => void query.refetch()}
      />
    );
  else if (!topic?.locked)
    empty = (
      <EmptyState icon={Inbox} title={searching && q ? t('games.noMatch') : t('games.emptyList')} />
    );

  return (
    <FlatList
      testID="packs-screen"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        padding: spacing.lg,
        gap: spacing.md,
        paddingBottom: insets.bottom + spacing.xl,
      }}
      keyboardShouldPersistTaps="handled"
      data={packs}
      keyExtractor={(pack) => pack.id}
      renderItem={({ item }) => <PackCard pack={item} />}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      initialNumToRender={6}
      windowSize={7}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  art: { width: 56, height: 56 },
  flex: { flex: 1 },
});
