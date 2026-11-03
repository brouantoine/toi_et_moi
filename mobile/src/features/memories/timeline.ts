import { fromIsoDate } from '@/ui';

import type { Memory } from './useMemories';

export type TimelineSection = { key: string; title: string; data: Memory[] };

function capitalize(text: string, locale: string): string {
  return text ? text.charAt(0).toLocaleUpperCase(locale) + text.slice(1) : text;
}

/**
 * Groups memories (already sorted newest first by the API) into month sections,
 * keeping the order. Section titles are localized, e.g. "Mars 2025" / "March 2025".
 */
export function groupByMonth(memories: Memory[], locale: string): TimelineSection[] {
  const format = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const sections: TimelineSection[] = [];
  for (const memory of memories) {
    const key = memory.happened_on.slice(0, 7); // YYYY-MM
    const last = sections[sections.length - 1];
    if (last?.key === key) {
      last.data.push(memory);
    } else {
      const title = capitalize(format.format(fromIsoDate(memory.happened_on)), locale);
      sections.push({ key, title, data: [memory] });
    }
  }
  return sections;
}

/** Day of month and short weekday shown on the timeline rail. */
export function railDate(isoDate: string, locale: string): { day: string; weekday: string } {
  const date = fromIsoDate(isoDate);
  return {
    day: String(date.getDate()),
    weekday: new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date).replace('.', ''),
  };
}
