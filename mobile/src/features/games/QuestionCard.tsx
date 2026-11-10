import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Check, ChevronRight, Clock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useCouple } from '@/features/couple/useCouple';
import { usePartner } from '@/features/couple/usePartner';
import { useMe } from '@/features/me/useProfile';
import { Avatar, Icon, PressableScale, Text, useTheme } from '@/ui';

import { kindArt } from './art';
import type { Question } from './useGames';

/** Small avatar with a tick once that person has answered. */
function Answerer({
  name,
  uri,
  answered,
}: {
  name: string;
  uri?: string | null;
  answered: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={t(answered ? 'games.answeredBy' : 'games.notAnsweredBy', { name })}
    >
      <Avatar name={name} uri={uri} size={32} />
      {answered ? (
        <View
          style={[styles.tick, { backgroundColor: colors.secondary, borderColor: colors.surface }]}
        >
          <Icon icon={Check} size={10} color="onSecondary" strokeWidth={3.5} />
        </View>
      ) : null}
    </View>
  );
}

type Props = { question: Question; width?: number };

/** One question as a pastel card: its kind, its text, who answered, what to do next. */
export function QuestionCard({ question, width }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, hues, radii, spacing } = useTheme();
  const me = useMe();
  const couple = useCouple({ enabled: false });
  const partner = usePartner();
  const art = kindArt(question.kind);
  const hue = hues[art.hue];
  const mine = question.state === 'waiting' || question.state === 'done';
  const theirs = question.state === 'your_turn' || question.state === 'done';
  const myAvatar = couple.data?.members.find((m) => m.id === me.data?.id)?.avatar_url;

  return (
    <PressableScale
      testID={`question-${question.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${t(`games.kinds.${question.kind}`)} : ${question.text}. ${t(`games.cta.${question.state}`)}`}
      onPress={() => router.push(`/games/${question.id}`)}
      style={[
        styles.card,
        {
          width,
          backgroundColor: hue.bg,
          borderRadius: radii.xl,
          padding: spacing.md,
          gap: spacing.md,
        },
      ]}
    >
      <View style={[styles.row, { gap: spacing.md }]}>
        <View style={[styles.flex, { gap: spacing.xs }]}>
          <View style={[styles.row, { gap: spacing.sm }]}>
            {question.adult ? (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text variant="overline" color="onPrimary">
                  {t('games.adultBadge')}
                </Text>
              </View>
            ) : null}
            <Text variant="overline" style={{ color: hue.fg }}>
              {t(`games.kinds.${question.kind}`)}
            </Text>
          </View>
          <Text variant="label" numberOfLines={3}>
            {question.text}
          </Text>
        </View>
        <Image source={art.image} style={styles.art} contentFit="contain" />
      </View>
      <View style={[styles.row, styles.between]}>
        <View style={[styles.row, { gap: -8 }]}>
          <Answerer name={me.data?.display_name ?? ''} uri={myAvatar} answered={mine} />
          <Answerer
            name={partner?.display_name ?? ''}
            uri={partner?.avatar_url}
            answered={theirs}
          />
        </View>
        <View
          style={[
            styles.cta,
            {
              backgroundColor: colors.surface,
              borderRadius: radii.pill,
              gap: spacing.xs,
              paddingHorizontal: spacing.smd,
            },
          ]}
        >
          {question.state === 'waiting' ? (
            <Icon icon={Clock} size={14} tint={hue.fg} strokeWidth={2.4} />
          ) : null}
          <Text variant="caption" style={[styles.ctaText, { color: hue.fg }]}>
            {t(`games.cta.${question.state}`)}
          </Text>
          {question.state === 'waiting' ? null : (
            <Icon icon={ChevronRight} size={16} tint={hue.fg} strokeWidth={2.4} />
          )}
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { borderCurve: 'continuous' },
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { justifyContent: 'space-between' },
  flex: { flex: 1 },
  art: { width: 52, height: 52 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  cta: { flexDirection: 'row', alignItems: 'center', height: 34 },
  ctaText: { fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  tick: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
