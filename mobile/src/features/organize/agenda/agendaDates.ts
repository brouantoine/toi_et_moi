/** Pure date helpers for the agenda (local calendar days, no timezone surprises). */
import { fromIsoDate, toIsoDate } from '@/ui';

export const AGENDA_DAYS = 90;

export function agendaRange(today: Date = new Date()): { start: string; end: string } {
  const end = new Date(today);
  end.setDate(end.getDate() + AGENDA_DAYS);
  return { start: toIsoDate(today), end: toIsoDate(end) };
}

/** "today" / "tomorrow" / null (then show the date itself). */
export function relativeDay(iso: string, today: Date = new Date()): 'today' | 'tomorrow' | null {
  const todayIso = toIsoDate(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (iso === todayIso) return 'today';
  if (iso === toIsoDate(tomorrow)) return 'tomorrow';
  return null;
}

export function dayTitle(iso: string, locale: string): string {
  const text = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(fromIsoDate(iso));
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

export function timeLabel(isoDateTime: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
    new Date(isoDateTime),
  );
}

/** Local "YYYY-MM-DD" + "HH:MM" -> UTC ISO instant. */
export function toInstant(date: string, time: string): string {
  const [h, m] = time.split(':').map(Number);
  const day = fromIsoDate(date);
  day.setHours(h ?? 0, m ?? 0, 0, 0);
  return day.toISOString();
}

/** UTC ISO instant -> local "HH:MM". */
export function toLocalTime(isoDateTime: string): string {
  const d = new Date(isoDateTime);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function groupByDay<T extends { date: string }>(items: T[]): { date: string; data: T[] }[] {
  const sections: { date: string; data: T[] }[] = [];
  for (const item of items) {
    const last = sections[sections.length - 1];
    if (last?.date === item.date) last.data.push(item);
    else sections.push({ date: item.date, data: [item] });
  }
  return sections;
}
