import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Check, ImageOff, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api';
import { pickImages } from '@/media/images';
import {
  Button,
  Chip,
  DateField,
  ErrorState,
  IconButton,
  Input,
  LoadingState,
  Notice,
  Text,
  useSurfaceStyle,
  useTheme,
} from '@/ui';

import { MAX_PHOTOS, emptyMemoryForm, formFromMemory, memorySchema } from './memoryForm';
import type { MemoryFormValues } from './memoryForm';
import { MEMORY_TYPE_ICONS } from './memoryTypes';
import { PhotoStrip, type StripPhoto } from './PhotoStrip';
import { TagField } from './TagField';
import { MEMORY_TYPES, useMemory, type Memory } from './useMemories';
import { useSaveMemory, type DraftPhoto } from './useSaveMemory';

type Props = { memoryId?: number };

let draftSeq = 0;
const nextDraftId = () => `draft-${Date.now()}-${(draftSeq += 1)}`;

export function MemoryFormScreen({ memoryId }: Props) {
  const existing = useMemory(memoryId);
  if (memoryId !== undefined && existing.isPending) {
    return <LoadingState testID="memory-form-loading" />;
  }
  if (memoryId !== undefined && existing.isError) {
    return (
      <ErrorState
        testID="memory-form-error"
        code={existing.error instanceof ApiError ? existing.error.code : 'network'}
        onRetry={() => void existing.refetch()}
      />
    );
  }
  return <MemoryForm initial={existing.data} />;
}

function MemoryForm({ initial }: { initial?: Memory }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, radii, spacing, typography } = useTheme();
  const paper = useSurfaceStyle();
  const save = useSaveMemory();

  const [memoryId, setMemoryId] = useState(initial?.id);
  const [savedPhotos, setSavedPhotos] = useState(initial?.photos ?? []);
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [drafts, setDrafts] = useState<DraftPhoto[]>([]);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<'denied' | 'pickerError' | 'saveError' | null>(null);

  const { control, handleSubmit, formState, reset } = useForm<MemoryFormValues>({
    resolver: zodResolver(memorySchema),
    defaultValues: initial ? formFromMemory(initial) : emptyMemoryForm(),
  });

  useEffect(() => {
    if (initial) reset(formFromMemory(initial));
  }, [initial, reset]);

  const visibleSaved = savedPhotos.filter((p) => !removedIds.includes(p.id));
  const photos: StripPhoto[] = [
    ...visibleSaved.map((p) => ({ key: `saved-${p.id}`, uri: p.thumbnail_url ?? p.url ?? '' })),
    ...drafts.map((d) => ({
      key: d.localId,
      uri: d.image.uri,
      failed: failedIds.includes(d.localId),
    })),
  ];
  const dirty = formState.isDirty || drafts.length > 0 || removedIds.length > 0;
  const isEdit = initial !== undefined;

  const addPhotos = async () => {
    setNotice(null);
    try {
      const result = await pickImages(MAX_PHOTOS - photos.length);
      if (result.status === 'denied') setNotice('denied');
      if (result.status === 'picked') {
        setDrafts((current) => [
          ...current,
          ...result.images.map((image) => ({ localId: nextDraftId(), image })),
        ]);
      }
    } catch {
      setNotice('pickerError');
    }
  };

  const removePhoto = (key: string) => {
    if (key.startsWith('saved-')) {
      setRemovedIds((ids) => [...ids, Number(key.slice('saved-'.length))]);
    } else {
      setDrafts((current) => current.filter((d) => d.localId !== key));
      setFailedIds((ids) => ids.filter((id) => id !== key));
    }
  };

  const close = () => {
    if (!dirty || save.isPending) {
      router.back();
      return;
    }
    Alert.alert(t('memories.form.discardTitle'), t('memories.form.discardMessage'), [
      { text: t('memories.form.keepEditing'), style: 'cancel' },
      {
        text: t('memories.form.discardConfirm'),
        style: 'destructive',
        onPress: () => router.back(),
      },
    ]);
  };

  const submit = handleSubmit(async (values) => {
    setNotice(null);
    try {
      const { memory, failedPhotos } = await save.mutateAsync({
        id: memoryId,
        values,
        newPhotos: drafts,
        removedPhotoIds: removedIds,
      });
      if (failedPhotos.length) {
        // The memory exists now: stay here, in edit mode, to retry only the failed photos.
        setMemoryId(memory.id);
        setSavedPhotos(memory.photos);
        setRemovedIds([]);
        setDrafts(failedPhotos);
        setFailedIds(failedPhotos.map((p) => p.localId));
        reset(values);
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch {
      setNotice('saveError');
    }
  });

  const saveLabel = save.progress
    ? t('memories.form.uploading', save.progress)
    : failedIds.length
      ? t('memories.form.retryPhotos')
      : isEdit || memoryId !== undefined
        ? t('common.save')
        : t('memories.form.create');

  return (
    <SafeAreaView
      testID="memory-form"
      edges={['top', 'bottom']}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View style={[styles.topBar, { paddingHorizontal: spacing.md, gap: spacing.sm }]}>
        <IconButton
          testID="memory-form-close"
          icon={X}
          variant="plain"
          label={t('common.close')}
          onPress={close}
        />
        <Text variant="heading" style={styles.topTitle} numberOfLines={1}>
          {isEdit ? t('memories.form.editTitle') : t('memories.form.newTitle')}
        </Text>
        <View style={styles.topSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        >
          {notice === 'denied' ? (
            <Notice
              testID="memory-form-photos-denied"
              tone="warning"
              icon={ImageOff}
              message={t('memories.form.permissionDenied')}
              actionLabel={t('memories.form.openSettings')}
              onAction={() => void Linking.openSettings()}
            />
          ) : null}
          {notice === 'pickerError' ? (
            <Notice tone="warning" icon={ImageOff} message={t('memories.form.pickerError')} />
          ) : null}
          {notice === 'saveError' ? (
            <Notice
              testID="memory-form-save-error"
              tone="warning"
              message={t('memories.form.saveError')}
            />
          ) : null}
          {failedIds.length ? (
            <Notice
              testID="memory-form-partial"
              tone="warning"
              message={t('memories.form.partialFailure', { count: failedIds.length })}
            />
          ) : null}

          <PhotoStrip
            photos={photos}
            onAdd={() => void addPhotos()}
            onRemove={removePhoto}
            disabled={save.isPending}
          />

          {/* The journal page: title and story. */}
          <View
            style={[
              paper,
              styles.page,
              { borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm },
            ]}
          >
            <Controller
              control={control}
              name="title"
              render={({ field, fieldState }) => (
                <View style={{ gap: spacing.xs }}>
                  <TextInput
                    testID="memory-form-title"
                    accessibilityLabel={t('memories.form.titleLabel')}
                    placeholder={t('memories.form.titlePlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    maxLength={120}
                    multiline
                    submitBehavior="blurAndSubmit"
                    returnKeyType="next"
                    style={[typography.title, styles.bare, { color: colors.text }]}
                  />
                  {fieldState.error?.message ? (
                    <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
                      {t(fieldState.error.message)}
                    </Text>
                  ) : null}
                </View>
              )}
            />
            <View style={[styles.rule, { backgroundColor: colors.border }]} />
            <Controller
              control={control}
              name="body"
              render={({ field, fieldState }) => (
                <View style={{ gap: spacing.xs }}>
                  <TextInput
                    testID="memory-form-body"
                    accessibilityLabel={t('memories.form.bodyLabel')}
                    placeholder={t('memories.form.bodyPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    multiline
                    maxLength={5000}
                    textAlignVertical="top"
                    style={[typography.body, styles.bare, styles.body, { color: colors.text }]}
                  />
                  {fieldState.error?.message ? (
                    <Text variant="caption" color="danger">
                      {t(fieldState.error.message)}
                    </Text>
                  ) : null}
                </View>
              )}
            />
          </View>

          <View style={{ gap: spacing.md }}>
            <Text variant="overline" muted>
              {t('memories.form.details')}
            </Text>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <View style={{ gap: spacing.sm }}>
                  <Text variant="label">{t('memories.form.typeLabel')}</Text>
                  <View style={[styles.wrap, { gap: spacing.sm }]}>
                    {MEMORY_TYPES.map((type) => (
                      <Chip
                        key={type}
                        testID={`memory-form-type-${type}`}
                        label={t(`memories.types.${type}`)}
                        icon={MEMORY_TYPE_ICONS[type]}
                        selected={field.value === type}
                        onPress={() => field.onChange(type)}
                      />
                    ))}
                  </View>
                </View>
              )}
            />
            <Controller
              control={control}
              name="happened_on"
              render={({ field, fieldState }) => (
                <View style={{ gap: spacing.xs }}>
                  <DateField
                    testID="memory-form-date"
                    label={t('memories.form.dateLabel')}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? '')}
                    maximumDate={new Date()}
                  />
                  {fieldState.error?.message ? (
                    <Text variant="caption" color="danger">
                      {t(fieldState.error.message)}
                    </Text>
                  ) : null}
                </View>
              )}
            />
            <Controller
              control={control}
              name="place"
              render={({ field }) => (
                <Input
                  testID="memory-form-place"
                  label={t('memories.form.placeLabel')}
                  placeholder={t('memories.form.placePlaceholder')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  maxLength={200}
                />
              )}
            />
            <Controller
              control={control}
              name="tags"
              render={({ field }) => <TagField value={field.value} onChange={field.onChange} />}
            />
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.smd,
              paddingBottom: spacing.sm,
              borderTopColor: colors.border,
              backgroundColor: colors.background,
            },
          ]}
        >
          <Button
            testID="memory-form-save"
            size="lg"
            icon={save.isPending ? undefined : Check}
            label={saveLabel}
            loading={save.isPending && !save.progress}
            disabled={save.isPending}
            onPress={() => void submit()}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  topTitle: { flex: 1, textAlign: 'center' },
  topSpacer: { width: 48 },
  page: { borderCurve: 'continuous' },
  bare: { padding: 0, margin: 0 },
  body: { minHeight: 132 },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
});
