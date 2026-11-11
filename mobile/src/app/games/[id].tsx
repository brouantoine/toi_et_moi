import { useLocalSearchParams } from 'expo-router';

import { PlayScreen } from '@/features/games/PlayScreen';

export default function PackRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlayScreen packId={String(id)} />;
}
