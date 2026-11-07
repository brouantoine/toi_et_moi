import { useRouter } from 'expo-router';
import { ArrowDown, ArrowUp, Check, ChevronLeft, Plus, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api';
import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  LoadingState,
  MIN_TOUCH_TARGET,
  Text,
  useTheme,
} from '@/ui';

import { useQueuedWrite } from '../agenda/useAgenda';
import { usePersonLabel } from '../usePersonLabel';
import { listsKey, moved, useItemActions, useListItems, useLists, type ListItem } from './useLists';

function ItemRow({
  item,
  reordering,
  onToggle,
  onRemove,
  onMove,
  isFirst,
  isLast,
}: {
  item: ListItem;
  reordering: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onMove: (step: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const person = usePersonLabel();
  return (
    <View style={[styles.item, { borderBottomColor: colors.border, gap: spacing.sm }]}>
      <Pressable
        testID={`list-item-${item.id}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.done }}
        accessibilityLabel={item.text}
        onPress={onToggle}
        disabled={reordering}
        style={[styles.toggle, { gap: spacing.md }]}
      >
        <View
          style={[
            styles.box,
            {
              borderColor: item.done ? colors.secondary : colors.textMuted,
              backgroundColor: item.done ? colors.secondary : 'transparent',
            },
          ]}
        >
          {item.done ? <Icon icon={Check} size={16} color="onSecondary" strokeWidth={3} /> : null}
        </View>
        <View style={styles.flex}>
          <Text muted={item.done} style={item.done ? styles.done : undefined}>
            {item.text}
          </Text>
          {item.done && item.done_by === 'you' ? (
            <Text variant="caption" muted>
              {t('organize.lists.doneBy', { name: person('you') })}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {reordering ? (
        <>
          <IconButton
            icon={ArrowUp}
            variant="plain"
            label={t('organize.lists.moveUp', { text: item.text })}
            onPress={() => !isFirst && onMove(-1)}
          />
          <IconButton
            icon={ArrowDown}
            variant="plain"
            label={t('organize.lists.moveDown', { text: item.text })}
            onPress={() => !isLast && onMove(1)}
          />
        </>
      ) : (
        <IconButton
          icon={X}
          variant="plain"
          label={t('organize.lists.removeItem', { text: item.text })}
          onPress={onRemove}
        />
      )}
    </View>
  );
}

export function ListScreen({ listId }: { listId: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, radii, spacing, typography } = useTheme();
  const lists = useLists();
  const items = useListItems(listId);
  const actions = useItemActions(listId);
  const { write } = useQueuedWrite(listsKey);
  const [draft, setDraft] = useState('');
  const [reordering, setReordering] = useState(false);
  const list = lists.data?.find((l) => l.id === listId);
  const data = items.data ?? [];

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    void actions.add(text);
  };

  const removeList = () =>
    Alert.alert(t('organize.lists.deleteTitle'), t('organize.lists.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('memories.detail.deleteConfirm'),
        style: 'destructive',
        onPress: () => {
          void write({
            method: 'DELETE',
            path: '/api/v1/lists/{id}/',
            pathParams: { id: listId },
          }).finally(() => router.back());
        },
      },
    ]);

  let body;
  if (items.isPending) body = <LoadingState testID="list-loading" />;
  else if (items.isError && !items.data)
    body = (
      <ErrorState
        testID="list-error"
        code={items.error instanceof ApiError ? items.error.code : 'network'}
        onRetry={() => void items.refetch()}
      />
    );
  else
    body = (
      <FlatList
        testID="list-items"
        data={data}
        keyExtractor={(i) => String(i.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxl,
          flexGrow: 1,
        }}
        renderItem={({ item, index }) => (
          <ItemRow
            item={item}
            reordering={reordering}
            isFirst={index === 0}
            isLast={index === data.length - 1}
            onToggle={() => void actions.toggle(item)}
            onRemove={() => void actions.remove(item)}
            onMove={(step) =>
              void actions.reorder(
                moved(
                  data.map((i) => i.id),
                  item.id,
                  step,
                ),
              )
            }
          />
        )}
        ListEmptyComponent={
          <EmptyState testID="list-empty" icon={Plus} title={t('organize.lists.itemsEmpty')} />
        }
        ListFooterComponent={
          data.some((i) => i.done) && !reordering ? (
            <Button
              testID="list-clear-done"
              variant="ghost"
              icon={Trash2}
              label={t('organize.lists.clearDone')}
              onPress={() => void actions.clearDone()}
              style={{ marginTop: spacing.md }}
            />
          ) : undefined
        }
      />
    );

  return (
    <SafeAreaView
      testID="list-screen"
      edges={['top']}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View style={[styles.topBar, { paddingHorizontal: spacing.md, gap: spacing.xs }]}>
        <IconButton
          testID="list-back"
          icon={ChevronLeft}
          variant="plain"
          label={t('organize.lists.back')}
          onPress={() => router.back()}
        />
        <Text variant="heading" numberOfLines={1} style={styles.flex}>
          {list?.title ?? ''}
        </Text>
        <Button
          testID="list-reorder"
          variant="ghost"
          label={reordering ? t('organize.lists.reorderDone') : t('organize.lists.reorder')}
          onPress={() => setReordering((r) => !r)}
        />
        <IconButton
          testID="list-delete"
          icon={Trash2}
          variant="plain"
          label={t('organize.lists.delete')}
          onPress={removeList}
        />
      </View>
      {reordering ? null : (
        <View
          style={[
            styles.field,
            {
              marginHorizontal: spacing.lg,
              marginBottom: spacing.sm,
              backgroundColor: colors.surfaceMuted,
              borderRadius: radii.md,
              paddingLeft: spacing.md,
            },
          ]}
        >
          <TextInput
            testID="list-add-input"
            accessibilityLabel={t('organize.lists.addItem')}
            placeholder={t('organize.lists.addPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={add}
            submitBehavior="submit"
            returnKeyType="done"
            maxLength={200}
            style={[typography.body, styles.flex, { color: colors.text }]}
          />
          <IconButton
            testID="list-add"
            icon={Plus}
            variant="primary"
            label={t('organize.lists.addItem')}
            onPress={add}
          />
        </View>
      )}
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  field: {
    minHeight: MIN_TOUCH_TARGET + 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
    borderCurve: 'continuous',
  },
  item: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  toggle: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET + 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  done: { textDecorationLine: 'line-through' },
});
