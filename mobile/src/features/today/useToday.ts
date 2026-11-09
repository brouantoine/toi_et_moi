import { useQuery } from '@tanstack/react-query';

import { api, unwrap } from '@/api';

import { agendaRange } from '../organize/agenda/agendaDates';

/** "N years ago today": memories of the same day, in the person's time zone. */
export function useOnThisDay() {
  return useQuery({
    queryKey: ['memories', 'on-this-day'],
    queryFn: async () => unwrap(await api.GET('/api/v1/memories/on-this-day/')),
  });
}

/** The next calendar moment within the coming weeks. */
export function useNextMoment() {
  const { start, end } = agendaRange();
  return useQuery({
    queryKey: ['events', 'occurrences', start, end],
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/events/occurrences/', { params: { query: { start, end } } })),
    select: (items) => items[0] ?? null,
  });
}
