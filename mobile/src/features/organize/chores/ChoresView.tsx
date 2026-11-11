import { Check, Plus, Repeat, Sparkle, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ApiError } from '@/api';
import {
  Chip,
  EmptyState,
  ErrorState,
  fromIsoDate,
  Icon,
  IconButton,
  MIN_TOUCH_TARGET,
  Skeleton,
  Text,
  useSurfaceStyle,
  useTheme,
} from '@/ui';

import { usePersonLabel } from '../usePersonLabel';
import {
  CHORE_RECURRENCES,
  useChoreActions,
  useChoreWeek,
  type Chore,
  type ChoreRecurrence,
} from './useChores';

type Group = 'me' | 'you' | 'us';

function ChoreRow({ chore }: { chore: Chore }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const { complete, remove } = useChoreActions();
  const recurrence = chore.recurrence ?? 'none';
  const date = chore.due_date
    ? t('organize.chores.due', {
        date: new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric' }).format(
          fromIsoDate(chore.due_date),
        ),
      })
    : t('organize.chores.noDate');
  return (
    <View
      testID={`chore-${chore.id}`}
      style={[styles.row, { gap: spacing.smd, borderBottomColor: colors.border }]}
    >
      <Pressable
        testID={`chore-complete-${chore.id}`}
        accessibilityRole="button"
        accessibilityLabel={t('organize.chores.complete', { title: chore.title })}
        onPress={() => void complete(chore)}
        hitSlop={(MIN_TOUCH_TARGET - 30) / 2}
        style={[styles.check, { borderColor: colors.secondary }]}
      >
        <Icon icon={Check} size={16} color="secondary" strokeWidth={2.5} />
      </Pressable>
      <View style={styles.flex}>
        <Text>{chore.title}</Text>
        <View style={[styles.inline, { gap: spacing.xs }]}>
          {recurrence !== 'none' ? <Icon icon={Repeat} size={13} color="textMuted" /> : null}
          <Text variant="caption" muted>
            {recurrence !== 'none' ? `${t(`organize.chores.recurrences.${recurrence}`)} · ` : ''}
            {date}
          </Text>
        </View>
      </View>
      <IconButton
        icon={Trash2}
        variant="plain"
        label={t('organize.chores.remove', { title: chore.title })}
        onPress={() => void remove(chore)}
      />
    </View>
  );
}

function NewChore() {
  const { t } = useTranslation();
  const { colors, radii, spacing, typography } = useTheme();
  const person = usePersonLabel();
  const { create } = useChoreActions();
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState<Group>('us');
  const [recurrence, setRecurrence] = useState<ChoreRecurrence>('none');
  const submit = () => {
    const clean = title.trim();
    if (!clean) return;
    setTitle('');
    void create({ title: clean, assignee, recurrence }).catch(() => setTitle(clean));
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
          testID="chores-new-title"
          accessibilityLabel={t('organize.chores.create')}
          placeholder={t('organize.chores.newPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={submit}
          maxLength={120}
          returnKeyType="done"
          style={[typography.body, styles.flex, { color: colors.text }]}
        />
        <IconButton
          testID="chores-create"
          icon={Plus}
          variant="primary"
          label={t('organize.chores.create')}
          onPress={submit}
        />
      </View>
      {title.trim() ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="caption" muted>
            {t('organize.chores.assigneeLabel')}
          </Text>
          <View style={[styles.wrap, { gap: spacing.sm }]}>
            {(['us', 'me', 'you'] as const).map((who) => (
              <Chip
                key={who}
                testID={`chores-new-assignee-${who}`}
                label={person(who)}
                selected={assignee === who}
                onPress={() => setAssignee(who)}
              />
            ))}
          </View>
          <View style={[styles.wrap, { gap: spacing.sm }]}>
            {CHORE_RECURRENCES.map((r) => (
              <Chip
                key={r}
                testID={`chores-new-recurrence-${r}`}
                label={t(`organize.chores.recurrences.${r}`)}
                selected={recurrence === r}
                onPress={() => setRecurrence(r)}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function ChoresView() {
  const { t } = useTranslation();
  const { radii, spacing } = useTheme();
  const surface = useSurfaceStyle();
  const person = usePersonLabel();
  const week = useChoreWeek();

  if (week.isPending) {
    return (
      <View testID="chores-loading" style={{ padding: spacing.lg, gap: spacing.md }}>
        <Skeleton height={120} radius={radii.lg} />
        <Skeleton height={120} radius={radii.lg} />
      </View>
    );
  }
  if (week.isError && !week.data) {
    return (
      <ErrorState
        testID="chores-error"
        code={week.error instanceof ApiError ? week.error.code : 'network'}
        onRetry={() => void week.refetch()}
      />
    );
  }
  const data = week.data;
  const empty = data.me.length + data.you.length + data.us.length === 0;
  return (
    <ScrollView
      testID="chores-week"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md }}
    >
      <NewChore />
      <View>
        <Text variant="heading">{t('organize.chores.weekTitle')}</Text>
        <Text variant="caption" muted>
          {t('organize.chores.weekHint')}
        </Text>
      </View>
      {empty ? (
        <EmptyState
          testID="chores-empty"
          icon={Sparkle}
          title={t('organize.chores.emptyTitle')}
          message={t('organize.chores.emptyMessage')}
        />
      ) : (
        (['me', 'you', 'us'] as const).map((group) => (
          <View
            key={group}
            testID={`chores-group-${group}`}
            style={[surface, { borderRadius: radii.lg, padding: spacing.md, gap: spacing.xs }]}
          >
            <Text variant="overline" color="primary">
              {person(group)}
            </Text>
            {data[group].length ? (
              data[group].map((chore) => <ChoreRow key={chore.id} chore={chore} />)
            ) : (
              <Text variant="caption" muted>
                {t('organize.chores.groupEmpty')}
              </Text>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  inline: { flexDirection: 'row', alignItems: 'center' },
  row: {
    minHeight: MIN_TOUCH_TARGET + 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  check: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    minHeight: MIN_TOUCH_TARGET + 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
    borderCurve: 'continuous',
  },
});
