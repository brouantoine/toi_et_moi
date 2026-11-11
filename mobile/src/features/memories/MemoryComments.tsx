import { ArrowUp, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon, MIN_TOUCH_TARGET, Notice, PressableScale, Skeleton, Text, useTheme } from '@/ui';

import {
  MAX_COMMENT_LENGTH,
  useAddComment,
  useComments,
  useDeleteComment,
  type MemoryComment,
} from './useMemoryDetail';

function CommentRow({ comment, onDelete }: { comment: MemoryComment; onDelete: () => void }) {
  const { t, i18n } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  const when = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
    new Date(comment.created_at),
  );
  return (
    <View
      testID={`memory-comment-${comment.id}`}
      style={[
        styles.bubble,
        {
          alignSelf: comment.mine ? 'flex-end' : 'flex-start',
          backgroundColor: comment.mine ? colors.primarySoft : colors.surfaceMuted,
          borderRadius: radii.lg,
          paddingVertical: spacing.smd,
          paddingLeft: spacing.md,
          paddingRight: comment.mine ? spacing.xs : spacing.md,
        },
      ]}
    >
      <View style={styles.flex}>
        <Text variant="overline" color={comment.mine ? 'onPrimarySoft' : 'textMuted'}>
          {`${comment.mine ? t('memories.detail.you') : (comment.author_name ?? '')} · ${when}`}
        </Text>
        <Text color={comment.mine ? 'onPrimarySoft' : 'text'}>{comment.body}</Text>
      </View>
      {comment.mine ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('memories.detail.deleteComment')}
          onPress={onDelete}
          hitSlop={4}
          style={styles.delete}
        >
          <Icon icon={Trash2} size={18} color="onPrimarySoft" />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Short words left on a memory. No read receipts, no counters. */
export function MemoryComments({ memoryId }: { memoryId: number }) {
  const { t } = useTranslation();
  const { colors, radii, spacing, typography } = useTheme();
  const comments = useComments(memoryId);
  const add = useAddComment(memoryId);
  const remove = useDeleteComment(memoryId);
  const [draft, setDraft] = useState('');
  const canSend = draft.trim().length > 0 && !add.isPending;

  const send = () => {
    if (!canSend) return;
    add.mutate(draft, { onSuccess: () => setDraft('') });
  };

  const confirmDelete = (comment: MemoryComment) =>
    Alert.alert(t('memories.detail.deleteCommentTitle'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('memories.detail.deleteConfirm'),
        style: 'destructive',
        onPress: () => remove.mutate(comment.id),
      },
    ]);

  return (
    <View style={{ gap: spacing.md }} testID="memory-comments">
      <Text variant="overline" muted>
        {t('memories.detail.commentsTitle')}
      </Text>

      {comments.isPending ? (
        <View style={{ gap: spacing.sm }}>
          <Skeleton width="70%" height={56} radius={radii.lg} />
          <Skeleton width="55%" height={56} radius={radii.lg} />
        </View>
      ) : comments.isError ? (
        <Notice
          message={t('memories.detail.commentsError')}
          actionLabel={t('common.retry')}
          onAction={() => void comments.refetch()}
        />
      ) : comments.data.length === 0 ? (
        <Text muted testID="memory-comments-empty">
          {t('memories.detail.commentsEmpty')}
        </Text>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {comments.data.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              onDelete={() => confirmDelete(comment)}
            />
          ))}
        </View>
      )}

      {add.isError ? (
        <Notice
          tone="warning"
          testID="memory-comment-error"
          message={t('memories.detail.commentError')}
        />
      ) : null}

      <View
        style={[
          styles.composer,
          {
            backgroundColor: colors.surfaceMuted,
            borderRadius: radii.lg,
            paddingLeft: spacing.md,
            paddingRight: spacing.xs,
            gap: spacing.sm,
          },
        ]}
      >
        <TextInput
          testID="memory-comment-input"
          accessibilityLabel={t('memories.detail.commentLabel')}
          placeholder={t('memories.detail.commentPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          maxLength={MAX_COMMENT_LENGTH}
          multiline
          style={[typography.body, styles.input, { color: colors.text }]}
        />
        <PressableScale
          testID="memory-comment-send"
          accessibilityRole="button"
          accessibilityLabel={t('memories.detail.send')}
          accessibilityState={{ disabled: !canSend, busy: add.isPending }}
          disabled={!canSend}
          onPress={send}
          scaleTo={0.9}
          hitSlop={(MIN_TOUCH_TARGET - SEND) / 2}
          style={[styles.send, { backgroundColor: colors.primary }]}
        >
          <Icon icon={ArrowUp} size={20} color="onPrimary" strokeWidth={2.25} />
        </PressableScale>
      </View>
    </View>
  );
}

const SEND = 40;

const styles = StyleSheet.create({
  flex: { flexShrink: 1 },
  bubble: {
    maxWidth: '88%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderCurve: 'continuous',
  },
  delete: {
    width: MIN_TOUCH_TARGET - 8,
    height: MIN_TOUCH_TARGET - 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: MIN_TOUCH_TARGET + 4,
    paddingVertical: 6,
    borderCurve: 'continuous',
  },
  input: { flex: 1, paddingVertical: 8, maxHeight: 140 },
  send: {
    width: SEND,
    height: SEND,
    borderRadius: SEND / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
