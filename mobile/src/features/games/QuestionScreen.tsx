import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { HeartHandshake, Hourglass, MessagesSquare, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api';
import { usePartner } from '@/features/couple/usePartner';
import { useMe } from '@/features/me/useProfile';
import {
  Button,
  Celebration,
  ErrorState,
  IconButton,
  Input,
  LoadingState,
  Notice,
  PressableScale,
  Text,
  useTheme,
} from '@/ui';

import { kindArt } from './art';
import { topicOf, useAnswer, useQuestions, type Question } from './useGames';

type Names = { me: string; partner: string };

/**
 * What a given answer says, in words. "Who is most likely" is stored from the
 * answerer's point of view (0 = me, 1 = my partner), so it becomes a first name.
 */
export function answerLabel(
  question: Question,
  answer: { choice?: number | null; text?: string },
  by: 'me' | 'partner',
  names: Names,
): string {
  if (question.kind === 'conversation') return answer.text ?? '';
  if (question.kind === 'most_likely') {
    const pointsAtAnswerer = answer.choice === 0;
    return pointsAtAnswerer === (by === 'me') ? names.me : names.partner;
  }
  return question.options[answer.choice ?? 0] ?? '';
}

function AnswerBlock({ who, text, tint }: { who: string; text: string; tint: string }) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View
      style={[
        styles.answer,
        { backgroundColor: colors.surfaceMuted, borderRadius: radii.lg, padding: spacing.md },
      ]}
    >
      <Text variant="overline" style={{ color: tint }}>
        {who}
      </Text>
      <Text variant="label">{text}</Text>
    </View>
  );
}

function Play({ question, names }: { question: Question; names: Names }) {
  const { t } = useTranslation();
  const { hues, radii, spacing } = useTheme();
  const send = useAnswer();
  const [text, setText] = useState('');
  const hue = hues[kindArt(question.kind).hue];

  const choose = (choice: number) => {
    void Haptics.selectionAsync().catch(() => {});
    send.mutate({ question: question.id, choice });
  };

  return (
    <View style={{ gap: spacing.md }}>
      {question.state === 'your_turn' ? (
        <Notice
          testID="question-hidden-hint"
          message={t('games.hiddenHint', { name: names.partner })}
        />
      ) : null}
      {question.kind === 'conversation' ? (
        <>
          <Input
            testID="question-text"
            label={t('games.answerLabel')}
            placeholder={t('games.answerPlaceholder')}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={600}
          />
          <Button
            testID="question-send"
            size="lg"
            label={t('games.send')}
            disabled={!text.trim()}
            loading={send.isPending}
            onPress={() => send.mutate({ question: question.id, text: text.trim() })}
          />
        </>
      ) : (
        question.options.map((option, index) => (
          <PressableScale
            key={option}
            testID={`question-option-${index}`}
            accessibilityRole="button"
            accessibilityLabel={answerLabel(question, { choice: index }, 'me', names)}
            disabled={send.isPending}
            onPress={() => choose(index)}
            style={[
              styles.option,
              { backgroundColor: hue.bg, borderRadius: radii.xl, padding: spacing.lg },
            ]}
          >
            <Text variant="heading" style={[styles.center, { color: hue.fg }]}>
              {answerLabel(question, { choice: index }, 'me', names)}
            </Text>
          </PressableScale>
        ))
      )}
      {send.isError ? (
        <Notice testID="question-error" tone="warning" message={t('games.sendError')} />
      ) : null}
    </View>
  );
}

function Outcome({ question, names }: { question: Question; names: Names }) {
  const { t } = useTranslation();
  const { colors, hues, spacing } = useTheme();
  const hue = hues[kindArt(question.kind).hue];
  if (!question.mine) return null;
  const mine = (
    <AnswerBlock
      who={t('games.mine')}
      text={answerLabel(question, question.mine, 'me', names)}
      tint={hue.fg}
    />
  );
  if (question.state === 'waiting' || !question.theirs) {
    return (
      <View testID="question-waiting" style={{ gap: spacing.md }}>
        {mine}
        <Notice icon={Hourglass} message={t('games.waitingFor', { name: names.partner })} />
      </View>
    );
  }
  return (
    <View testID="question-reveal" style={{ gap: spacing.md }}>
      <Text variant="heading">{t('games.revealTitle')}</Text>
      {mine}
      <AnswerBlock
        who={names.partner}
        text={answerLabel(question, question.theirs, 'partner', names)}
        tint={colors.secondary}
      />
      {question.match === null ? null : (
        <Notice
          testID={question.match ? 'question-match' : 'question-differ'}
          icon={question.match ? HeartHandshake : MessagesSquare}
          message={t(question.match ? 'games.match' : 'games.differ')}
        />
      )}
      <Celebration play={question.match ? question.id : false} />
    </View>
  );
}

/** One question: answer on your own, then discover both answers together. */
export function QuestionScreen({ questionId }: { questionId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, hues, spacing } = useTheme();
  const me = useMe();
  const partner = usePartner();
  const query = useQuestions({ topic: topicOf(questionId) });
  const question = query.data?.find((item) => item.id === questionId);

  const close = (
    <View
      style={[styles.close, { paddingTop: insets.top + spacing.xs, paddingHorizontal: spacing.md }]}
    >
      <IconButton
        testID="question-close"
        icon={X}
        variant="plain"
        label={t('games.close')}
        onPress={() => router.back()}
      />
    </View>
  );

  if (query.isPending) return <LoadingState testID="question-loading" />;
  if (query.isError || !question) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {close}
        <ErrorState
          testID="question-load-error"
          code={query.error instanceof ApiError ? query.error.code : 'not_found'}
          onRetry={() => void query.refetch()}
        />
      </View>
    );
  }
  const art = kindArt(question.kind);
  const names = { me: me.data?.display_name ?? '', partner: partner?.display_name ?? '' };
  const answered = question.state === 'waiting' || question.state === 'done';

  return (
    <KeyboardAvoidingView
      testID="question-screen"
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {close}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
        }}
      >
        <View style={[styles.head, { gap: spacing.md }]}>
          <Image source={art.image} style={styles.art} contentFit="contain" />
          <Text variant="overline" style={{ color: hues[art.hue].fg }}>
            {t(`games.kinds.${question.kind}`)}
          </Text>
          <Text variant="title" style={styles.center} testID="question-text-title">
            {question.text}
          </Text>
        </View>
        {answered ? (
          <Outcome question={question} names={names} />
        ) : (
          <Play question={question} names={names} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  close: { flexDirection: 'row', justifyContent: 'flex-end' },
  head: { alignItems: 'center' },
  art: { width: 96, height: 96 },
  center: { textAlign: 'center' },
  option: { borderCurve: 'continuous', minHeight: 84, justifyContent: 'center' },
  answer: { gap: 4, borderCurve: 'continuous' },
});
