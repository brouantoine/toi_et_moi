/** Memory form: validation (messages are i18n keys) and API mapping. */
import { z } from 'zod';

import { toIsoDate } from '@/ui';

import { MEMORY_TYPES, type Memory } from './useMemories';

export const MAX_PHOTOS = 10;
export const MAX_TAGS = 50;
export const MAX_TAG_LENGTH = 30;

export const memorySchema = z.object({
  title: z.string().trim().min(1, 'memories.form.errors.titleRequired').max(120),
  body: z.string().max(5000, 'memories.form.errors.bodyTooLong'),
  happened_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'memories.form.errors.dateRequired'),
  place: z.string().trim().max(200),
  type: z.enum(MEMORY_TYPES as [Memory['type'] & string, ...(Memory['type'] & string)[]]),
  tags: z.array(z.string().trim().min(1).max(MAX_TAG_LENGTH)).max(MAX_TAGS),
});

export type MemoryFormValues = z.infer<typeof memorySchema>;

export function emptyMemoryForm(today: Date = new Date()): MemoryFormValues {
  return {
    title: '',
    body: '',
    happened_on: toIsoDate(today),
    place: '',
    type: 'moment',
    tags: [],
  };
}

export function formFromMemory(memory: Memory): MemoryFormValues {
  return {
    title: memory.title,
    body: memory.body ?? '',
    happened_on: memory.happened_on,
    place: memory.place ?? '',
    type: memory.type ?? 'moment',
    tags: memory.tags ?? [],
  };
}

/** Normalizes a typed tag: trimmed, no leading '#', inner spaces collapsed, max length. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, '').replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH);
}

/** Adds a tag once (case-insensitive), ignoring empty input and the max count. */
export function addTag(tags: string[], raw: string): string[] {
  const tag = normalizeTag(raw);
  if (!tag || tags.length >= MAX_TAGS) return tags;
  if (tags.some((t) => t.toLocaleLowerCase() === tag.toLocaleLowerCase())) return tags;
  return [...tags, tag];
}
