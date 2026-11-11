import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Check, ChevronRight, Clock, Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useCouple } from '@/features/couple/useCouple';
import { usePartner } from '@/features/couple/usePartner';
import { useMe } from '@/features/me/useProfile';
import { Avatar, Icon, PressableScale, Text, useTheme, type Hue } from '@/ui';

import { packHue } from './art';
import type { Pack } from './useGames';

export type Face = { name: string; uri: string | null; preset: string | null };

/** The two of us, as small avatars. Used by the cards, the results and "who is most likely". */
export function useCoupleFaces(): { me: Face; partner: Face } {
  const me = useMe();
  const couple = useCouple({ enabled: false });
  const partner = usePartner();
  return {
    me: {
      name: me.data?.display_name ?? '',
      uri: couple.data?.members.find((m) => m.id === me.data?.id)?.avatar_url ?? null,
      preset: me.data?.avatar_preset ?? null,
    },
    partner: {
      name: partner?.display_name ?? '',
      uri: partner?.avatar_url ?? null,
      preset: (partner as { avatar_preset?: string | null } | undefined)?.avatar_preset ?? null,
    },
  };
}

/** Small avatar with a tick once that person has finished. */
export function Player({ face, done, size = 34 }: { face: Face; done: boolean; size?: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={t(done ? 'games.answeredBy' : 'games.notAnsweredBy', { name: face.name })}
    >
      <Avatar name={face.name} uri={face.uri} preset={face.preset} size={size} ring />
      {done ? (
        <View
          style={[styles.tick, { backgroundColor: colors.secondary, borderColor: colors.surface }]}
        >
          <Icon icon={Check} size={10} color="onSecondary" strokeWidth={3.5} />
        </View>
      ) : null}
    </View>
  );
}

/** Coloured badges (18+, Kids, Money…) so the couple knows what a pack touches. */
export function TagBadges({ pack, hue }: { pack: Pack; hue: Hue }) {
  const { colors, hues } = useTheme();
  const tint = hues[hue];
  return (
    <>
      {pack.tags.map((tag) => {
        const adult = tag.slug === 'adult';
        return (
          <View
            key={tag.slug}
            style={[styles.badge, { backgroundColor: adult ? colors.primary : tint.fg }]}
          >
            <Text variant="overline" style={{ color: adult ? colors.onPrimary : tint.bg }}>
              {tag.name}
            </Text>
          </View>
        );
      })}
    </>
  );
}

function ctaKey(pack: Pack): string {
  if (pack.locked) return 'locked';
  if (pack.state === 'your_turn' && pack.mine > 0) return 'in_progress';
  return pack.state;
}

type Props = { pack: Pack; width?: number };

/** One pack as a pastel card: its kind, badges, title, art, who played, what to do next. */
export function PackCard({ pack, width }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, hues, radii, spacing } = useTheme();
  const faces = useCoupleFaces();
  const hue = packHue(pack);
  const tint = hues[hue];
  const cta = ctaKey(pack);

  return (
    <PressableScale
      testID={`pack-${pack.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${pack.kind_name} : ${pack.title}. ${t(`games.cta.${cta}`)}`}
      onPress={() => router.push(pack.locked ? '/premium' : `/games/${pack.id}`)}
      style={[
        styles.card,
        {
          width,
          backgroundColor: tint.bg,
          borderRadius: radii.xl,
          padding: spacing.md,
          gap: spacing.md,
        },
      ]}
    >
      <View style={[styles.row, styles.top, { gap: spacing.md }]}>
        <View style={[styles.flex, { gap: spacing.xs }]}>
          <View style={[styles.row, styles.wrap, { gap: spacing.xs }]}>
            <TagBadges pack={pack} hue={hue} />
            <Text variant="overline" style={{ color: tint.fg }} numberOfLines={1}>
              {pack.kind_name}
            </Text>
          </View>
          <Text variant="label" numberOfLines={2} style={styles.title}>
            {pack.title}
          </Text>
        </View>
        <Image
          source={{ uri: pack.art }}
          style={styles.art}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={120}
        />
      </View>
      <View style={[styles.row, styles.between]}>
        <View style={[styles.row, styles.players]}>
          <Player face={faces.me} done={pack.mine === pack.total} />
          <Player face={faces.partner} done={pack.theirs === pack.total} />
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
          {cta === 'waiting' ? (
            <Icon icon={Clock} size={14} tint={tint.fg} strokeWidth={2.4} />
          ) : null}
          <Text variant="caption" style={[styles.ctaText, { color: tint.fg }]}>
            {t(`games.cta.${cta}`)}
          </Text>
          {cta === 'waiting' ? null : (
            <Icon
              icon={cta === 'locked' ? Lock : ChevronRight}
              size={cta === 'locked' ? 14 : 16}
              tint={tint.fg}
              strokeWidth={2.4}
            />
          )}
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { borderCurve: 'continuous' },
  row: { flexDirection: 'row', alignItems: 'center' },
  top: { alignItems: 'flex-start' },
  wrap: { flexWrap: 'wrap' },
  between: { justifyContent: 'space-between' },
  players: { gap: -8 },
  flex: { flex: 1 },
  title: { fontSize: 17, lineHeight: 22 },
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
