import { useLocalSearchParams } from 'expo-router';

import { ListScreen } from '@/features/organize/lists/ListScreen';

export default function ListRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ListScreen listId={Number(id)} />;
}
