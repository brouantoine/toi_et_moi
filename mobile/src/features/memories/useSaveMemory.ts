import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { api, unwrap } from '@/api';
import {
  compressImage,
  UPLOAD_CONTENT_TYPE,
  uploadToTicket,
  type LocalImage,
} from '@/media/images';

import type { MemoryFormValues } from './memoryForm';
import { fetchMemory, memoryKey, type Memory } from './useMemories';

/** A photo chosen on the device, not uploaded yet. */
export type DraftPhoto = { localId: string; image: LocalImage };

export type SaveMemoryInput = {
  /** Existing memory to update; omitted to create one. */
  id?: number;
  values: MemoryFormValues;
  newPhotos: DraftPhoto[];
  removedPhotoIds: number[];
};

export type SaveMemoryResult = { memory: Memory; failedPhotos: DraftPhoto[] };
export type SaveProgress = { done: number; total: number } | null;

async function upsertMemory(id: number | undefined, values: MemoryFormValues): Promise<Memory> {
  const body = { ...values, place: values.place.trim(), title: values.title.trim() };
  if (id === undefined) return unwrap(await api.POST('/api/v1/memories/', { body }));
  return unwrap(await api.PATCH('/api/v1/memories/{id}/', { params: { path: { id } }, body }));
}

/** compress -> ask a presigned ticket -> upload to storage -> confirm with the API. */
export async function uploadMemoryPhoto(memoryId: number, photo: DraftPhoto): Promise<void> {
  const compressed = await compressImage(photo.image);
  const path = { memory_pk: String(memoryId) };
  const ticket = unwrap(
    await api.POST('/api/v1/memories/{memory_pk}/photos/upload-url/', {
      params: { path },
      body: { content_type: UPLOAD_CONTENT_TYPE },
    }),
  );
  await uploadToTicket(ticket, compressed);
  unwrap(
    await api.POST('/api/v1/memories/{memory_pk}/photos/', {
      params: { path },
      body: { key: ticket.key, width: compressed.width, height: compressed.height },
    }),
  );
}

/**
 * Saves the memory, then its photo changes. A failing photo never loses the memory:
 * it is reported in `failedPhotos` so the screen can offer to retry it.
 */
export function useSaveMemory() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<SaveProgress>(null);

  const mutation = useMutation({
    mutationFn: async ({
      id,
      values,
      newPhotos,
      removedPhotoIds,
    }: SaveMemoryInput): Promise<SaveMemoryResult> => {
      const saved = await upsertMemory(id, values);
      const path = (photoId: number) => ({ memory_pk: String(saved.id), id: photoId });
      for (const photoId of removedPhotoIds) {
        unwrap(
          await api.DELETE('/api/v1/memories/{memory_pk}/photos/{id}/', {
            params: { path: path(photoId) },
          }),
        );
      }
      const failedPhotos: DraftPhoto[] = [];
      setProgress(newPhotos.length ? { done: 0, total: newPhotos.length } : null);
      for (const [index, photo] of newPhotos.entries()) {
        try {
          await uploadMemoryPhoto(saved.id, photo);
        } catch {
          failedPhotos.push(photo);
        }
        setProgress({ done: index + 1, total: newPhotos.length });
      }
      // Fresh photo list for the caller; the save itself already succeeded.
      const memory =
        newPhotos.length || removedPhotoIds.length
          ? await fetchMemory(saved.id).catch(() => saved)
          : saved;
      return { memory, failedPhotos };
    },
    onSuccess: ({ memory }) => {
      // The mutation already read the fresh memory: no need to refetch the detail.
      queryClient.setQueryData(memoryKey(memory.id), memory);
    },
    onSettled: async () => {
      setProgress(null);
      await queryClient.invalidateQueries({
        queryKey: ['memories'],
        predicate: (query) => query.queryKey[1] !== 'detail',
      });
    },
  });

  return { ...mutation, progress };
}
