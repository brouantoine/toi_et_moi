import { useRouter } from 'expo-router';
import { HandCoins, Plus, Wallet } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api';
import {
  Button,
  EmptyState,
  ErrorState,
  fromIsoDate,
  Icon,
  PressableScale,
  Skeleton,
  Text,
  useSurfaceStyle,
  useTheme,
} from '@/ui';

import { useQueuedWrite } from '../agenda/useAgenda';
import { usePersonLabel } from '../usePersonLabel';
import { CATEGORY_HUES, CATEGORY_ICONS } from './categories';
import { formatMoney } from './money';
import { expensesKey, useBalance, useExpenses, type Balance, type Expense } from './useBudget';

function BalanceCard({ balance }: { balance: Balance }) {
  const { t, i18n } = useTranslation();
  const { colors, radii, spacing } = useTheme();
  const person = usePersonLabel();
  const { write, isPending, error } = useQueuedWrite(expensesKey);
  const amount = formatMoney(balance.amount, balance.currency, i18n.language);
  const name = person('you');
  const text =
    balance.direction === 'partner_owes_me'
      ? t('organize.budget.partnerOwes', { name, amount })
      : balance.direction === 'i_owe_partner'
        ? t('organize.budget.iOwe', { name, amount })
        : t('organize.budget.settled');
  const settle = () =>
    Alert.alert(t('organize.budget.settleTitle', { amount }), t('organize.budget.settleMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('organize.budget.settle'),
        onPress: () =>
          // A refusal is shown under the button (see `error`), never left unhandled.
          void write({
            method: 'POST',
            path: '/api/v1/expenses/settle/',
            body: { currency: balance.currency },
          }).catch(() => {}),
      },
    ]);
  return (
    <View
      testID={`balance-${balance.currency}`}
      accessibilityRole="summary"
      style={[
        styles.balance,
        {
          backgroundColor: colors.primarySoft,
          borderRadius: radii.lg,
          padding: spacing.lg,
          gap: spacing.md,
        },
      ]}
    >
      <View style={[styles.row, { gap: spacing.smd }]}>
        <Icon icon={HandCoins} size={24} color="onPrimarySoft" />
        <Text variant="heading" color="onPrimarySoft" style={styles.flex}>
          {text}
        </Text>
      </View>
      {balance.direction === 'settled' ? null : (
        <Button
          testID={`settle-${balance.currency}`}
          label={t('organize.budget.settle')}
          loading={isPending}
          onPress={settle}
        />
      )}
      {error ? (
        <Text variant="caption" color="onPrimarySoft" testID={`settle-error-${balance.currency}`}>
          {t('organize.budget.settleError')}
        </Text>
      ) : null}
    </View>
  );
}

function ExpenseRow({ expense }: { expense: Expense }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { hues, radii, spacing } = useTheme();
  const surface = useSurfaceStyle();
  const person = usePersonLabel();
  const category = expense.category ?? 'other';
  const hue = hues[CATEGORY_HUES[category]];
  const amount = formatMoney(expense.amount, expense.currency ?? 'EUR', i18n.language);
  const myShare = formatMoney(expense.my_share ?? 0, expense.currency ?? 'EUR', i18n.language);
  const date = expense.spent_on
    ? new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' }).format(
        fromIsoDate(expense.spent_on),
      )
    : '';
  const payer = t('organize.budget.paidBy', { name: person(expense.paid_by ?? 'me') });
  return (
    <PressableScale
      testID={`expense-${expense.id}`}
      accessibilityRole="button"
      accessibilityLabel={[expense.title, amount, payer, date].filter(Boolean).join(', ')}
      onPress={() => router.push(`/organize/expense/${expense.id}`)}
      style={[
        surface,
        styles.row,
        { borderRadius: radii.lg, padding: spacing.md, gap: spacing.md },
      ]}
    >
      <View style={[styles.badge, { backgroundColor: hue.bg, borderRadius: radii.md }]}>
        <Icon icon={CATEGORY_ICONS[category]} size={20} tint={hue.fg} strokeWidth={2} />
      </View>
      <View style={styles.flex}>
        <Text variant="label" numberOfLines={1}>
          {expense.title}
        </Text>
        <Text variant="caption" muted numberOfLines={1}>
          {date ? `${date} · ${payer}` : payer}
        </Text>
      </View>
      <View style={styles.amount}>
        <Text variant="label">{amount}</Text>
        <Text variant="caption" muted>
          {t('organize.budget.myShare', { amount: myShare })}
        </Text>
      </View>
    </PressableScale>
  );
}

export function BudgetView() {
  const { t } = useTranslation();
  const router = useRouter();
  const { radii, spacing } = useTheme();
  const list = useExpenses();
  const balance = useBalance();

  if (list.isPending) {
    return (
      <View testID="budget-loading" style={{ padding: spacing.lg, gap: spacing.md }}>
        <Skeleton height={110} radius={radii.lg} />
        <Skeleton height={68} radius={radii.lg} />
      </View>
    );
  }
  if (list.isError && list.expenses.length === 0) {
    return (
      <ErrorState
        testID="budget-error"
        code={list.error instanceof ApiError ? list.error.code : 'network'}
        onRetry={() => void list.refetch()}
      />
    );
  }
  return (
    <FlatList
      testID="budget-list"
      data={list.expenses}
      keyExtractor={(e) => String(e.id)}
      contentContainerStyle={{
        padding: spacing.lg,
        paddingTop: spacing.sm,
        gap: spacing.sm,
        flexGrow: 1,
      }}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
      }}
      ListHeaderComponent={
        <View style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
          {(balance.data ?? []).map((b) => (
            <BalanceCard key={b.currency} balance={b} />
          ))}
          <Button
            testID="budget-add"
            variant="soft"
            icon={Plus}
            label={t('organize.budget.add')}
            onPress={() => router.push('/organize/expense/new')}
          />
        </View>
      }
      renderItem={({ item }) => <ExpenseRow expense={item} />}
      ListEmptyComponent={
        <EmptyState
          testID="budget-empty"
          icon={Wallet}
          title={t('organize.budget.emptyTitle')}
          message={t('organize.budget.emptyMessage')}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  balance: { borderCurve: 'continuous' },
  row: { flexDirection: 'row', alignItems: 'center', borderCurve: 'continuous' },
  badge: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  amount: { alignItems: 'flex-end' },
});
