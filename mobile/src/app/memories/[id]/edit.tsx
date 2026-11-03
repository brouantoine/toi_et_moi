import { useLocalSearchParams } from 'expo-router';

import { MemoryFormScreen } from '@/features/memories/MemoryFormScreen';

export default function EditMemoryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MemoryFormScreen memoryId={Number(id)} />;
}
