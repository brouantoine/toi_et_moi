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
} as const;

export const EMOJI = E;

const FALLBACK: Art = { image: E.heart, hue: 'red' };

const TOPICS: Record<string, Art> = {
  warmup: { image: E.warmup, hue: 'violet' },
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
};

const KINDS: Record<string, Art> = {
  this_or_that: { image: E.versus, hue: 'sage' },
  agree: { image: E.agree, hue: 'violet' },
  never: { image: E.never, hue: 'lagoon' },
  rather: { image: E.rather, hue: 'amber' },
  most_likely: { image: E.most, hue: 'red' },
  conversation: { image: E.conversation, hue: 'violet' },
};

export const topicArt = (slug: string): Art => TOPICS[slug] ?? FALLBACK;
export const kindArt = (slug: string): Art => KINDS[slug] ?? FALLBACK;
