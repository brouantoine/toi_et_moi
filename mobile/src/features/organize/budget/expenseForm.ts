import { z } from 'zod';

import { toIsoDate } from '@/ui';

import { amountText, parseAmount } from './money';
import type { Expense, ExpenseCategory } from './useBudget';

export function expenseSchema(currency: string) {
  return z
    .object({
      title: z.string().trim().min(1, 'organize.budget.form.errors.titleRequired').max(120),
      amount: z.string(),
      category: z.enum(['groceries', 'home', 'outings', 'travel', 'gifts', 'health', 'other']),
      paidBy: z.enum(['me', 'you']),
      split: z.enum(['equal', 'custom']),
      myShare: z.string(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .superRefine((values, ctx) => {
      const amount = parseAmount(values.amount, currency);
      if (amount === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['amount'],
          message: 'organize.budget.form.errors.amountInvalid',
        });
        return;
      }
      if (values.split === 'custom') {
        const share = parseAmount(values.myShare, currency, true);
        if (share === null || share > amount) {
          ctx.addIssue({
            code: 'custom',
            path: ['myShare'],
            message: 'organize.budget.form.errors.shareInvalid',
          });
        }
      }
    });
}

export type ExpenseFormValues = z.infer<ReturnType<typeof expenseSchema>>;

export function emptyExpenseForm(today: Date = new Date()): ExpenseFormValues {
  return {
    title: '',
    amount: '',
    category: 'groceries',
    paidBy: 'me',
    split: 'equal',
    myShare: '',
    date: toIsoDate(today),
  };
}

export function formFromExpense(expense: Expense, locale: string): ExpenseFormValues {
  const currency = expense.currency ?? 'EUR';
  return {
    title: expense.title,
    amount: amountText(expense.amount, currency, locale),
    category: (expense.category ?? 'other') as ExpenseCategory,
    paidBy: expense.paid_by ?? 'me',
    split: expense.split ?? 'equal',
    myShare: amountText(expense.my_share ?? 0, currency, locale),
    date: expense.spent_on ?? toIsoDate(new Date()),
  };
}

export function expensePayload(values: ExpenseFormValues, currency: string) {
  const amount = parseAmount(values.amount, currency) ?? 0;
  const base = {
    title: values.title.trim(),
    amount,
    currency,
    category: values.category,
    paid_by: values.paidBy,
    split: values.split,
    spent_on: values.date,
  };
  if (values.split === 'equal') return base;
  const share = parseAmount(values.myShare, currency, true) ?? 0;
  return { ...base, my_share: share };
}
