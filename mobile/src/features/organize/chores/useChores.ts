import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api, unwrap, type Schemas } from '@/api';
import { optimistic } from '@/api/offline';

import { useQueuedWrite } from '../agenda/useAgenda';

export type Chore = Schemas['Chore'];
export type ChoreWeek = Schemas['ChoreWeek'];
export type ChoreRecurrence = Schemas['ChoreRecurrenceEnum'];
export const CHORE_RECURRENCES: readonly ChoreRecurrence[] = ['none', 'daily', 'weekly', 'monthly'];

export const choresKey = ['chores'] as const;
const weekKey = [...choresKey, 'week'] as const;

export function useChoreWeek() {
  return useQuery({
    queryKey: weekKey,
    queryFn: async () => unwrap(await api.GET('/api/v1/chores/week/')),
  });
}

type Group = 'me' | 'you' | 'us';
const GROUPS: Group[] = ['me', 'you', 'us'];

/** Removes a chore from the week (completed or deleted); the server says what comes next. */
function without(week: ChoreWeek | undefined, id: number): ChoreWeek | undefined {
  if (!week) return week;
  const next = { ...week };
  GROUPS.forEach((g) => {
    next[g] = week[g].filter((c) => c.id !== id);
  });
  return next;
}

export function useChoreActions() {
  const client = useQueryClient();
  const { write } = useQueuedWrite(choresKey);
  const run = async (id: number, send: () => Promise<unknown>) => {
    const rollback = await optimistic<ChoreWeek>(client, weekKey, (week) => without(week, id));
    try {
      await send();
    } catch {
      rollback();
    }
  };
  return {
    create: (body: {
      title: string;
      assignee: Group;
      recurrence: ChoreRecurrence;
      due_date?: string;
    }) => write({ method: 'POST', path: '/api/v1/chores/', body }),
    complete: (chore: Chore) =>
      run(chore.id, () =>
        write({
          method: 'POST',
          path: '/api/v1/chores/{id}/complete/',
          pathParams: { id: chore.id },
        }),
      ),
    remove: (chore: Chore) =>
      run(chore.id, () =>
        write({ method: 'DELETE', path: '/api/v1/chores/{id}/', pathParams: { id: chore.id } }),
      ),
  };
}
