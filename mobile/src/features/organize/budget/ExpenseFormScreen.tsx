import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Check, Trash2, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, ApiError, unwrap } from '@/api';
import { useCouple } from '@/features/couple/useCouple';
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
  useTheme,
} from '@/ui';

import { useQueuedWrite } from '../agenda/useAgenda';
import { usePersonLabel } from '../usePersonLabel';
import { CATEGORY_HUES, CATEGORY_ICONS } from './categories';
import {
  emptyExpenseForm,
  expensePayload,
  expenseSchema,
  formFromExpense,
  type ExpenseFormValues,
} from './expenseForm';
import { EXPENSE_CATEGORIES, expensesKey, type Expense } from './useBudget';

export function ExpenseFormScreen({ expenseId }: { expenseId?: number }) {
  const existing = useQuery({
    queryKey: [...expensesKey, 'detail', expenseId ?? -1],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/expenses/{id}/', { params: { path: { id: expenseId as number } } }),
      ),
    enabled: expenseId !== undefined,
  });
  const couple = useCouple();
  if ((expenseId !== undefined && existing.isPending) || couple.isPending)
    return <LoadingState testID="expense-form-loading" />;
  if (expenseId !== undefined && existing.isError) {
    return (
      <ErrorState
        testID="expense-form-error"
        code={existing.error instanceof ApiError ? existing.error.code : 'network'}
        onRetry={() => void existing.refetch()}
      />
    );
  }
  const currency = existing.data?.currency ?? couple.data?.currency ?? 'EUR';
  return <ExpenseForm initial={existing.data} currency={currency} />;
}

function ExpenseForm({ initial, currency }: { initial?: Expense; currency: string }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors, hues, spacing } = useTheme();
  const person = usePersonLabel();
  const { write, isPending } = useQueuedWrite(expensesKey);
  const [failed, setFailed] = useState(false);
  const isEdit = initial !== undefined;
  const schema = useMemo(() => expenseSchema(currency), [currency]);
  const { control, handleSubmit } = useForm<ExpenseFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial ? formFromExpense(initial, i18n.language) : emptyExpenseForm(),
  });
  const split = useWatch({ control, name: 'split' });

  const submit = handleSubmit(async (values) => {
    setFailed(false);
    const body = expensePayload(values, currency);
    try {
      await (isEdit
        ? write({
            method: 'PATCH',
            path: '/api/v1/expenses/{id}/',
            pathParams: { id: initial.id },
            body,
          })
        : write({ method: 'POST', path: '/api/v1/expenses/', body }));
      router.back();
    } catch {
      setFailed(true);
    }
  });

  const remove = () =>
    Alert.alert(t('organize.budget.form.deleteTitle'), t('organize.budget.form.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('memories.detail.deleteConfirm'),
        style: 'destructive',
        onPress: () => {
          if (!initial) return;
          void write({
            method: 'DELETE',
            path: '/api/v1/expenses/{id}/',
            pathParams: { id: initial.id },
          })
            .then(() => router.back())
            .catch(() => setFailed(true));
        },
      },
    ]);

  const errorText = (message?: string) => (message ? t(message) : undefined);

  return (
    <SafeAreaView
      testID="expense-form"
      edges={['top', 'bottom']}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View style={[styles.topBar, { paddingHorizontal: spacing.md }]}>
        <IconButton
          testID="expense-form-close"
          icon={X}
          variant="plain"
          label={t('common.close')}
          onPress={() => router.back()}
        />
        <Text variant="heading" style={styles.topTitle} numberOfLines={1}>
          {isEdit ? t('organize.budget.form.editTitle') : t('organize.budget.form.newTitle')}
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
          {failed ? (
            <Notice
              testID="expense-form-save-error"
              tone="warning"
              message={t('organize.budget.form.saveError')}
            />
          ) : null}
          <Controller
            control={control}
            name="title"
            render={({ field, fieldState }) => (
              <Input
                testID="expense-form-title"
                label={t('organize.budget.form.titleLabel')}
                placeholder={t('organize.budget.form.titlePlaceholder')}
                value={field.value}
                onChangeText={field.onChange}
                maxLength={120}
                error={errorText(fieldState.error?.message)}
              />
            )}
          />
          <Controller
            control={control}
            name="amount"
            render={({ field, fieldState }) => (
              <Input
                testID="expense-form-amount"
                label={t('organize.budget.form.amountLabel', { currency })}
                keyboardType="decimal-pad"
                placeholder="0,00"
                value={field.value}
                onChangeText={field.onChange}
                error={errorText(fieldState.error?.message)}
              />
            )}
          />
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <View style={{ gap: spacing.sm }}>
                <Text variant="label">{t('organize.budget.form.categoryLabel')}</Text>
                <View style={[styles.wrap, { gap: spacing.sm }]}>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <Chip
                      key={c}
                      testID={`expense-form-category-${c}`}
                      label={t(`organize.budget.categories.${c}`)}
                      icon={CATEGORY_ICONS[c]}
                      tint={hues[CATEGORY_HUES[c]].fg}
                      selected={field.value === c}
                      onPress={() => field.onChange(c)}
                    />
                  ))}
                </View>
              </View>
            )}
          />
          <Controller
            control={control}
            name="paidBy"
            render={({ field }) => (
              <View style={{ gap: spacing.sm }}>
                <Text variant="label">{t('organize.budget.form.paidByLabel')}</Text>
                <View style={[styles.wrap, { gap: spacing.sm }]}>
                  {(['me', 'you'] as const).map((who) => (
                    <Chip
                      key={who}
                      testID={`expense-form-paid-${who}`}
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
            name="split"
            render={({ field }) => (
              <View style={{ gap: spacing.sm }}>
                <Text variant="label">{t('organize.budget.form.splitLabel')}</Text>
                <View style={[styles.wrap, { gap: spacing.sm }]}>
                  {(['equal', 'custom'] as const).map((s) => (
                    <Chip
                      key={s}
                      testID={`expense-form-split-${s}`}
                      label={t(`organize.budget.form.${s}`)}
                      selected={field.value === s}
                      onPress={() => field.onChange(s)}
                    />
                  ))}
                </View>
              </View>
            )}
          />
          {split === 'custom' ? (
            <Controller
              control={control}
              name="myShare"
              render={({ field, fieldState }) => (
                <Input
                  testID="expense-form-my-share"
                  label={t('organize.budget.form.myShareLabel', { currency })}
                  keyboardType="decimal-pad"
                  value={field.value}
                  onChangeText={field.onChange}
                  error={errorText(fieldState.error?.message)}
                />
              )}
            />
          ) : null}
          <Controller
            control={control}
            name="date"
            render={({ field }) => (
              <DateField
                testID="expense-form-date"
                label={t('organize.budget.form.dateLabel')}
                value={field.value}
                onChange={(v) => field.onChange(v ?? field.value)}
                maximumDate={new Date()}
              />
            )}
          />
          {isEdit ? (
            <Button
              testID="expense-form-delete"
              variant="ghost"
              icon={Trash2}
              label={t('organize.budget.form.delete')}
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
            testID="expense-form-save"
            size="lg"
            icon={isPending ? undefined : Check}
            label={isEdit ? t('organize.budget.form.save') : t('organize.budget.form.create')}
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
