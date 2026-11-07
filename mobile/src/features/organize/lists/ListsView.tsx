import { useRouter } from 'expo-router';
import {
  ChevronRight,
  ListChecks,
  Plus,
  ShoppingBasket,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';

import { ApiError } from '@/api';
import {
  Chip,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  MIN_TOUCH_TARGET,
  PressableScale,
  Skeleton,
  Text,
  useSurfaceStyle,
  useTheme,
} from '@/ui';

import { useQueuedWrite } from '../agenda/useAgenda';
import { listsKey, useLists, type ListKind, type SharedList } from './useLists';

const KIND_ICONS: Record<ListKind, LucideIcon> = { groceries: ShoppingBasket, free: ListChecks };

function ListCard({ list }: { list: SharedList }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { hues, radii, spacing } = useTheme();
  const surface = useSurfaceStyle();
  const kind = list.kind ?? 'free';
  const hue = kind === 'groceries' ? hues.amber : hues.lagoon;
  const status = list.open_items
    ? t('organize.lists.open', { count: list.open_items })
    : t('organize.lists.allDone');
  return (
    <PressableScale
      testID={`list-card-${list.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${list.title}, ${status}`}
      onPress={() => router.push(`/organize/list/${list.id}`)}
      style={[
        surface,
        styles.card,
        { borderRadius: radii.lg, padding: spacing.md, gap: spacing.md },
      ]}
    >
      <View style={[styles.badge, { backgroundColor: hue.bg, borderRadius: radii.md }]}>
        <Icon icon={KIND_ICONS[kind]} size={20} tint={hue.fg} strokeWidth={2} />
      </View>
      <View style={styles.flex}>
        <Text variant="label" numberOfLines={1}>
          {list.title}
        </Text>
        <Text variant="caption" muted>
          {status}
        </Text>
      </View>
      <Icon icon={ChevronRight} size={20} color="textMuted" />
    </PressableScale>
  );
}

function NewList() {
  const { t } = useTranslation();
  const { colors, radii, spacing, typography } = useTheme();
  const { write } = useQueuedWrite(listsKey);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ListKind>('groceries');
  const create = () => {
    const clean = title.trim();
    if (!clean) return;
    setTitle('');
    void write({ method: 'POST', path: '/api/v1/lists/', body: { title: clean, kind } }).catch(() =>
      setTitle(clean),
    );
  };
  return (
    <View style={{ gap: spacing.sm }}>
      <View
        style={[
          styles.field,
          { backgroundColor: colors.surfaceMuted, borderRadius: radii.md, paddingLeft: spacing.md },
        ]}
      >
        <TextInput
          testID="lists-new-title"
          accessibilityLabel={t('organize.lists.create')}
          placeholder={t('organize.lists.newPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={create}
          maxLength={80}
          returnKeyType="done"
          style={[typography.body, styles.flex, { color: colors.text }]}
        />
        <IconButton
          testID="lists-create"
          icon={Plus}
          variant="primary"
          label={t('organize.lists.create')}
          onPress={create}
        />
      </View>
      {title.trim() ? (
        <View style={[styles.row, { gap: spacing.sm }]}>
          {(['groceries', 'free'] as const).map((k) => (
            <Chip
              key={k}
              testID={`lists-new-kind-${k}`}
              label={t(`organize.lists.kinds.${k}`)}
              icon={KIND_ICONS[k]}
              selected={kind === k}
              onPress={() => setKind(k)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function ListsView() {
  const { t } = useTranslation();
  const { spacing, radii } = useTheme();
  const lists = useLists();

  if (lists.isPending) {
    return (
      <View testID="lists-loading" style={{ padding: spacing.lg, gap: spacing.md }}>
        <Skeleton height={68} radius={radii.lg} />
        <Skeleton height={68} radius={radii.lg} />
      </View>
    );
  }
  if (lists.isError && !lists.data) {
    return (
      <ErrorState
        testID="lists-error"
        code={lists.error instanceof ApiError ? lists.error.code : 'network'}
        onRetry={() => void lists.refetch()}
      />
    );
  }
  return (
    <FlatList
      testID="lists-list"
      data={lists.data}
      keyExtractor={(l) => String(l.id)}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: spacing.lg,
        paddingTop: spacing.sm,
        gap: spacing.sm,
        flexGrow: 1,
      }}
      ListHeaderComponent={<NewList />}
      ListHeaderComponentStyle={{ marginBottom: spacing.sm }}
      renderItem={({ item }) => <ListCard list={item} />}
      ListEmptyComponent={
        <EmptyState
          testID="lists-empty"
          icon={ListChecks}
          title={t('organize.lists.emptyTitle')}
          message={t('organize.lists.emptyMessage')}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderCurve: 'continuous' },
  badge: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  field: {
    minHeight: MIN_TOUCH_TARGET + 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
    borderCurve: 'continuous',
  },
});
