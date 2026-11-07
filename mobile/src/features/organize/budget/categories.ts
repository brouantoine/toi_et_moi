import {
  Gift,
  HeartPulse,
  House,
  Plane,
  Shapes,
  ShoppingBasket,
  Ticket,
  type LucideIcon,
} from 'lucide-react-native';

import type { Hue } from '@/ui';

import type { ExpenseCategory } from './useBudget';

export const CATEGORY_ICONS: Record<ExpenseCategory, LucideIcon> = {
  groceries: ShoppingBasket,
  home: House,
  outings: Ticket,
  travel: Plane,
  gifts: Gift,
  health: HeartPulse,
  other: Shapes,
};

export const CATEGORY_HUES: Record<ExpenseCategory, Hue> = {
  groceries: 'amber',
  home: 'sage',
  outings: 'red',
  travel: 'lagoon',
  gifts: 'red',
  health: 'violet',
  other: 'sage',
};
