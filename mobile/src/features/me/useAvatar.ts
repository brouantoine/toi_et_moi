/** Profile picture: an illustrated character (instant) or an uploaded photo. */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api, unwrap, type Schemas } from '@/api';
import { coupleKey } from '@/features/couple/useCouple';
import {
  compressImage,
  uploadToTicket,
  UPLOAD_CONTENT_TYPE,
  type LocalImage,
} from '@/media/images';

import { meKey, type Me } from './useProfile';

/** Ids accepted by the server, from the generated API types. */
type AvatarPreset = NonNullable<Schemas['PatchedUserRequest']['avatar_preset']>;

export function useAvatarActions() {
  const client = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: meKey }),
      client.invalidateQueries({ queryKey: coupleKey }),
    ]);
  };

  /** A character replaces the photo, so what you picked is what both of you see. */
  const choosePreset = useMutation({
    mutationFn: async ({ preset, hadPhoto }: { preset: string; hadPhoto: boolean }) => {
      if (hadPhoto) {
        const removed = await api.DELETE('/api/v1/me/avatar/');
        if (!removed.response.ok) unwrap(removed);
      }
      return unwrap(
        await api.PATCH('/api/v1/me/', { body: { avatar_preset: preset as AvatarPreset } }),
      );
    },
    onMutate: async ({ preset }) => {
      // Shown at once: the server confirms right after.
      const previous = client.getQueryData<Me>(meKey);
      if (previous)
        client.setQueryData(meKey, { ...previous, avatar_preset: preset, avatar_url: null });
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) client.setQueryData(meKey, context.previous);
    },
    onSettled: refresh,
  });

  const uploadPhoto = useMutation({
    mutationFn: async (image: LocalImage) => {
      const compressed = await compressImage(image);
      const ticket = unwrap(
        await api.POST('/api/v1/me/avatar/upload-url/', {
          body: { content_type: UPLOAD_CONTENT_TYPE },
        }),
      );
      await uploadToTicket(ticket, compressed);
      unwrap(await api.PUT('/api/v1/me/avatar/', { body: { key: ticket.key } }));
    },
    onSettled: refresh,
  });

  const removePhoto = useMutation({
    mutationFn: async () => {
      const result = await api.DELETE('/api/v1/me/avatar/');
      if (!result.response.ok) unwrap(result);
    },
    onSettled: refresh,
  });

  return { choosePreset, uploadPhoto, removePhoto };
}
