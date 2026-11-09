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
