/** Questions, games, notes and couple stats: data hooks. Screens never call the API. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, unwrap, type Schemas } from '@/api';

export type GamesHome = Schemas['GamesHome'];
export type Question = Schemas['Question'];
export type Topic = Schemas['Topic'];
export type Note = Schemas['Note'];
export type QuestionState = Question['state'];

export const gamesKey = ['games'] as const;
export const notesKey = ['notes'] as const;

/** A well-formed home payload (guards against partial or foreign responses). */
export function isGamesHome(data: unknown): data is GamesHome {
  const d = data as Partial<GamesHome> | null | undefined;
  return Boolean(d && Array.isArray(d.daily) && Array.isArray(d.topics) && d.stats && d.streak);
}

export function useGamesHome() {
  const query = useQuery({
    queryKey: [...gamesKey, 'home'],
    queryFn: async () => unwrap(await api.GET('/api/v1/games/home/')),
  });
  return { ...query, home: isGamesHome(query.data) ? query.data : undefined };
}

export type QuestionFilter = { topic?: string; kind?: string };

export function useQuestions(filter: QuestionFilter, enabled = true) {
  return useQuery({
    queryKey: [...gamesKey, 'questions', filter.topic ?? '', filter.kind ?? ''],
    enabled,
    queryFn: async (): Promise<Question[]> =>
      unwrap(await api.GET('/api/v1/games/questions/', { params: { query: filter } })),
  });
}

/** "travel-3" -> "travel": a question id starts with its topic. */
export function topicOf(questionId: string): string {
  return questionId.replace(/-\d+$/, '');
}

export function useAnswer() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { question: string; choice?: number; text?: string }) =>
      unwrap(await api.POST('/api/v1/games/answers/', { body: input })),
    onSettled: () => client.invalidateQueries({ queryKey: gamesKey }),
  });
}

export function useSetAdult() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) =>
      unwrap(await api.PUT('/api/v1/games/adult/', { body: { enabled } })),
    onSettled: () => client.invalidateQueries({ queryKey: gamesKey }),
  });
}

export function useNotes() {
  const query = useQuery({
    queryKey: notesKey,
    queryFn: async () => unwrap(await api.GET('/api/v1/notes/')),
  });
  return { ...query, notes: Array.isArray(query.data) ? (query.data as Note[]) : [] };
}

export function useNoteActions() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: notesKey });
  const add = useMutation({
    mutationFn: async (input: { text: string; color: Note['color'] }) =>
      unwrap(await api.POST('/api/v1/notes/', { body: input })),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: async (id: number) => {
      const result = await api.DELETE('/api/v1/notes/{id}/', { params: { path: { id } } });
      if (!result.response.ok) unwrap(result);
    },
    onSettled: refresh,
  });
  return { add, remove };
}
