import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Check, Trash2, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api';
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
  TimeField,
  ToggleRow,
  useTheme,
} from '@/ui';

import { usePersonLabel } from '../usePersonLabel';
import {
  emptyEventForm,
  eventPayload,
  eventSchema,
  formFromEvent,
  REMINDERS,
  type EventFormValues,
} from './eventForm';
import { EVENT_KIND_HUES, EVENT_KIND_ICONS } from './eventKinds';
import { EVENT_KINDS, eventsKey, useEvent, useQueuedWrite, type AgendaEvent } from './useAgenda';

export function EventFormScreen({ eventId }: { eventId?: number }) {
  const existing = useEvent(eventId);
  if (eventId !== undefined && existing.isPending)
    return <LoadingState testID="event-form-loading" />;
  if (eventId !== undefined && existing.isError) {
    return (
      <ErrorState
        testID="event-form-error"
        code={existing.error instanceof ApiError ? existing.error.code : 'network'}
        onRetry={() => void existing.refetch()}
      />
    );
  }
  return <EventForm initial={existing.data} />;
}

function EventForm({ initial }: { initial?: AgendaEvent }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, hues, spacing } = useTheme();
  const person = usePersonLabel();
  const { write, isPending } = useQueuedWrite(eventsKey);
  const [notice, setNotice] = useState<'error' | null>(null);
  const isEdit = initial !== undefined;

  const { control, handleSubmit, reset } = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: initial ? formFromEvent(initial) : emptyEventForm(),
  });
  useEffect(() => {
    if (initial) reset(formFromEvent(initial));
  }, [initial, reset]);
  const allDay = useWatch({ control, name: 'allDay' });

  const submit = handleSubmit(async (values) => {
    setNotice(null);
    try {
      const body = eventPayload(values);
      // Offline, the write is queued (see the offline banner on the Organize tab).
      await (isEdit
        ? await write({
            method: 'PATCH',
            path: '/api/v1/events/{id}/',
            pathParams: { id: initial.id },
            body,
          })
        : write({ method: 'POST', path: '/api/v1/events/', body }));
      router.back();
    } catch {
      setNotice('error');
    }
  });

  const remove = () =>
    Alert.alert(t('organize.event.deleteTitle'), t('organize.event.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('memories.detail.deleteConfirm'),
        style: 'destructive',
        onPress: () => {
          if (!initial) return;
          void write({
            method: 'DELETE',
            path: '/api/v1/events/{id}/',
            pathParams: { id: initial.id },
          })
            .then(() => router.back())
            .catch(() => setNotice('error'));
        },
      },
    ]);

  return (
    <SafeAreaView
      testID="event-form"
      edges={['top', 'bottom']}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View style={[styles.topBar, { paddingHorizontal: spacing.md }]}>
        <IconButton
          testID="event-form-close"
          icon={X}
          variant="plain"
          label={t('common.close')}
          onPress={() => router.back()}
        />
        <Text variant="heading" style={styles.topTitle} numberOfLines={1}>
          {isEdit ? t('organize.event.editTitle') : t('organize.event.newTitle')}
        </Text>
        <View style={styles.spacer} />
      </View>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        >
          {notice === 'error' ? (
            <Notice
              testID="event-form-save-error"
              tone="warning"
              message={t('organize.event.saveError')}
            />
          ) : null}
          <Controller
            control={control}
            name="title"
            render={({ field, fieldState }) => (
              <Input
                testID="event-form-title"
                label={t('organize.event.titleLabel')}
                placeholder={t('organize.event.titlePlaceholder')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                maxLength={120}
                error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
              />
            )}
          />
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <View style={{ gap: spacing.sm }}>
                <Text variant="label">{t('organize.event.kindLabel')}</Text>
                <View style={[styles.wrap, { gap: spacing.sm }]}>
                  {EVENT_KINDS.map((kind) => (
                    <Chip
                      key={kind}
                      testID={`event-form-kind-${kind}`}
                      label={t(`organize.agenda.kinds.${kind}`)}
                      icon={EVENT_KIND_ICONS[kind]}
                      tint={hues[EVENT_KIND_HUES[kind]].fg}
                      selected={field.value === kind}
                      onPress={() => field.onChange(kind)}
                    />
                  ))}
                </View>
              </View>
            )}
          />
          <Controller
            control={control}
            name="date"
            render={({ field }) => (
              <DateField
                testID="event-form-date"
                label={t('organize.event.dateLabel')}
                value={field.value}
                onChange={(v) => field.onChange(v ?? field.value)}
              />
            )}
          />
          <Controller
            control={control}
            name="allDay"
            render={({ field }) => (
              <ToggleRow
                testID="event-form-all-day"
                label={t('organize.event.allDay')}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          {allDay ? null : (
            <Controller
              control={control}
              name="time"
              render={({ field }) => (
                <TimeField
                  testID="event-form-time"
                  label={t('organize.event.timeLabel')}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          )}
          <Controller
            control={control}
            name="place"
            render={({ field }) => (
              <Input
                testID="event-form-place"
                label={t('organize.event.placeLabel')}
                placeholder={t('organize.event.placePlaceholder')}
                value={field.value}
                onChangeText={field.onChange}
                maxLength={200}
              />
            )}
          />
          <Controller
            control={control}
            name="concerns"
            render={({ field }) => (
              <View style={{ gap: spacing.sm }}>
                <Text variant="label">{t('organize.event.concernsLabel')}</Text>
                <View style={[styles.wrap, { gap: spacing.sm }]}>
                  {(['us', 'me', 'you'] as const).map((who) => (
                    <Chip
                      key={who}
                      testID={`event-form-concerns-${who}`}
                      label={person(who)}
                      selected={field.value === who}
                      onPress={() => field.onChange(who)}
                    />
                  ))}
                </View>
              </View>
            )}
          />
          <Controller
            control={control}
            name="yearly"
            render={({ field }) => (
              <ToggleRow
                testID="event-form-yearly"
                label={t('organize.event.yearly')}
                hint={t('organize.event.yearlyHint')}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="reminder"
            render={({ field }) => (
              <View style={{ gap: spacing.sm }}>
                <Text variant="label">{t('organize.event.reminderLabel')}</Text>
                <View style={[styles.wrap, { gap: spacing.sm }]}>
                  {REMINDERS.map((r) => (
                    <Chip
                      key={r}
                      testID={`event-form-reminder-${r}`}
                      label={t(`organize.event.reminders.${r}`)}
                      selected={field.value === r}
                      onPress={() => field.onChange(r)}
                    />
                  ))}
                </View>
              </View>
            )}
          />
          {isEdit ? (
            <Button
              testID="event-form-delete"
              variant="ghost"
              icon={Trash2}
              label={t('organize.event.delete')}
              onPress={remove}
            />
          ) : null}
        </ScrollView>
        <View
          style={[
            styles.footer,
            { padding: spacing.lg, paddingTop: spacing.smd, borderTopColor: colors.border },
          ]}
        >
          <Button
            testID="event-form-save"
            size="lg"
            icon={isPending ? undefined : Check}
            label={isEdit ? t('organize.event.save') : t('organize.event.create')}
            loading={isPending}
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
  spacer: { width: 48 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
});
