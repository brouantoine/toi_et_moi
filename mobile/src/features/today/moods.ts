import { Angry, Frown, Laugh, Smile, type LucideIcon } from 'lucide-react-native';

import type { Hue } from '@/ui';

import type { Mood } from './useMorning';

export const MOOD_ICONS: Record<Mood, LucideIcon> = {
  joyful: Laugh,
  happy: Smile,
  upset: Frown,
  angry: Angry,
};

export const MOOD_HUES: Record<Mood, Hue> = {
  joyful: 'amber',
  happy: 'sage',
  upset: 'violet',
  angry: 'red',
};
