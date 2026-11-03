import { Camera, Laugh, MapPin, Quote, Sparkles, type LucideIcon } from 'lucide-react-native';

import type { MemoryType } from './useMemories';

export const MEMORY_TYPE_ICONS: Record<MemoryType, LucideIcon> = {
  moment: Camera,
  first_time: Sparkles,
  place: MapPin,
  inside_joke: Laugh,
  quote: Quote,
};
