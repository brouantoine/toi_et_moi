import { useInfiniteQuery } from '@tanstack/react-query';

import { api, unwrap, type Schemas } from '@/api';
import { cursorFrom, flattenPages } from '@/api/pagination';

export type Memory = Schemas['Memory'];
export type MemoryType = Schemas['MemoryTypeEnum'];
export const MEMORY_TYPES: readonly MemoryType[] = [
  'moment',
  'first_time',
  'place',
  'inside_joke',
  'quote',
];

export type MemoryFilters = { type?: MemoryType; q?: string };

export const memoriesKey = (filters: MemoryFilters = {}) => ['memories', 'list', filters] as const;

export function useMemories(filters: MemoryFilters) {
  const query = useInfiniteQuery({
    queryKey: memoriesKey(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET('/api/v1/memories/', {
          params: {
            query: {
              cursor: pageParam,
              type: filters.type,
              q: filters.q?.trim() || undefined,
            },
          },
        }),
      ),
    getNextPageParam: (lastPage) => cursorFrom(lastPage.next),
  });
  return { ...query, memories: flattenPages(query.data?.pages) };
}
