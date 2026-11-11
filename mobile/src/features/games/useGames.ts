/** Packs of questions, notes and couple stats: data hooks. Screens never call the API. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, unwrap, type Schemas } from '@/api';
import {
  compressImage,
  uploadToTicket,
  UPLOAD_CONTENT_TYPE,
  type LocalImage,
} from '@/media/images';

export type GamesHome = Schemas['GamesHome'];
export type Pack = Schemas['Pack'];
export type PackDetail = Schemas['PackDetail'];
export type PackItem = Schemas['Item'];
export type GivenAnswer = Schemas['GivenAnswer'];
export type Topic = Schemas['Topic'];
export type Note = Schemas['Note'];
export type PackState = Pack['state'];
export type PackKind = Pack['kind'];

/** One finger stroke on a 1000 x 1000 canvas: colour index, width, x/y pairs. */
export type Stroke = { c: number; w: number; p: number[] };

export const gamesKey = ['games'] as const;
export const notesKey = ['notes'] as const;

/** A well-formed home payload (guards against partial or foreign responses). */
export function isGamesHome(data: unknown): data is GamesHome {
  const d = data as Partial<GamesHome> | null | undefined;
  const packs = (list: unknown) =>
    Array.isArray(list) && list.every((p) => Array.isArray((p as Partial<Pack> | null)?.tags));
  return Boolean(
    d && packs(d.daily) && packs(d.your_turn) && Array.isArray(d.topics) && d.stats && d.streak,
  );
}

export function useGamesHome() {
  const query = useQuery({
    queryKey: [...gamesKey, 'home'],
    queryFn: async () => unwrap(await api.GET('/api/v1/games/home/')),
  });
  return { ...query, home: isGamesHome(query.data) ? query.data : undefined };
}

export type PackFilter = {
  kind?: string;
  topic?: string;
  state?: 'unanswered' | 'your_turn' | 'waiting' | 'done';
  q?: string;
};

export function usePacks(filter: PackFilter) {
  return useQuery({
    queryKey: [
      ...gamesKey,
      'packs',
      filter.kind ?? '',
      filter.topic ?? '',
      filter.state ?? '',
      filter.q ?? '',
    ],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      unwrap(await api.GET('/api/v1/games/packs/', { params: { query: filter } })),
  });
}

export function usePack(id: string) {
  return useQuery({
    queryKey: [...gamesKey, 'pack', id],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/v1/games/packs/{pack_id}/', { params: { path: { pack_id: id } } }),
      ),
  });
}

export type AnswerInput = {
  question: string;
  choice?: number;
  text?: string;
  drawing?: Stroke[];
  photo?: LocalImage;
  skipped?: boolean;
};

/**
 * Answers one item. A photo is compressed and uploaded first, then confirmed by its key.
 * The pack is updated in place so the next item shows at once.
 */
export function useAnswer(packId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ photo, ...input }: AnswerInput): Promise<PackItem> => {
      let media_key: string | undefined;
      if (photo) {
        const compressed = await compressImage(photo);
        const ticket = unwrap(
          await api.POST('/api/v1/games/upload-url/', {
            body: { content_type: UPLOAD_CONTENT_TYPE },
          }),
        );
        await uploadToTicket(ticket, compressed);
        media_key = ticket.key;
      }
      return unwrap(
        await api.POST('/api/v1/games/answers/', {
          body: {
            ...input,
            skipped: input.skipped ?? false,
            drawing: input.drawing as never,
            media_key,
          },
        }),
      );
    },
    onSuccess: (item) => {
      client.setQueryData<PackDetail>([...gamesKey, 'pack', packId], (pack) =>
        pack
          ? {
              ...pack,
              mine: pack.mine + 1,
              items: pack.items.map((entry) => (entry.id === item.id ? item : entry)),
            }
          : pack,
      );
    },
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
