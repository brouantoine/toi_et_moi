import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { Inbox } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api';
import { usePartner } from '@/features/couple/usePartner';
import { Button, Card, EmptyState, ErrorState, LoadingState, Notice, Text, useTheme } from '@/ui';

import { kindArt, topicArt } from './art';
import { QuestionCard } from './QuestionCard';
import { useGamesHome, useQuestions, useSetAdult, type QuestionState } from './useGames';

const STATES: readonly string[] = ['your_turn', 'waiting', 'done'];

/** Adults-only topic: each partner turns it on for themselves; it opens when both did. */
function AdultGate() {
  const { t } = useTranslation();
  const { home } = useGamesHome();
  const partner = usePartner();
  const setAdult = useSetAdult();
  const mine = home?.adult.mine ?? false;
  return (
    <Card testID="adult-gate">
      <Text variant="heading">{t('games.adultTitle')}</Text>
      <Text muted>{t('games.adultExplain')}</Text>
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

/** Questions of one topic, one kind of game, or one state ("your turn"…). */
export function QuestionListScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, spacing } = useTheme();
  const params = useLocalSearchParams<{ topic?: string; kind?: string; state?: string }>();
  const state = STATES.includes(params.state ?? '') ? (params.state as QuestionState) : undefined;
  const { home } = useGamesHome();
  const query = useQuestions({ topic: params.topic, kind: params.kind });

  const topic = home?.topics.find((item) => item.slug === params.topic);
  const kind = home?.kinds.find((item) => item.slug === params.kind);
  const title =
    topic?.name ?? kind?.name ?? (state ? t(`games.listTitle.${state}`) : t('games.title'));
  const art = params.topic ? topicArt(params.topic) : params.kind ? kindArt(params.kind) : null;

  if (query.isPending) return <LoadingState testID="questions-loading" />;
  if (query.isError) {
    return (
      <ErrorState
        testID="questions-error"
        code={query.error instanceof ApiError ? query.error.code : 'network'}
        onRetry={() => void query.refetch()}
      />
    );
  }
  const questions = state ? query.data.filter((q) => q.state === state) : query.data;

  return (
    <ScrollView
      testID="questions-screen"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        padding: spacing.lg,
        gap: spacing.md,
        paddingBottom: insets.bottom + spacing.xl,
      }}
    >
      <View style={[styles.header, { gap: spacing.md }]}>
        {art ? <Image source={art.image} style={styles.art} contentFit="contain" /> : null}
        <View style={styles.flex}>
          <Text variant="title">{title}</Text>
          {topic && !topic.locked ? (
            <Text muted>{t('games.progress', { done: topic.done, total: topic.total })}</Text>
          ) : null}
        </View>
      </View>
      {topic?.adult ? <AdultGate /> : null}
      {questions.length === 0 && !topic?.locked ? (
        <EmptyState icon={Inbox} title={t('games.emptyList')} />
      ) : null}
      {questions.map((question) => (
        <QuestionCard key={question.id} question={question} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  art: { width: 64, height: 64 },
  flex: { flex: 1 },
});
