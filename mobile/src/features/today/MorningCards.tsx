import * as Haptics from 'expo-haptics';
import { Check, Lightbulb } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, StyleSheet, View } from 'react-native';

import { usePartner } from '@/features/couple/usePartner';
import { useMe } from '@/features/me/useProfile';
import {
  Button,
  Celebration,
  Chip,
  Icon,
  Notice,
  PressableScale,
  Text,
  usePop,
  useSurfaceStyle,
  useTheme,
} from '@/ui';

import { MOOD_HUES, MOOD_ICONS } from './moods';
import {
  isTooMany,
  MOODS,
  NEEDS,
  REPLIES,
  useReply,
  useShareMood,
  useTakeBackMood,
  type MorningToday,
  type Mood,
} from './useMorning';

function MoodTile({
  mood,
  selected,
  onPress,
}: {
  mood: Mood;
  selected: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors, hues, radii, spacing } = useTheme();
  const hue = hues[MOOD_HUES[mood]];
  const { style: popStyle, pop } = usePop();
  return (
    <PressableScale
      testID={`mood-${mood}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={t(`morning.moods.${mood}`)}
      onPress={() => {
        pop();
        onPress();
      }}
      style={[
        styles.tile,
        {
          backgroundColor: hue.bg,
          borderRadius: radii.lg,
          padding: spacing.md,
          gap: spacing.sm,
          borderColor: selected ? hue.fg : 'transparent',
        },
      ]}
    >
      <Animated.View style={popStyle}>
        <Icon icon={MOOD_ICONS[mood]} size={30} tint={hue.fg} strokeWidth={1.75} />
      </Animated.View>
      <Text variant="label" style={{ color: hue.fg }}>
        {t(`morning.moods.${mood}`)}
      </Text>
      {selected ? (
        <View style={[styles.tick, { backgroundColor: colors.surface }]}>
          <Icon icon={Check} size={14} tint={hue.fg} strokeWidth={3} />
        </View>
      ) : null}
    </PressableScale>
  );
}

/** My morning: greeting, four moods, then an optional need. */
export function MyMorningCard({ today }: { today: MorningToday }) {
  const { t } = useTranslation();
  const { radii, spacing } = useTheme();
  const surface = useSurfaceStyle();
  const me = useMe();
  const partner = usePartner();
  const share = useShareMood();
  const takeBack = useTakeBackMood();
  const mine = today.mine;
  // Celebrate replies that arrive while the screen is open (not those already seen).
  const replyCount = mine?.replies.length ?? 0;
  const [seenReplies] = useState(replyCount);

  const choose = (mood: Mood) => {
    void Haptics.selectionAsync().catch(() => {});
    share.mutate({ mood, need: mine?.mood === mood ? (mine.need as never) : '' });
  };

  return (
    <View
      testID="my-morning"
      style={[surface, { borderRadius: radii.xl, padding: spacing.lg, gap: spacing.md }]}
    >
      <Celebration
        testID="reply-celebration"
        play={replyCount > seenReplies ? replyCount : false}
      />
      <View style={{ gap: spacing.xs }}>
        <Text variant="title">{t('morning.greeting', { name: me.data?.display_name ?? '' })}</Text>
        <Text variant="lead" muted>
          {t('morning.question')}
        </Text>
      </View>
      <View accessibilityRole="radiogroup" style={[styles.grid, { gap: spacing.sm }]}>
        {MOODS.map((mood) => (
          <MoodTile
            key={mood}
            mood={mood}
            selected={mine?.mood === mood}
            onPress={() => choose(mood)}
          />
        ))}
      </View>
      {mine ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="caption" muted>
            {t('morning.needLabel')}
          </Text>
          <View style={[styles.wrap, { gap: spacing.sm }]}>
            {NEEDS.map((need) => (
              <Chip
                key={need}
                testID={`need-${need}`}
                label={t(`morning.needs.${need}`)}
                selected={mine.need === need}
                onPress={() =>
                  share.mutate({ mood: mine.mood, need: mine.need === need ? '' : need })
                }
              />
            ))}
          </View>
          {mine.replies.length && partner ? (
            <View style={{ gap: spacing.xs }}>
              {mine.replies.map((reply, index) => (
                <Text
                  key={`${reply}-${index}`}
                  testID="received-reply"
                  variant="label"
                  color="primary"
                >
                  {t('morning.received', {
                    name: partner.display_name,
                    reply: t(`morning.replies.${reply}`),
                  })}
                </Text>
              ))}
            </View>
          ) : null}
          <Button
            testID="mood-take-back"
            variant="ghost"
            label={t('morning.takeBack')}
            onPress={() => takeBack.mutate()}
            style={styles.left}
          />
        </View>
      ) : null}
    </View>
  );
}

/** The partner's morning: their weather, how to speak to them, and one-tap answers. */
export function PartnerMorningCard({ today }: { today: MorningToday }) {
  const { t } = useTranslation();
  const { hues, radii, spacing } = useTheme();
  const surface = useSurfaceStyle();
  const partner = usePartner();
  const reply = useReply();
  const name = partner?.display_name ?? '';
  const theirs = today.partner;

  if (!theirs) {
    return (
      <View
        testID="partner-morning-waiting"
        style={[surface, { borderRadius: radii.xl, padding: spacing.lg }]}
      >
        <Text muted>{t('morning.partnerWaiting', { name })}</Text>
      </View>
    );
  }
  const hue = hues[MOOD_HUES[theirs.mood]];
  const advice =
    theirs.need && theirs.need !== 'nothing'
      ? t(`morning.advice.${theirs.need}`)
      : t(`morning.advice.${theirs.mood}`);
  return (
    <View
      testID="partner-morning"
      style={[surface, { borderRadius: radii.xl, padding: spacing.lg, gap: spacing.md }]}
    >
      <Text variant="overline" muted>
        {t('morning.partnerTitle', { name })}
      </Text>
      <View style={[styles.row, { gap: spacing.md }]}>
        <View style={[styles.badge, { backgroundColor: hue.bg, borderRadius: radii.lg }]}>
          <Icon icon={MOOD_ICONS[theirs.mood]} size={30} tint={hue.fg} strokeWidth={1.75} />
        </View>
        <View style={styles.flex}>
          <Text variant="heading">{t(`morning.moods.${theirs.mood}`)}</Text>
          {theirs.need ? <Text muted>{t(`morning.needs.${theirs.need}`)}</Text> : null}
        </View>
      </View>
      <View
        style={[
          styles.row,
          styles.advice,
          {
            backgroundColor: hue.bg,
            borderRadius: radii.md,
            padding: spacing.md,
            gap: spacing.smd,
          },
        ]}
      >
        <Icon icon={Lightbulb} size={20} tint={hue.fg} />
        <Text testID="partner-advice" style={[styles.flex, { color: hue.fg }]}>
          {advice}
        </Text>
      </View>
      <View style={{ gap: spacing.sm }}>
        <Text variant="caption" muted>
          {t('morning.replyTitle')}
        </Text>
        <View style={[styles.wrap, { gap: spacing.sm }]}>
          {REPLIES.map((code) => (
            <Chip
              key={code}
              testID={`reply-${code}`}
              label={t(`morning.replies.${code}`)}
              selected={theirs.replies.includes(code)}
              onPress={() => {
                void Haptics.selectionAsync().catch(() => {});
                reply.mutate(code);
              }}
            />
          ))}
        </View>
        {reply.isError && isTooMany(reply.error) ? (
          <Notice testID="reply-too-many" message={t('morning.tooMany')} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 96,
    borderWidth: 2,
    borderCurve: 'continuous',
    justifyContent: 'space-between',
  },
  tick: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  row: { flexDirection: 'row', alignItems: 'center' },
  advice: { alignItems: 'flex-start', borderCurve: 'continuous' },
  badge: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  left: { alignSelf: 'flex-start' },
});
