import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, unwrap, type Schemas } from '@/api';

import { memoryKey, type Memory } from './useMemories';

export type MemoryComment = Schemas['MemoryComment'];
export const MAX_COMMENT_LENGTH = 500;

export const commentsKey = (memoryId: number) => ['memories', 'comments', memoryId] as const;

const listsOnly = {
  queryKey: ['memories'],
  predicate: (q: { queryKey: readonly unknown[] }) => q.queryKey[1] === 'list',
};

/** One soft heart, no counter. Optimistic: the heart fills instantly, rolls back on error. */
export function useToggleHeart(memoryId: number) {
  const client = useQueryClient();
  const key = memoryKey(memoryId);
  return useMutation({
    mutationFn: async (on: boolean) => {
      const params = { path: { id: memoryId } };
      return unwrap(
        on
          ? await api.POST('/api/v1/memories/{id}/heart/', { params })
          : await api.DELETE('/api/v1/memories/{id}/heart/', { params }),
      );
    },
    onMutate: async (on) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<Memory>(key);
      if (previous) client.setQueryData<Memory>(key, { ...previous, my_heart: on });
      return { previous };
    },
    onError: (_error, _on, context) => {
      if (context?.previous) client.setQueryData(key, context.previous);
    },
    onSettled: () => client.invalidateQueries(listsOnly),
  });
}

export function useComments(memoryId: number) {
  return useQuery({
    queryKey: commentsKey(memoryId),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/memories/{memory_pk}/comments/', {
          params: { path: { memory_pk: String(memoryId) } },
        }),
      ),
  });
}

export function useAddComment(memoryId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) =>
      unwrap(
        await api.POST('/api/v1/memories/{memory_pk}/comments/', {
          params: { path: { memory_pk: String(memoryId) } },
          body: { body: body.trim() },
        }),
      ),
    onSuccess: (comment) =>
      client.setQueryData<MemoryComment[]>(commentsKey(memoryId), (current = []) => [
        ...current,
        comment,
      ]),
  });
}

export function useDeleteComment(memoryId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: number) => {
      unwrap(
        await api.DELETE('/api/v1/memories/{memory_pk}/comments/{id}/', {
          params: { path: { memory_pk: String(memoryId), id: commentId } },
        }),
      );
      return commentId;
    },
    onSuccess: (commentId) =>
      client.setQueryData<MemoryComment[]>(commentsKey(memoryId), (current = []) =>
        current.filter((c) => c.id !== commentId),
      ),
  });
}

export function useDeleteMemory(memoryId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      unwrap(await api.DELETE('/api/v1/memories/{id}/', { params: { path: { id: memoryId } } }));
    },
    onSuccess: async () => {
      client.removeQueries({ queryKey: memoryKey(memoryId) });
      client.removeQueries({ queryKey: commentsKey(memoryId) });
      await client.invalidateQueries(listsOnly);
    },
  });
}
