import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api, unwrap, type Schemas } from '@/api';
import { optimistic } from '@/api/offline';

import { useQueuedWrite } from '../agenda/useAgenda';

export type SharedList = Schemas['SharedList'];
export type ListItem = Schemas['ListItem'];
export type ListKind = Schemas['ListKindEnum'];

export const listsKey = ['lists'] as const;
export const itemsKey = (listId: number) => ['lists', listId, 'items'] as const;

export function useLists() {
  return useQuery({
    queryKey: listsKey,
    queryFn: async () => unwrap(await api.GET('/api/v1/lists/')),
  });
}

export function useListItems(listId: number) {
  return useQuery({
    queryKey: itemsKey(listId),
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/lists/{list_pk}/items/', {
          params: { path: { list_pk: String(listId) } },
        }),
      ),
  });
}

/** Item writes: instant on screen (optimistic), queued when offline. */
export function useItemActions(listId: number) {
  const client = useQueryClient();
  const { write } = useQueuedWrite(listsKey);
  const key = itemsKey(listId);
  const path = { list_pk: listId };

  const run = async (change: (items: ListItem[]) => ListItem[], send: () => Promise<unknown>) => {
    const rollback = await optimistic<ListItem[]>(client, key, (items = []) => change(items));
    try {
      await send();
    } catch {
      rollback();
    }
  };

  return {
    add: (text: string) =>
      run(
        (items) => [
          ...items,
          {
            id: -Date.now(),
            text,
            done: false,
            done_by: null,
            done_at: null,
            position: items.length,
            created_at: '',
          },
        ],
        () =>
          write({
            method: 'POST',
            path: '/api/v1/lists/{list_pk}/items/',
            pathParams: path,
            body: { text },
          }),
      ),
    toggle: (item: ListItem) =>
      run(
        (items) =>
          items.map((i) =>
            i.id === item.id ? { ...i, done: !i.done, done_by: i.done ? null : 'me' } : i,
          ),
        () =>
          write({
            method: 'PATCH',
            path: '/api/v1/lists/{list_pk}/items/{id}/',
            pathParams: { ...path, id: item.id },
            body: { done: !item.done },
          }),
      ),
    remove: (item: ListItem) =>
      run(
        (items) => items.filter((i) => i.id !== item.id),
        () =>
          write({
            method: 'DELETE',
            path: '/api/v1/lists/{list_pk}/items/{id}/',
            pathParams: { ...path, id: item.id },
          }),
      ),
    reorder: (ids: number[]) =>
      run(
        (items) =>
          ids.map((id) => items.find((i) => i.id === id)).filter((i): i is ListItem => Boolean(i)),
        () =>
          write({
            method: 'POST',
            path: '/api/v1/lists/{list_pk}/items/reorder/',
            pathParams: path,
            body: { ids },
          }),
      ),
    clearDone: () =>
      run(
        (items) => items.filter((i) => !i.done),
        () =>
          write({
            method: 'POST',
            path: '/api/v1/lists/{list_pk}/items/clear-done/',
            pathParams: path,
          }),
      ),
  };
}

/** Moves one id up (-1) or down (+1) in an ordering; unchanged at the edges. */
export function moved(ids: number[], id: number, step: -1 | 1): number[] {
  const from = ids.indexOf(id);
  const to = from + step;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}
