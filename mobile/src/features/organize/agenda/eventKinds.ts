import { CalendarDays, Cake, Plane, type LucideIcon } from 'lucide-react-native';

import type { Hue } from '@/ui';

import type { EventKind } from './useAgenda';

export const EVENT_KIND_ICONS: Record<EventKind, LucideIcon> = {
  event: CalendarDays,
  birthday: Cake,
  reunion: Plane,
};

export const EVENT_KIND_HUES: Record<EventKind, Hue> = {
  event: 'sage',
  birthday: 'amber',
  reunion: 'red',
};
