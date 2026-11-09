/** "Together since" and the next milestone, on local calendar days (pure, tested). */
import { fromIsoDate } from '@/ui';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).getTime();
}

export function daysTogether(start: string, today: Date = new Date()): number {
  return Math.round((startOfDay(today) - startOfDay(fromIsoDate(start))) / DAY_MS);
}

export type Milestone =
  | { kind: 'years'; value: number; inDays: number }
  | { kind: 'days'; value: number; inDays: number };

/** Round day counts worth celebrating: 100, 200, 500, 1000, then every 500. */
function nextRoundDays(days: number): number {
  for (const step of [100, 200, 500, 1000]) if (days <= step) return step;
  return Math.ceil(days / 500) * 500;
}

/** The nearest upcoming milestone (today counts, with inDays = 0). */
export function nextMilestone(start: string, today: Date = new Date()): Milestone | null {
  const days = daysTogether(start, today);
  if (days < 0) return null;
  const begin = fromIsoDate(start);
  const years = today.getFullYear() - begin.getFullYear();
  const candidates: Milestone[] = [];
  for (const y of [years, years + 1]) {
    if (y < 1) continue;
    const anniversary = new Date(begin);
    anniversary.setFullYear(begin.getFullYear() + y);
    if (anniversary.getMonth() !== begin.getMonth()) anniversary.setDate(0); // 29 Feb -> 28 Feb
    const inDays = Math.round((startOfDay(anniversary) - startOfDay(today)) / DAY_MS);
    if (inDays >= 0) candidates.push({ kind: 'years', value: y, inDays });
  }
  const round = nextRoundDays(days);
  candidates.push({ kind: 'days', value: round, inDays: round - days });
  return candidates.sort((a, b) => a.inDays - b.inDays)[0] ?? null;
}
