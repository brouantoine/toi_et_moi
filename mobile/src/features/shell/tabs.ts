import { Bell, Heart, User, type LucideIcon } from 'lucide-react-native';

import { Cards, HomeArch } from '@/ui';

/**
 * The 5 tabs, in order, with the icons of the reference capture chosen by the user:
 * home, stacked cards, heart, bell, profile. Labels stay for screen readers only.
 */
export const TABS: readonly { name: string; icon: LucideIcon }[] = [
  { name: 'today', icon: HomeArch },
  { name: 'memories', icon: Cards },
  { name: 'us', icon: Heart },
  { name: 'organize', icon: Bell },
  { name: 'me', icon: User },
] as const;
