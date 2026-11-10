import { Bell, Heart, User, type LucideIcon } from 'lucide-react-native';

import { Cards, HomeArch } from '@/ui';

/**
 * The 5 tabs, in order, with the icons of the reference capture chosen by the user:
 * home, games (stacked cards), messages (heart), organisation (bell), profile.
 * The journal of memories opens from the home. Labels are for screen readers only.
 */
export const TABS: readonly { name: string; icon: LucideIcon }[] = [
  { name: 'today', icon: HomeArch },
  { name: 'games', icon: Cards },
  { name: 'us', icon: Heart },
  { name: 'organize', icon: Bell },
  { name: 'me', icon: User },
] as const;
