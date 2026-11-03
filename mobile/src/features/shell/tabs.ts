import {
  BookHeart,
  CalendarCheck,
  HeartHandshake,
  Sun,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';

/** The 5 tabs, in order. Icons: Lucide only. */
export const TABS: readonly { name: string; icon: LucideIcon }[] = [
  { name: 'today', icon: Sun },
  { name: 'memories', icon: BookHeart },
  { name: 'organize', icon: CalendarCheck },
  { name: 'us', icon: HeartHandshake },
  { name: 'me', icon: UserRound },
] as const;
