import { Bell, Copy, Heart, House, User, type LucideIcon } from 'lucide-react-native';

/**
 * The 5 tabs, in order, with the icons of the reference capture chosen by the user:
 * home, stacked cards, heart, bell, profile. Labels stay for screen readers only.
 */
export const TABS: readonly { name: string; icon: LucideIcon }[] = [
  { name: 'today', icon: House },
  { name: 'memories', icon: Copy },
  { name: 'us', icon: Heart },
  { name: 'organize', icon: Bell },
  { name: 'me', icon: User },
] as const;
