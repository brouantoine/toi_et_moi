import { Image } from 'expo-image';
import { Send, ShieldCheck, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api';
import { usePartner } from '@/features/couple/usePartner';
import { EMOJI } from '@/features/games/art';
import { TypingBubble } from '@/features/messages/MessageBubbles';
import {
  Button,
  Card,
  ErrorState,
  Icon,
  IconButton,
  LoadingState,
  Notice,
  Text,
  useTheme,
} from '@/ui';

import { useCoach, useCoachActions, type CoachMessage, type CoachThread } from './useCoach';

const INTRO = [1, 2, 3, 4] as const;

/** Before the coach opens: what it is, and each partner turning it on for themselves. */
function Intro({ thread, partnerName }: { thread: CoachThread; partnerName: string }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { consent } = useCoachActions();
  const mine = thread.consent.mine;
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <View style={[styles.center, { gap: spacing.sm }]}>
        <Image source={EMOJI.robot} style={styles.hero} contentFit="contain" />
        <Text variant="title" style={styles.textCenter}>
          {t('coach.introTitle')}
        </Text>
      </View>
      <Card testID="coach-intro">
        {INTRO.map((n) => (
          <View key={n} style={[styles.row, { gap: spacing.smd }]}>
            <Icon icon={ShieldCheck} size={20} color="primary" />
            <Text style={styles.flex}>{t(`coach.intro${n}`)}</Text>
          </View>
        ))}
      </Card>
      {mine && !thread.consent.partner ? (
        <Notice testID="coach-waiting" message={t('coach.waiting', { name: partnerName })} />
      ) : null}
      <Button
        testID="coach-consent"
        size="lg"
        variant={mine ? 'ghost' : 'primary'}
        label={t(mine ? 'coach.disable' : 'coach.enable')}
        loading={consent.isPending}
        onPress={() => consent.mutate(!mine)}
      />
    </ScrollView>
  );
}

function Bubble({ message, partnerName }: { message: CoachMessage; partnerName: string }) {
  const { t } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  if (message.author === 'notice') {
    return (
      <View style={{ marginVertical: spacing.xs }}>
        <Notice testID={`coach-notice-${message.id}`} tone="warning" message={message.text} />
      </View>
    );
  }
  const mine = message.author === 'me';
  const coach = message.author === 'coach';
  const who = coach ? t('coach.coachName') : mine ? t('coach.you') : partnerName;
  return (
    <View
      testID={`coach-message-${message.id}`}
      accessible
      accessibilityLabel={`${who} : ${message.text}`}
      style={[styles.bubbleRow, mine ? styles.right : styles.left]}
    >
      <Text variant="caption" muted style={{ marginHorizontal: spacing.xs }}>
        {who}
      </Text>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: coach
              ? colors.secondarySoft
              : mine
                ? colors.primarySoft
                : colors.surfaceMuted,
            borderRadius: radii.lg,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
        ]}
      >
        <Text color={coach ? 'onSecondarySoft' : mine ? 'onPrimarySoft' : 'text'} selectable>
          {message.text}
        </Text>
      </View>
    </View>
  );
}

function Conversation({ thread, partnerName }: { thread: CoachThread; partnerName: string }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, radii, spacing, typography } = useTheme();
  const { send, erase, consent } = useCoachActions();
  const [text, setText] = useState('');
  const messages = [...thread.messages].reverse();

  const submit = () => {
    const clean = text.trim();
    if (!clean) return;
    setText('');
    send.mutate(clean);
  };
  const confirmErase = () =>
    Alert.alert(t('coach.eraseTitle'), t('coach.eraseMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('coach.eraseConfirm'), style: 'destructive', onPress: () => erase.mutate() },
    ]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top + 44}
    >
      <View style={[styles.row, styles.between, { paddingHorizontal: spacing.lg }]}>
        <Text variant="caption" muted style={styles.flex}>
          {t('coach.subtitle')}
        </Text>
        <IconButton
          testID="coach-erase"
          icon={Trash2}
          variant="plain"
          label={t('coach.erase')}
          onPress={confirmErase}
        />
      </View>
      {thread.available ? null : (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Notice testID="coach-unavailable" message={t('coach.unavailable')} />
        </View>
      )}
      <FlatList
        testID="coach-list"
        inverted
        data={messages}
        keyExtractor={(m) => String(m.id)}
        renderItem={({ item }) => <Bubble message={item} partnerName={partnerName} />}
        contentContainerStyle={{ padding: spacing.md }}
        keyboardDismissMode="interactive"
        ListHeaderComponent={
          thread.thinking ? <TypingBubble name={t('coach.coachName')} /> : undefined
        }
        ListFooterComponent={
          messages.length === 0 ? (
            <Text muted style={[styles.textCenter, { padding: spacing.lg }]} testID="coach-empty">
              {t('coach.empty')}
            </Text>
          ) : undefined
        }
      />
      {send.isError ? (
        <View style={{ paddingHorizontal: spacing.md }}>
          <Notice testID="coach-send-error" tone="warning" message={t('coach.sendError')} />
        </View>
      ) : null}
      <View
        style={[
          styles.composer,
          {
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
            paddingBottom: Math.max(insets.bottom, spacing.sm),
            borderTopColor: colors.border,
          },
        ]}
      >
        <TextInput
          testID="coach-input"
          accessibilityLabel={t('coach.inputLabel')}
          placeholder={t('coach.placeholder')}
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          editable={thread.available}
          multiline
          maxLength={2000}
          style={[
            styles.input,
            typography.body,
            {
              color: colors.text,
              backgroundColor: colors.surfaceMuted,
              borderRadius: radii.lg,
              paddingHorizontal: spacing.md,
            },
          ]}
        />
        <IconButton
          testID="coach-send"
          icon={Send}
          variant="primary"
          label={t('coach.send')}
          onPress={submit}
        />
      </View>
      <View style={[styles.center, { paddingBottom: spacing.xs }]}>
        <Button
          testID="coach-disable"
          variant="ghost"
          label={t('coach.disable')}
          loading={consent.isPending}
          onPress={() => consent.mutate(false)}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

/** The shared AI coach: one conversation for both partners, nothing private. */
export function CoachScreen() {
  const { colors } = useTheme();
  const query = useCoach();
  const partner = usePartner();
  const partnerName = partner?.display_name ?? '';

  if (query.isPending) return <LoadingState testID="coach-loading" />;
  if (query.isError) {
    return (
      <ErrorState
        testID="coach-error"
        code={query.error instanceof ApiError ? query.error.code : 'network'}
        onRetry={() => void query.refetch()}
      />
    );
  }
  return (
    <View testID="coach-screen" style={[styles.flex, { backgroundColor: colors.background }]}>
      {query.data.active ? (
        <Conversation thread={query.data} partnerName={partnerName} />
      ) : (
        <Intro thread={query.data} partnerName={partnerName} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { justifyContent: 'space-between' },
  center: { alignItems: 'center' },
  textCenter: { textAlign: 'center' },
  hero: { width: 96, height: 96 },
  bubbleRow: { maxWidth: '86%', marginVertical: 4, gap: 2 },
  right: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  left: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { borderCurve: 'continuous' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, minHeight: 44, maxHeight: 120, paddingVertical: 10 },
});
