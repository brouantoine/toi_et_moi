import { useLocalSearchParams } from 'expo-router';

import { QuestionScreen } from '@/features/games/QuestionScreen';

export default function QuestionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <QuestionScreen questionId={String(id)} />;
}
