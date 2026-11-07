import { useLocalSearchParams } from 'expo-router';

import { EventFormScreen } from '@/features/organize/agenda/EventFormScreen';

export default function EditEventRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EventFormScreen eventId={Number(id)} />;
}
