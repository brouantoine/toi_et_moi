import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { ImagePlus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api';
import { pickImages, type LocalImage } from '@/media/images';
import {
  Avatar,
  BackButton,
  Button,
  ErrorState,
  FadeIn,
  Input,
  LoadingState,
  Notice,
  PressableScale,
  Text,
  useTheme,
  type HueColors,
} from '@/ui';

import { packHue } from './art';
import { DrawingCanvas } from './Drawing';
import { TagBadges, useCoupleFaces, type Face } from './PackCard';
import { Results } from './Results';
import {
  useAnswer,
  usePack,
  type AnswerInput,
  type PackDetail,
  type PackItem,
  type Stroke,
} from './useGames';

type StepProps = {
  pack: PackDetail;
  item: PackItem;
  tint: HueColors;
  faces: { me: Face; partner: Face };
  busy: boolean;
  send: (input: Omit<AnswerInput, 'question'>) => void;
};

/** Two big choices, one above the other, with "or" between them. */
function ChoiceStep({ pack, item, tint, faces, busy, send }: StepProps) {
  const { t } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  const choose = (choice: number) => {
    void Haptics.selectionAsync().catch(() => {});
    send({ choice });
  };
  return (
    <View style={{ gap: spacing.sm }}>
      {item.options.map((option, index) => {
        const face = pack.kind === 'most_likely' ? (index === 0 ? faces.me : faces.partner) : null;
        const label = face ? face.name : option.name;
        return (
          <View key={index}>
            {index === 1 ? (
              <View style={styles.orWrap} pointerEvents="none">
                <View
                  style={[styles.or, { backgroundColor: colors.background, borderColor: tint.bg }]}
                >
                  <Text variant="caption" style={[styles.bold, { color: tint.fg }]}>
                    {t('games.or')}
                  </Text>
                </View>
              </View>
            ) : null}
            <PressableScale
              testID={`option-${index}`}
              accessibilityRole="button"
              accessibilityLabel={label}
              disabled={busy}
              onPress={() => choose(index)}
              style={[
                styles.option,
                {
                  backgroundColor: tint.bg,
                  borderRadius: radii.xl,
                  padding: spacing.lg,
                  gap: spacing.smd,
                },
              ]}
            >
              {face ? (
                <Avatar name={face.name} uri={face.uri} preset={face.preset} size={64} ring />
              ) : null}
              {option.art ? (
                <Image
                  source={{ uri: option.art }}
                  style={styles.optionArt}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              ) : null}
              <Text variant="heading" style={[styles.center, { color: tint.fg }]}>
                {label}
              </Text>
            </PressableScale>
          </View>
        );
      })}
    </View>
  );
}

function TextStep({ busy, send }: StepProps) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const [text, setText] = useState('');
  return (
    <View style={{ gap: spacing.md }}>
      <Input
        testID="answer-text"
        label={t('games.answerLabel')}
        placeholder={t('games.answerPlaceholder')}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={600}
      />
      <Button
        testID="answer-send"
        size="lg"
        label={t('games.send')}
        disabled={!text.trim()}
        loading={busy}
        onPress={() => send({ text: text.trim() })}
      />
    </View>
  );
}

function DrawStep({ busy, send }: StepProps) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  return (
    <View style={{ gap: spacing.md }}>
      <DrawingCanvas strokes={strokes} onChange={setStrokes} />
      <Button
        testID="answer-send"
        size="lg"
        label={t('games.draw.send')}
        disabled={strokes.length === 0}
        loading={busy}
        onPress={() => send({ drawing: strokes })}
      />
    </View>
  );
}

function PhotoStep({ busy, send }: StepProps) {
  const { t } = useTranslation();
  const { radii, spacing } = useTheme();
  const [photo, setPhoto] = useState<LocalImage | null>(null);
  const [denied, setDenied] = useState(false);
  const pick = async () => {
    const result = await pickImages(1).catch(() => null);
    if (result?.status === 'denied') setDenied(true);
    if (result?.status === 'picked' && result.images[0]) setPhoto(result.images[0]);
  };
  return (
    <View style={{ gap: spacing.md }}>
      {photo ? (
        <Image
          testID="answer-photo-preview"
          source={{ uri: photo.uri }}
          style={[styles.preview, { borderRadius: radii.xl }]}
          contentFit="cover"
        />
      ) : null}
      {denied ? <Notice tone="warning" message={t('games.photo.denied')} /> : null}
      <Button
        testID="answer-pick"
        variant={photo ? 'ghost' : 'primary'}
        size="lg"
        icon={ImagePlus}
        label={t(photo ? 'games.photo.change' : 'games.photo.pick')}
        onPress={() => void pick()}
      />
      {photo ? (
        <Button
          testID="answer-send"
          size="lg"
          label={t('games.photo.send')}
          loading={busy}
          onPress={() => send({ photo })}
        />
      ) : null}
    </View>
  );
}

const STEPS = { choice: ChoiceStep, text: TextStep, drawing: DrawStep, photo: PhotoStep } as const;

/** Play a pack item by item, then discover the results together. */
export function PlayScreen({ packId }: { packId: string }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, hues, spacing } = useTheme();
  const faces = useCoupleFaces();
  const query = usePack(packId);
  const answer = useAnswer(packId);
  const pack = query.data;

  const close = (
    <View
      style={[styles.close, { paddingTop: insets.top + spacing.xs, paddingHorizontal: spacing.md }]}
    >
      <BackButton testID="pack-close" />
    </View>
  );

  if (query.isPending) return <LoadingState testID="pack-loading" />;
  if (query.isError || !pack) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {close}
        <ErrorState
          testID="pack-load-error"
          code={query.error instanceof ApiError ? query.error.code : 'not_found'}
          onRetry={() => void query.refetch()}
        />
      </View>
    );
  }

  const hue = packHue(pack);
  const tint = hues[hue];
  const index = pack.items.findIndex((item) => item.mine === null);
  const item = index >= 0 ? pack.items[index] : undefined;
  const Step = STEPS[pack.mode];
  const send = (input: Omit<AnswerInput, 'question'>) => {
    if (item) answer.mutate({ question: item.id, ...input });
  };

  return (
    <KeyboardAvoidingView
      testID="pack-screen"
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {close}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        scrollEnabled={pack.mode !== 'drawing' || !item}
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
        }}
      >
        <View style={[styles.head, { gap: spacing.sm }]}>
          <Image
            source={{ uri: pack.art }}
            style={styles.art}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
          <View style={[styles.row, { gap: spacing.xs }]}>
            <TagBadges pack={pack} hue={hue} />
            <Text variant="overline" style={{ color: tint.fg }}>
              {item ? `${pack.kind_name} · ${index + 1} / ${pack.total}` : pack.kind_name}
            </Text>
          </View>
          <Text variant="title" style={styles.center} testID="pack-title">
            {item ? item.text || pack.kind_name : pack.title}
          </Text>
          {item && item.partner_answered ? (
            <Text variant="caption" muted style={styles.center} testID="partner-answered">
              {t('games.partnerAnswered', { name: faces.partner.name })}
            </Text>
          ) : null}
        </View>
        {item ? (
          <FadeIn key={item.id}>
            <View style={{ gap: spacing.md }}>
              <Step
                pack={pack}
                item={item}
                tint={tint}
                faces={faces}
                busy={answer.isPending}
                send={send}
              />
              {answer.isError ? (
                <Notice testID="answer-error" tone="warning" message={t('games.sendError')} />
              ) : null}
              <Button
                testID="answer-skip"
                variant="ghost"
                label={t('games.skip')}
                disabled={answer.isPending}
                onPress={() => send({ skipped: true })}
              />
            </View>
          </FadeIn>
        ) : (
          <Results pack={pack} faces={faces} tint={tint} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  close: { flexDirection: 'row', justifyContent: 'flex-start' },
  head: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
  art: { width: 88, height: 88 },
  center: { textAlign: 'center' },
  bold: { fontWeight: '800' },
  option: {
    borderCurve: 'continuous',
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionArt: { width: 56, height: 56 },
  orWrap: { position: 'absolute', top: -26, left: 0, right: 0, alignItems: 'center', zIndex: 1 },
  or: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: { width: '100%', aspectRatio: 1 },
});
