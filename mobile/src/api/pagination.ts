/** Cursor pagination helpers (DRF CursorPagination: `next` is a full URL with ?cursor=). */
export type CursorPage<T> = { next?: string | null; previous?: string | null; results: T[] };

export function cursorFrom(nextUrl: string | null | undefined): string | undefined {
  if (!nextUrl) return undefined;
  try {
    return new URL(nextUrl).searchParams.get('cursor') ?? undefined;
  } catch {
    return undefined;
  }
}

export function flattenPages<T>(pages: CursorPage<T>[] | undefined): T[] {
  return pages?.flatMap((p) => p.results) ?? [];
}
