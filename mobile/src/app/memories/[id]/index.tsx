import { useLocalSearchParams } from 'expo-router';

import { MemoryDetailScreen } from '@/features/memories/MemoryDetailScreen';

export default function MemoryDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MemoryDetailScreen memoryId={Number(id)} />;
}
