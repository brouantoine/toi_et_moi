import { BRAND } from '@/config/brand';

/** Readable alphabet used by the backend (no 0/O/1/I/L). */
const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

/** Uppercases and strips separators/spaces typed by humans ("abc-123" -> "ABC123"). */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidCode(raw: string): boolean {
  return CODE_RE.test(normalizeCode(raw));
}

/** Extracts the code from `nousdeux://join/CODE` (or a path ending in /join/CODE). */
export function parseJoinLink(url: string): string | null {
  const match = url.match(/\/\/?join\/([A-Za-z0-9-]+)\/?(?:[?#].*)?$/);
  if (!match?.[1]) return null;
  const code = normalizeCode(match[1]);
  return isValidCode(code) ? code : null;
}

export function joinLink(code: string): string {
  return `${BRAND.scheme}://join/${code}`;
}

/**
 * Finds an invitation code in free text: a pasted link, a whole shared message,
 * or the bare code. Inside a sentence only UPPERCASE words count, so ordinary
 * 6-letter words ("espace") are never mistaken for a code.
 */
export function extractCode(text: string): string | null {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const link = words.find((word) => word.includes('join/'));
  const fromLink = link ? parseJoinLink(link.replace(/[).,;!?»"']+$/, '')) : null;
  if (fromLink) return fromLink;
  if (words.length === 1) {
    const code = normalizeCode(words[0] ?? '');
    return isValidCode(code) ? code : null;
  }
  for (const word of words) {
    const bare = word.replace(/[^A-Za-z0-9-]/g, '');
    if (bare === bare.toUpperCase() && isValidCode(bare)) return normalizeCode(bare);
  }
  return null;
}
