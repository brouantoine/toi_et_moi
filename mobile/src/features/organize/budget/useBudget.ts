import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { api, unwrap, type Schemas } from '@/api';
import { cursorFrom, flattenPages } from '@/api/pagination';

export type Expense = Schemas['Expense'];
export type Balance = Schemas['Balance'];
export type ExpenseCategory = Schemas['ExpenseCategoryEnum'];
export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  'groceries',
  'home',
  'outings',
  'travel',
  'gifts',
  'health',
  'other',
];

export const expensesKey = ['expenses'] as const;

export function useExpenses() {
  const query = useInfiniteQuery({
    queryKey: [...expensesKey, 'list'],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      unwrap(await api.GET('/api/v1/expenses/', { params: { query: { cursor: pageParam } } })),
    getNextPageParam: (last) => cursorFrom(last.next),
  });
  return { ...query, expenses: flattenPages(query.data?.pages) };
}

export function useBalance() {
  return useQuery({
    queryKey: [...expensesKey, 'balance'],
    queryFn: async () => unwrap(await api.GET('/api/v1/expenses/balance/')),
  });
}
