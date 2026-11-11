/**
 * Results of a pack: how close your answers are, then every item with both answers side
 * by side. Shown to me alone (waiting for the partner) until both finished.
 */
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Hourglass, MessageCircleHeart } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Button, Celebration, Notice, Text, useTheme, type HueColors } from '@/ui';

import { DrawingView } from './Drawing';
import { Player, type Face } from './PackCard';
import type { GivenAnswer, PackDetail, PackItem } from './useGames';

type Faces = { me: Face; partner: Face };

/** A half ring filled up to `percent`. */
export function SimilarityGauge({ percent: raw, tint }: { percent: number; tint: HueColors }) {
  const { t } = useTranslation();
  const percent = Math.max(0, Math.min(100, Math.round(raw)));
  const size = 220;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const arc = (to: number) => {
    const angle = Math.PI * (1 - to / 100);
    const x = cx + r * Math.cos(angle);
    const y = cy - r * Math.sin(angle);
    return `M${cx - r} ${cy} A${r} ${r} 0 0 1 ${x} ${y}`;
  };
  return (
    <View
      testID="similarity"
      accessible
      accessibilityLabel={t('games.results.similarity', { percent })}
      style={styles.gauge}
    >
      <Svg width={size} height={size / 2 + stroke}>
        <Path
          d={arc(100)}
          stroke={tint.bg}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
        />
        {percent > 0 ? (
          <Path
            d={arc(percent)}
            stroke={tint.fg}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
          />
        ) : null}
      </Svg>
      <View style={styles.gaugeText}>
        <Text style={[styles.percent, { color: tint.fg }]}>{`${percent} %`}</Text>
        <Text variant="caption" muted style={styles.center}>
          {t('games.results.similarityLabel')}
        </Text>
      </View>
    </View>
  );
}

/** Column (0 or 1) an answer lands in. "Most likely" is stored from the answerer's view. */
function column(pack: PackDetail, answer: GivenAnswer, by: 'me' | 'partner'): number | null {
  if (answer.skipped || answer.choice == null) return null;
  if (pack.kind === 'most_likely' && by === 'partner') return 1 - answer.choice;
  return answer.choice;
}

function ChoiceRow({
  pack,
  item,
  faces,
  tint,
}: {
  pack: PackDetail;
  item: PackItem;
  faces: Faces;
  tint: HueColors;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const labels =
    pack.kind === 'most_likely'
      ? [faces.me.name, faces.partner.name]
      : item.options.map((o) => o.name);
  const mine = item.mine ? column(pack, item.mine, 'me') : null;
  const theirs = item.theirs ? column(pack, item.theirs, 'partner') : null;
  return (
    <View style={[styles.columns, { gap: spacing.sm }]}>
      {labels.map((label, index) => (
        <View
          key={index}
          style={[
            styles.column,
            { gap: spacing.sm },
            index === 1 && {
              borderLeftWidth: StyleSheet.hairlineWidth,
              borderLeftColor: colors.border,
            },
          ]}
        >
          {item.options[index]?.art ? (
            <Image
              source={{ uri: item.options[index]?.art ?? undefined }}
              style={styles.optionArt}
              contentFit="contain"
            />
          ) : null}
          <Text variant="label" style={[styles.center, { color: tint.fg }]}>
            {label}
          </Text>
          <View style={styles.faces}>
            {mine === index ? <Player face={faces.me} done={false} size={30} /> : null}
            {theirs === index ? (
              <View style={mine === index ? styles.overlap : undefined}>
                <Player face={faces.partner} done={false} size={30} />
              </View>
            ) : null}
          </View>
        </View>
      ))}
      {[item.mine?.skipped ? faces.me : null, item.theirs?.skipped ? faces.partner : null].map(
        (face, index) =>
          face ? (
            <Text key={index} variant="caption" muted style={styles.skippedNote}>
              {t('games.results.skippedBy', { name: face.name })}
            </Text>
          ) : null,
      )}
    </View>
  );
}

function Given({
  answer,
  face,
  mode,
  width,
}: {
  answer: GivenAnswer | null;
  face: Face;
  mode: string;
  width: number;
}) {
  const { t } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  let body;
  if (!answer) body = <Text muted>{t('games.results.notYet')}</Text>;
  else if (answer.skipped) body = <Text muted>{t('games.results.skipped')}</Text>;
  else if (mode === 'drawing') body = <DrawingView strokes={answer.drawing} size={width} />;
  else if (mode === 'photo')
    body = answer.photo_url ? (
      <Image
        source={{ uri: answer.photo_url }}
        style={{ width, height: width, borderRadius: radii.lg }}
        contentFit="cover"
      />
    ) : null;
  else body = <Text selectable>{answer.text}</Text>;
  return (
    <View style={[styles.given, { gap: spacing.sm, width: mode === 'text' ? undefined : width }]}>
      <View style={[styles.row, { gap: spacing.sm }]}>
        <Player face={face} done={false} size={26} />
        <Text variant="caption" style={{ color: colors.textMuted }}>
          {face.name}
        </Text>
      </View>
      {body}
    </View>
  );
}

export function Results({
  pack,
  faces,
  tint,
}: {
  pack: PackDetail;
  faces: Faces;
  tint: HueColors;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors, radii, spacing } = useTheme();
  const done = pack.state === 'done';
  const half = Math.floor((width - spacing.lg * 2 - spacing.md * 2 - spacing.sm) / 2);

  return (
    <View testID="pack-results" style={{ gap: spacing.md }}>
      {done && pack.similarity != null ? (
        <SimilarityGauge percent={pack.similarity} tint={tint} />
      ) : null}
      {done ? null : (
        <Notice
          testID="pack-waiting"
          icon={Hourglass}
          message={t('games.waitingFor', { name: faces.partner.name })}
        />
      )}
      {pack.items.map((item, index) => (
        <View
          key={item.id}
          testID={`result-${item.id}`}
          style={[
            styles.result,
            {
              backgroundColor: colors.surface,
              borderRadius: radii.xl,
              padding: spacing.md,
              gap: spacing.md,
              borderColor: colors.border,
            },
          ]}
        >
          <Text variant="label">{`${index + 1}. ${item.text || t('games.rather')}`}</Text>
          {pack.mode === 'choice' ? (
            <ChoiceRow pack={pack} item={item} faces={faces} tint={tint} />
          ) : (
            <View
              style={[pack.mode === 'text' ? styles.stack : styles.columns, { gap: spacing.sm }]}
            >
              <Given answer={item.mine} face={faces.me} mode={pack.mode} width={half} />
              <Given answer={item.theirs} face={faces.partner} mode={pack.mode} width={half} />
            </View>
          )}
        </View>
      ))}
      {done ? (
        <Button
          testID="pack-talk"
          variant="ghost"
          icon={MessageCircleHeart}
          label={t('games.results.talk')}
          onPress={() => router.push('/us')}
        />
      ) : null}
      <Celebration play={done && (pack.similarity ?? 0) >= 70 ? pack.id : false} />
    </View>
  );
}

const styles = StyleSheet.create({
  gauge: { alignItems: 'center' },
  gaugeText: { position: 'absolute', bottom: 0, alignItems: 'center' },
  percent: { fontSize: 44, lineHeight: 50, fontWeight: '800', fontVariant: ['tabular-nums'] },
  center: { textAlign: 'center' },
  result: { borderWidth: StyleSheet.hairlineWidth, borderCurve: 'continuous' },
  columns: { flexDirection: 'row', flexWrap: 'wrap' },
  stack: { flexDirection: 'column' },
  column: { flex: 1, alignItems: 'center', minHeight: 64 },
  optionArt: { width: 36, height: 36 },
  faces: { flexDirection: 'row', minHeight: 32 },
  overlap: { marginLeft: -6 },
  skippedNote: { width: '100%', textAlign: 'center' },
  given: {},
  row: { flexDirection: 'row', alignItems: 'center' },
});
