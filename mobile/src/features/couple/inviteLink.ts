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
