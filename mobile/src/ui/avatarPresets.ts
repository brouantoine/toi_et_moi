/**
 * Illustrated avatars (Fluent Emoji 3D, Microsoft, MIT licence), in four skin tones.
 * Ids are stored on the server (User.avatar_preset): never rename, only add.
 */
export const AVATAR_PRESETS: Record<string, number> = {
  'man-beard-dark': require('../../assets/avatars/man-beard-dark.png'),
  'man-beard-light': require('../../assets/avatars/man-beard-light.png'),
  'man-beard-medium': require('../../assets/avatars/man-beard-medium.png'),
  'man-beard-medium-dark': require('../../assets/avatars/man-beard-medium-dark.png'),
  'man-curly-hair-dark': require('../../assets/avatars/man-curly-hair-dark.png'),
  'man-curly-hair-light': require('../../assets/avatars/man-curly-hair-light.png'),
  'man-curly-hair-medium': require('../../assets/avatars/man-curly-hair-medium.png'),
  'man-curly-hair-medium-dark': require('../../assets/avatars/man-curly-hair-medium-dark.png'),
  'man-dark': require('../../assets/avatars/man-dark.png'),
  'man-light': require('../../assets/avatars/man-light.png'),
  'man-medium': require('../../assets/avatars/man-medium.png'),
  'man-medium-dark': require('../../assets/avatars/man-medium-dark.png'),
  'woman-curly-hair-dark': require('../../assets/avatars/woman-curly-hair-dark.png'),
  'woman-curly-hair-light': require('../../assets/avatars/woman-curly-hair-light.png'),
  'woman-curly-hair-medium': require('../../assets/avatars/woman-curly-hair-medium.png'),
  'woman-curly-hair-medium-dark': require('../../assets/avatars/woman-curly-hair-medium-dark.png'),
  'woman-dark': require('../../assets/avatars/woman-dark.png'),
  'woman-light': require('../../assets/avatars/woman-light.png'),
  'woman-medium': require('../../assets/avatars/woman-medium.png'),
  'woman-medium-dark': require('../../assets/avatars/woman-medium-dark.png'),
  'woman-with-headscarf-dark': require('../../assets/avatars/woman-with-headscarf-dark.png'),
  'woman-with-headscarf-light': require('../../assets/avatars/woman-with-headscarf-light.png'),
  'woman-with-headscarf-medium': require('../../assets/avatars/woman-with-headscarf-medium.png'),
  'woman-with-headscarf-medium-dark': require('../../assets/avatars/woman-with-headscarf-medium-dark.png'),
};

/** Picker layout: one row per person, one column per skin tone (dark first). */
export const AVATAR_PEOPLE = [
  'man-beard',
  'man-curly-hair',
  'man',
  'woman-curly-hair',
  'woman',
  'woman-with-headscarf',
] as const;
export const AVATAR_TONES = ['dark', 'medium-dark', 'medium', 'light'] as const;

export const presetId = (person: string, tone: string) => `${person}-${tone}`;
