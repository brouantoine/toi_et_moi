import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import { api, unwrap, type Schemas } from '@/api';
import { OFFLINE_MUTATION_KEY, useOnline } from '@/api/offline';
import { cursorFrom, flattenPages, type CursorPage } from '@/api/pagination';
import { compressImage, uploadFile, type LocalImage } from '@/media/images';

export type Message = Schemas['Message'];
type Page = CursorPage<Message>;

export const messagesKey = ['messages'] as const;
export const VOICE_CONTENT_TYPE = 'audio/mp4';

export function useMessages() {
  const query = useInfiniteQuery({
    queryKey: messagesKey,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      unwrap(await api.GET('/api/v1/messages/', { params: { query: { cursor: pageParam } } })),
    getNextPageParam: (last) => cursorFrom(last.next),
  });
  return { ...query, messages: flattenPages(query.data?.pages) };
}

/** Puts a message at the top of the newest page (the thread is newest first). */
function prepend(
  data: InfiniteData<Page> | undefined,
  message: Message,
): InfiniteData<Page> | undefined {
  if (!data?.pages.length) return data;
  const [first, ...rest] = data.pages;
  return { ...data, pages: [{ ...first!, results: [message, ...first!.results] }, ...rest] };
}

function without(data: InfiniteData<Page> | undefined, id: number): InfiniteData<Page> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((p) => ({ ...p, results: p.results.filter((m) => m.id !== id) })),
  };
}

const draft = (fields: Partial<Message>): Message => ({
  id: -Date.now(),
  kind: 'text',
  text: '',
  author: 'me',
  media_url: null,
  duration_ms: null,
  width: null,
  height: null,
  created_at: new Date().toISOString(),
  ...fields,
});

async function uploadMedia(contentType: string, file: { uri: string; name: string }) {
  const ticket = unwrap(
    await api.POST('/api/v1/messages/upload-url/', { body: { content_type: contentType } }),
  );
  await uploadFile(ticket, { ...file, type: contentType });
  return ticket.key;
}

export function useMessageActions() {
  const client = useQueryClient();
  const online = useOnline();
  const queued = useMutation<unknown, Error, object>({ mutationKey: OFFLINE_MUTATION_KEY });
  const show = (message: Message) =>
    client.setQueryData<InfiniteData<Page>>(messagesKey, (d) => prepend(d, message));
  const refresh = () => client.invalidateQueries({ queryKey: messagesKey });

  /** Text: shown at once; sent now, or queued until the network is back. */
  const sendText = async (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    await client.cancelQueries({ queryKey: messagesKey });
    show(draft({ text: clean }));
    const request = {
      method: 'POST',
      path: '/api/v1/messages/',
      body: { kind: 'text', text: clean },
    };
    if (!online) {
      queued.mutate(request);
      return;
    }
    try {
      await queued.mutateAsync(request);
    } finally {
      void refresh();
    }
  };

  const sendPhoto = async (image: LocalImage) => {
    const compressed = await compressImage(image);
    show(
      draft({
        kind: 'photo',
        media_url: compressed.uri,
        width: compressed.width,
        height: compressed.height,
      }),
    );
    try {
      const key = await uploadMedia('image/jpeg', { uri: compressed.uri, name: 'photo.jpg' });
      unwrap(
        await api.POST('/api/v1/messages/', {
          body: {
            kind: 'photo',
            media_key: key,
            width: compressed.width,
            height: compressed.height,
          },
        }),
      );
    } finally {
      void refresh();
    }
  };

  const sendVoice = async (uri: string, durationMs: number) => {
    show(draft({ kind: 'voice', media_url: uri, duration_ms: durationMs }));
    try {
      const key = await uploadMedia(VOICE_CONTENT_TYPE, { uri, name: 'note.m4a' });
      unwrap(
        await api.POST('/api/v1/messages/', {
          body: { kind: 'voice', media_key: key, duration_ms: Math.max(1, Math.round(durationMs)) },
        }),
      );
    } finally {
      void refresh();
    }
  };

  const remove = async (message: Message) => {
    client.setQueryData<InfiniteData<Page>>(messagesKey, (d) => without(d, message.id));
    try {
      unwrap(await api.DELETE('/api/v1/messages/{id}/', { params: { path: { id: message.id } } }));
    } finally {
      void refresh();
    }
  };

  return { sendText, sendPhoto, sendVoice, remove };
}
