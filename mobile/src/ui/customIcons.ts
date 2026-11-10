/**
 * Icons Lucide does not have, drawn on the same 24 px grid with the same 2 px round
 * stroke so they sit next to Lucide icons seamlessly (and work with `<Icon />`).
 */
import { createLucideIcon } from 'lucide-react-native';

/** Engagement ring: a band with a cut stone. Used for "days together". */
export const Ring = createLucideIcon('ring', [
  ['circle', { cx: '12', cy: '15', r: '6', key: 'band' }],
  ['path', { d: 'M9.5 3h5l2 2.5L12 9 7.5 5.5Z', key: 'stone' }],
  ['path', { d: 'M7.5 5.5h9', key: 'girdle' }],
]);

/** Tab bar: an arched house with its door (reads well both outlined and filled). */
export const HomeArch = createLucideIcon('home-arch', [
  ['path', { d: 'M5 21V11a7 7 0 0 1 14 0v10h-4.5v-5a2.5 2.5 0 0 0-5 0v5Z', key: 'house' }],
]);

/** Tab bar: two stacked cards. */
export const Cards = createLucideIcon('cards', [
  ['path', { d: 'M8.5 3.5H17a3.5 3.5 0 0 1 3.5 3.5v8.5', key: 'back' }],
  ['rect', { x: '3.5', y: '7', width: '13.5', height: '13.5', rx: '3.5', key: 'front' }],
]);
