import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';

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
  return { ...query, messages: unique(flattenPages(query.data?.pages)) };
}

/** A message may sit on two pages while the thread moves: keep its first (newest) copy. */
function unique(messages: Message[]): Message[] {
  const seen = new Set<number>();
  return messages.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

/** True while the app is in the foreground (a phone in a pocket reads nothing). */
function useAppActive(): boolean {
  const [active, setActive] = useState(() => AppState.currentState !== 'background');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  return active;
}

/** Id of the newest message from the partner that I have not read yet, if any. */
export function newestUnread(messages: Message[]): number | null {
  const unread = messages.find((m) => m.author !== 'me' && !m.read_at && m.id > 0);
  return unread ? unread.id : null;
}

/**
 * Read receipts: while the conversation is on screen, the partner's new messages are
 * marked as read (they then see two ticks, like on WhatsApp).
 */
export function useMarkRead(messages: Message[], active: boolean): void {
  const client = useQueryClient();
  const foreground = useAppActive();
  const unreadId = newestUnread(messages);
  useEffect(() => {
    if (!active || !foreground || unreadId === null) return;
    void api
      .POST('/api/v1/messages/read/')
      .then(() => client.invalidateQueries({ queryKey: messagesKey }))
      .catch(() => {});
  }, [active, foreground, unreadId, client]);
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

let draftSeq = 0;
/** Local message shown at once while it is sent; negative ids never clash with the server. */
const draft = (fields: Partial<Message>): Message => ({
  id: -(Date.now() * 100 + (draftSeq++ % 100)),
  kind: 'text',
  text: '',
  author: 'me',
  media_url: null,
  duration_ms: null,
  width: null,
  height: null,
  created_at: new Date().toISOString(),
  read_at: null,
  waveform: [],
  ...fields,
});

async function uploadMedia(contentType: string, file: { uri: string; name: string }) {
  const ticket = unwrap(
    await api.POST('/api/v1/messages/upload-url/', { body: { content_type: contentType } }),
  );
  await uploadFile(ticket, { ...file, type: contentType });
  return ticket.key;
}

/** A message that did not go: kept on screen (nothing typed is lost) until resent or removed. */
export type FailedMessage = { message: Message; retry: () => Promise<void> };

type OutboxState = {
  failed: FailedMessage[];
  add: (entry: FailedMessage) => void;
  drop: (id: number) => void;
};

export const useOutbox = create<OutboxState>((set) => ({
  failed: [],
  add: (entry) => set((state) => ({ failed: [entry, ...state.failed] })),
  drop: (id) => set((state) => ({ failed: state.failed.filter((f) => f.message.id !== id) })),
}));

/** Resends a failed message (it leaves the outbox and goes through a fresh send). */
export function retryFailed(id: number): Promise<void> {
  const entry = useOutbox.getState().failed.find((f) => f.message.id === id);
  if (!entry) return Promise.resolve();
  useOutbox.getState().drop(id);
  return entry.retry();
}

export function useMessageActions() {
  const client = useQueryClient();
  const online = useOnline();
  const queued = useMutation<unknown, Error, object>({ mutationKey: OFFLINE_MUTATION_KEY });
  const show = (message: Message) =>
    client.setQueryData<InfiniteData<Page>>(messagesKey, (d) => prepend(d, message));
  const refresh = () => client.invalidateQueries({ queryKey: messagesKey });
  /** The send failed: the draft leaves the thread and waits in the outbox, with its retry. */
  const fail = (local: Message, retry: () => Promise<void>) => {
    client.setQueryData<InfiniteData<Page>>(messagesKey, (d) => without(d, local.id));
    useOutbox.getState().add({ message: local, retry });
  };

  /** Text: shown at once; sent now, or queued until the network is back. */
  const sendText = async (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    await client.cancelQueries({ queryKey: messagesKey });
    const local = draft({ text: clean });
    show(local);
    const retry = () => sendText(clean);
    const request = {
      method: 'POST',
      path: '/api/v1/messages/',
      body: { kind: 'text', text: clean },
    };
    if (!online) {
      // Waits for the network (and survives a restart); a refusal later keeps the text.
      queued.mutate(request, { onError: () => fail(local, retry) });
      return;
    }
    try {
      await queued.mutateAsync(request);
    } catch {
      fail(local, retry);
    } finally {
      void refresh();
    }
  };

  const sendPhoto = async (image: LocalImage) => {
    const compressed = await compressImage(image);
    const local = draft({
      kind: 'photo',
      media_url: compressed.uri,
      width: compressed.width,
      height: compressed.height,
    });
    show(local);
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
    } catch {
      fail(local, () => sendPhoto(compressed));
    } finally {
      void refresh();
    }
  };

  const sendVoice = async (uri: string, durationMs: number, waveform: number[] = []) => {
    const local = draft({ kind: 'voice', media_url: uri, duration_ms: durationMs, waveform });
    show(local);
    try {
      const key = await uploadMedia(VOICE_CONTENT_TYPE, { uri, name: 'note.m4a' });
      unwrap(
        await api.POST('/api/v1/messages/', {
          body: {
            kind: 'voice',
            media_key: key,
            duration_ms: Math.max(1, Math.round(durationMs)),
            waveform,
          },
        }),
      );
    } catch {
      fail(local, () => sendVoice(uri, durationMs, waveform));
    } finally {
      void refresh();
    }
  };

  /** Deletes my message. Throws when the server refused (it then comes back on screen). */
  const remove = async (message: Message) => {
    if (message.id < 0) {
      useOutbox.getState().drop(message.id); // never reached the server
      return;
    }
    client.setQueryData<InfiniteData<Page>>(messagesKey, (d) => without(d, message.id));
    try {
      unwrap(await api.DELETE('/api/v1/messages/{id}/', { params: { path: { id: message.id } } }));
    } finally {
      void refresh();
    }
  };

  return { sendText, sendPhoto, sendVoice, remove };
}
