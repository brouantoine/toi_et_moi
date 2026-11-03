import { Camera, Laugh, MapPin, Quote, Sparkles, type LucideIcon } from 'lucide-react-native';

import type { Hue } from '@/ui';

import type { MemoryType } from './useMemories';

export const MEMORY_TYPE_ICONS: Record<MemoryType, LucideIcon> = {
  moment: Camera,
  first_time: Sparkles,
  place: MapPin,
  inside_joke: Laugh,
  quote: Quote,
};

/** One hue per kind of memory, so the timeline reads at a glance. */
export const MEMORY_TYPE_HUES: Record<MemoryType, Hue> = {
  moment: 'red',
  first_time: 'amber',
  place: 'sage',
  inside_joke: 'lagoon',
  quote: 'violet',
};
