import { useLocalSearchParams } from 'expo-router';

import { ExpenseFormScreen } from '@/features/organize/budget/ExpenseFormScreen';

export default function EditExpenseRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ExpenseFormScreen expenseId={Number(id)} />;
}
