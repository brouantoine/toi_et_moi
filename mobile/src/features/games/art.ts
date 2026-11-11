/**
 * Illustrations (Fluent Emoji 3D, Microsoft, MIT licence) and hue of every topic and
 * kind of game. Images, never emoji characters: identical on iOS and Android.
 */
import type { Hue } from '@/ui';

type Art = { image: number; hue: Hue };

const E = {
  warmup: require('../../../assets/emoji/warmup.png'),
  relationship: require('../../../assets/emoji/relationship.png'),
  intimacy: require('../../../assets/emoji/intimacy.png'),
  fire: require('../../../assets/emoji/intimacy.png'),
  food: require('../../../assets/emoji/food.png'),
  money: require('../../../assets/emoji/money.png'),
  knowyou: require('../../../assets/emoji/knowyou.png'),
  travel: require('../../../assets/emoji/travel.png'),
  family: require('../../../assets/emoji/family.png'),
  hobbies: require('../../../assets/emoji/hobbies.png'),
  work: require('../../../assets/emoji/work.png'),
  lifestyle: require('../../../assets/emoji/lifestyle.png'),
  values: require('../../../assets/emoji/values.png'),
  versus: require('../../../assets/emoji/versus.png'),
  agree: require('../../../assets/emoji/agree.png'),
  never: require('../../../assets/emoji/never.png'),
  rather: require('../../../assets/emoji/rather.png'),
  most: require('../../../assets/emoji/most.png'),
  conversation: require('../../../assets/emoji/conversation.png'),
  heart: require('../../../assets/emoji/heart.png'),
  camera: require('../../../assets/emoji/camera.png'),
  calendar: require('../../../assets/emoji/calendar.png'),
  memo: require('../../../assets/emoji/memo.png'),
  robot: require('../../../assets/emoji/robot.png'),
  phone: require('../../../assets/emoji/phone.png'),
  crown: require('../../../assets/emoji/crown.png'),
  compass: require('../../../assets/emoji/compass.png'),
  ring: require('../../../assets/emoji/ring.png'),
  future: require('../../../assets/emoji/future.png'),
  us: require('../../../assets/emoji/us.png'),
  fun: require('../../../assets/emoji/fun.png'),
  draw: require('../../../assets/emoji/draw.png'),
  photo: require('../../../assets/emoji/photo.png'),
} as const;

export const EMOJI = E;

const FALLBACK: Art = { image: E.heart, hue: 'red' };

const TOPICS: Record<string, Art> = {
  deep: { image: E.conversation, hue: 'violet' },
  before: { image: E.calendar, hue: 'sage' },
  relationship: { image: E.relationship, hue: 'red' },
  intimacy: { image: E.intimacy, hue: 'red' },
  food: { image: E.food, hue: 'amber' },
  money: { image: E.money, hue: 'sage' },
  knowyou: { image: E.knowyou, hue: 'lagoon' },
  travel: { image: E.travel, hue: 'lagoon' },
  family: { image: E.family, hue: 'sage' },
  hobbies: { image: E.hobbies, hue: 'violet' },
  work: { image: E.work, hue: 'violet' },
  lifestyle: { image: E.lifestyle, hue: 'amber' },
  values: { image: E.values, hue: 'amber' },
  future: { image: E.future, hue: 'violet' },
  us: { image: E.us, hue: 'red' },
  fun: { image: E.fun, hue: 'lagoon' },
};

const KINDS: Record<string, Art> = {
  most_likely: { image: E.most, hue: 'amber' },
  draw: { image: E.draw, hue: 'red' },
  this_or_that: { image: E.versus, hue: 'sage' },
  never: { image: E.never, hue: 'lagoon' },
  rather: { image: E.rather, hue: 'violet' },
  conversation: { image: E.conversation, hue: 'violet' },
  agree: { image: E.agree, hue: 'sage' },
  photo: { image: E.photo, hue: 'lagoon' },
};

const CYCLE: readonly Hue[] = ['violet', 'lagoon', 'amber', 'red', 'sage'];

/** Packs of a list take turns among the hues, like a deck of coloured cards. */
export const packHue = (pack: { position: number; kind: string }): Hue =>
  CYCLE[(pack.position + Object.keys(KINDS).indexOf(pack.kind) * 2) % CYCLE.length] ?? 'red';

export const topicArt = (slug: string): Art => TOPICS[slug] ?? FALLBACK;
export const kindArt = (slug: string): Art => KINDS[slug] ?? FALLBACK;
