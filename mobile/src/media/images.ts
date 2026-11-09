/**
 * Image pipeline shared by memories, avatar and couple photo:
 * pick from the library -> compress (max 2048 px, JPEG 0.8) -> upload to S3 with a
 * presigned POST ticket from the API. No business logic here; callers confirm the key.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export const MAX_EDGE = 2048;
export const JPEG_QUALITY = 0.8;
export const UPLOAD_CONTENT_TYPE = 'image/jpeg';

export type LocalImage = { uri: string; width: number; height: number };

export type PickResult =
  { status: 'picked'; images: LocalImage[] } | { status: 'cancelled' } | { status: 'denied' };

/** Presigned POST ticket returned by the API (`ImageUploadTicket`). */
export type UploadTicket = {
  key: string;
  url: string;
  form_fields: Record<string, string>;
};

export class UploadError extends Error {
  constructor(readonly status: number) {
    super(`upload_failed_${status}`);
    this.name = 'UploadError';
  }
}

/**
 * Opens the system photo picker. Recent iOS/Android pickers need no permission; on older
 * systems a refusal surfaces as an error, reported as `denied` instead of crashing.
 */
export async function pickImages(limit: number): Promise<PickResult> {
  if (limit <= 0) return { status: 'cancelled' };
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: limit > 1,
      selectionLimit: limit,
      orderedSelection: true,
      quality: 1,
      exif: false,
    });
    if (result.canceled) return { status: 'cancelled' };
    return {
      status: 'picked',
      images: result.assets
        .slice(0, limit)
        .map(({ uri, width, height }) => ({ uri, width, height })),
    };
  } catch {
    const permission = await ImagePicker.getMediaLibraryPermissionsAsync().catch(() => null);
    if (permission && !permission.granted) return { status: 'denied' };
    throw new Error('picker_failed');
  }
}

/** Size that fits within MAX_EDGE on its longest side, keeping the ratio (never upscales). */
export function fitWithin(width: number, height: number, max: number = MAX_EDGE) {
  const longest = Math.max(width, height);
  if (!longest || longest <= max) return null;
  return width >= height ? { width: max } : { height: max };
}

/** Re-encodes as JPEG 0.8, downscaled to MAX_EDGE. Also strips EXIF (location) data. */
export async function compressImage(image: LocalImage): Promise<LocalImage> {
  const context = ImageManipulator.manipulate(image.uri);
  const target = fitWithin(image.width, image.height);
  if (target) context.resize(target);
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/** Sends any local file straight to storage with the presigned POST fields. */
export async function uploadFile(
  ticket: UploadTicket,
  file: { uri: string; name: string; type: string },
): Promise<void> {
  const form = new FormData();
  Object.entries(ticket.form_fields).forEach(([name, value]) => form.append(name, value));
  // React Native FormData file part. `file` must be the last field for S3.
  form.append('file', file as unknown as Blob);
  const response = await fetch(ticket.url, { method: 'POST', body: form });
  if (!response.ok) throw new UploadError(response.status);
}

/** Sends a compressed photo straight to storage with the presigned POST fields. */
export async function uploadToTicket(ticket: UploadTicket, image: LocalImage): Promise<void> {
  await uploadFile(ticket, { uri: image.uri, name: 'photo.jpg', type: UPLOAD_CONTENT_TYPE });
}
