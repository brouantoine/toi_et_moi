import { z } from 'zod';

import { toIsoDate } from '@/ui';

import { toInstant, toLocalTime } from './agendaDates';
import type { AgendaEvent } from './useAgenda';

export const REMINDERS = ['none', 'atTime', 'hour', 'day'] as const;
export type Reminder = (typeof REMINDERS)[number];
const REMINDER_MINUTES: Record<Reminder, number | null> = {
  none: null,
  atTime: 0,
  hour: 60,
  day: 1440,
};

export const eventSchema = z.object({
  title: z.string().trim().min(1, 'organize.event.errors.titleRequired').max(120),
  kind: z.enum(['event', 'birthday', 'reunion']),
  allDay: z.boolean(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  place: z.string().trim().max(200),
  concerns: z.enum(['me', 'you', 'us']),
  yearly: z.boolean(),
  reminder: z.enum(REMINDERS),
});

export type EventFormValues = z.infer<typeof eventSchema>;

export function emptyEventForm(today: Date = new Date()): EventFormValues {
  return {
    title: '',
    kind: 'event',
    allDay: true,
    date: toIsoDate(today),
    time: '19:00',
    place: '',
    concerns: 'us',
    yearly: false,
    reminder: 'none',
  };
}

export function formFromEvent(event: AgendaEvent): EventFormValues {
  const minutes = event.reminder_minutes ?? null;
  const reminder =
    (Object.entries(REMINDER_MINUTES).find(([, m]) => m === minutes)?.[0] as Reminder) ?? 'none';
  return {
    title: event.title,
    kind: event.kind ?? 'event',
    allDay: event.all_day ?? true,
    // A timed event is edited on this phone's calendar day, the same clock as its time.
    date: event.starts_at
      ? toIsoDate(new Date(event.starts_at))
      : (event.date ?? toIsoDate(new Date())),
    time: event.starts_at ? toLocalTime(event.starts_at) : '19:00',
    place: event.place ?? '',
    concerns: event.concerns ?? 'us',
    yearly: event.recurrence === 'yearly',
    reminder,
  };
}

/** Form values -> API body (timed events are sent as UTC instants). */
export function eventPayload(values: EventFormValues) {
  const common = {
    title: values.title.trim(),
    kind: values.kind,
    place: values.place.trim(),
    concerns: values.concerns,
    recurrence: values.yearly ? ('yearly' as const) : ('none' as const),
    reminder_minutes: REMINDER_MINUTES[values.reminder],
  };
  return values.allDay
    ? { ...common, all_day: true, date: values.date }
    : { ...common, all_day: false, starts_at: toInstant(values.date, values.time) };
}
