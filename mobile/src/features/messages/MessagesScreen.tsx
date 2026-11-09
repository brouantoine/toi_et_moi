import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { ImagePlus, MessageCircleHeart, Mic, Send, Square, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api';
import { usePartner } from '@/features/couple/usePartner';
import { pickImages } from '@/media/images';
import {
  EmptyState,
  ErrorState,
  IconButton,
  MIN_TOUCH_TARGET,
  Notice,
  Skeleton,
  Text,
  useTheme,
} from '@/ui';

import { formatDuration, MessageBubble, TypingBubble } from './MessageBubbles';
import { reportTyping, useTypingStore } from './typing';
import { useMarkRead, useMessageActions, useMessages, type Message } from './useMessages';
import { useVoiceRecorder } from './useVoiceRecorder';

function RecordingTimer({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  return (
    <Text testID="recording-timer" variant="label" color="primary">
      {formatDuration(now - startedAt)}
    </Text>
  );
}

function Composer() {
  const { t } = useTranslation();
  const { colors, radii, spacing, typography } = useTheme();
  const { sendText, sendPhoto, sendVoice } = useMessageActions();
  const voice = useVoiceRecorder();
  const [text, setText] = useState('');
  const [failed, setFailed] = useState(false);
  const recording = voice.state === 'recording';

  const guard = (task: Promise<unknown>) => {
    setFailed(false);
    void task.catch(() => setFailed(true));
  };

  const onChangeText = (value: string) => {
    setText(value);
    reportTyping(value.trim().length > 0);
  };
  // Leaving the conversation always ends "typing…" on the other phone.
  useEffect(() => () => reportTyping(false), []);

  const send = () => {
    const clean = text.trim();
    if (!clean) return;
    setText('');
    reportTyping(false);
    guard(sendText(clean));
  };

  const addPhoto = () =>
    guard(
      pickImages(1).then((result) => {
        if (result.status === 'picked' && result.images[0]) return sendPhoto(result.images[0]);
        return undefined;
      }),
    );

  const toggleRecording = async () => {
    if (!recording) {
      void Haptics.selectionAsync().catch(() => {});
      await voice.start();
      return;
    }
    const note = await voice.stop();
    if (note) guard(sendVoice(note.uri, note.durationMs));
  };

  return (
    <View
      style={[
        styles.composerWrap,
        {
          padding: spacing.sm,
          paddingHorizontal: spacing.md,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
          gap: spacing.sm,
        },
      ]}
    >
      {voice.state === 'denied' ? (
        <Notice
          testID="mic-denied"
          tone="warning"
          message={t('messages.micDenied')}
          actionLabel={t('memories.form.openSettings')}
          onAction={() => void Linking.openSettings()}
        />
      ) : null}
      {failed ? (
        <Notice testID="send-failed" tone="warning" message={t('messages.sendFailed')} />
      ) : null}
      <View style={[styles.composer, { gap: spacing.xs }]}>
        {recording ? (
          <>
            <IconButton
              testID="recording-cancel"
              icon={X}
              variant="plain"
              label={t('messages.cancelRecording')}
              onPress={() => void voice.cancel()}
            />
            <View
              style={[
                styles.field,
                styles.recording,
                {
                  backgroundColor: colors.primarySoft,
                  borderRadius: radii.lg,
                  paddingHorizontal: spacing.md,
                  gap: spacing.sm,
                },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <Text color="onPrimarySoft" style={styles.flex}>
                {t('messages.recording')}
              </Text>
              <RecordingTimer startedAt={voice.startedAt.current} />
            </View>
            <IconButton
              testID="recording-send"
              icon={Square}
              variant="primary"
              label={t('messages.stopAndSend')}
              onPress={() => void toggleRecording()}
            />
          </>
        ) : (
          <>
            <IconButton
              testID="message-photo"
              icon={ImagePlus}
              variant="plain"
              label={t('messages.addPhoto')}
              onPress={addPhoto}
            />
            <View
              style={[
                styles.field,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: radii.lg,
                  paddingHorizontal: spacing.md,
                },
              ]}
            >
              <TextInput
                testID="message-input"
                accessibilityLabel={t('messages.inputLabel')}
                placeholder={t('messages.placeholder')}
                placeholderTextColor={colors.textMuted}
                value={text}
                onChangeText={onChangeText}
                multiline
                maxLength={2000}
                style={[typography.body, styles.input, { color: colors.text }]}
              />
            </View>
            {text.trim() ? (
              <IconButton
                testID="message-send"
                icon={Send}
                variant="primary"
                label={t('messages.send')}
                onPress={send}
              />
            ) : (
              <IconButton
                testID="message-record"
                icon={Mic}
                variant="soft"
                label={t('messages.record')}
                onPress={() => void toggleRecording()}
              />
            )}
          </>
        )}
      </View>
    </View>
  );
}

/** The couple's private thread. No read receipts, no "online", no typing indicator. */
export function MessagesScreen() {
  const { t } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  const thread = useMessages();
  const { remove } = useMessageActions();
  const partner = usePartner();
  const partnerTyping = useTypingStore((state) => state.partnerTyping);
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useMarkRead(thread.messages, focused);

  const confirmDelete = (message: Message) =>
    Alert.alert(t('messages.deleteTitle'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('memories.detail.deleteConfirm'),
        style: 'destructive',
        onPress: () => void remove(message),
      },
    ]);

  let body;
  if (thread.isPending) {
    body = (
      <View testID="messages-loading" style={{ padding: spacing.lg, gap: spacing.md }}>
        <Skeleton width="60%" height={44} radius={radii.lg} />
        <View style={styles.rightSkeleton}>
          <Skeleton width="50%" height={44} radius={radii.lg} />
        </View>
      </View>
    );
  } else if (thread.isError && thread.messages.length === 0) {
    body = (
      <ErrorState
        testID="messages-error"
        code={thread.error instanceof ApiError ? thread.error.code : 'network'}
        error={thread.error}
        onRetry={() => void thread.refetch()}
      />
    );
  } else if (thread.messages.length === 0) {
    body = (
      <EmptyState
        testID="messages-empty"
        icon={MessageCircleHeart}
        title={t('messages.emptyTitle')}
        message={t('messages.emptyMessage')}
      />
    );
  } else {
    body = (
      <FlatList
        testID="messages-list"
        inverted
        data={thread.messages}
        keyExtractor={(m) => String(m.id)}
        renderItem={({ item }) => (
          <MessageBubble message={item} onLongPress={() => confirmDelete(item)} />
        )}
        contentContainerStyle={{ padding: spacing.md }}
        keyboardDismissMode="interactive"
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (thread.hasNextPage && !thread.isFetchingNextPage) void thread.fetchNextPage();
        }}
        // Inverted list: the header sits at the bottom, right under the newest message.
        ListHeaderComponent={
          partnerTyping ? <TypingBubble name={partner?.display_name ?? ''} /> : undefined
        }
        ListFooterComponent={
          thread.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : undefined
        }
      />
    );
  }

  return (
    <SafeAreaView
      testID="tab-us"
      edges={['top']}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View
        style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}
      >
        <Text variant="overline" color="primary">
          {t('messages.eyebrow')}
        </Text>
        <Text variant="title">{t('tabs.us.title')}</Text>
      </View>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.root}>{body}</View>
        <Composer />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  composerWrap: { borderTopWidth: StyleSheet.hairlineWidth },
  composer: { flexDirection: 'row', alignItems: 'flex-end' },
  field: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  recording: { flexDirection: 'row', alignItems: 'center' },
  input: { maxHeight: 120, paddingVertical: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rightSkeleton: { alignItems: 'flex-end' },
});
