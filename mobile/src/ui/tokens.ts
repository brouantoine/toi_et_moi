/**
 * Design tokens. White and Bolingo red by day, red on black by night (the app follows the
 * phone's setting): white canvas, quiet grey fills, bold system titles and ONE accent
 * colour, chosen by each couple (see `accents`). The default red plays in shades, like
 * light through a window: `wash` at the top of the main screens, rose-red `primarySoft`
 * fills, deep red text on them (docs/DECISIONS.md, 2026-11-11).
 * Every text/background pair is checked for WCAG AA contrast in tests.
 */
export type ColorScheme = 'light' | 'dark';

export type Palette = {
  background: string;
  surface: string;
  /** Sunken fills: chips, search field, skeletons, photo placeholders. */
  surfaceMuted: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  /** Tinted accent fill and the text that sits on it. */
  primarySoft: string;
  onPrimarySoft: string;
  secondary: string;
  onSecondary: string;
  /** Tinted sage fill and the text that sits on it. */
  secondarySoft: string;
  onSecondarySoft: string;
  border: string;
  danger: string;
  /** Darkening veil over photos, under light text. */
  scrim: string;
  /** Text and icons on the scrim: light in both schemes. */
  onScrim: string;
  /** Colour wash at the top of the main screens, fading into the background. */
  wash: string;
  /** Bolingo red, whatever the couple's colour: the logo and the loader. */
  brand: string;
};

/** The accent-driven slots of the palette. */
export type AccentColors = Pick<
  Palette,
  'primary' | 'onPrimary' | 'primarySoft' | 'onPrimarySoft' | 'wash'
>;

export const ACCENT_IDS = ['rouge', 'ambre', 'sauge', 'lagon', 'bleu', 'violet', 'encre'] as const;
export type AccentId = (typeof ACCENT_IDS)[number];
export const DEFAULT_ACCENT: AccentId = 'rouge';

/** Couple colours, chosen in Settings. Each set is AA on white (light) and black (dark). */
export const accents: Record<AccentId, Record<ColorScheme, AccentColors>> = {
  rouge: {
    light: {
      primary: '#D0112B',
      onPrimary: '#FFFFFF',
      primarySoft: '#FFE1E6',
      onPrimarySoft: '#86101E',
      wash: '#FFD3DA',
    },
    dark: {
      // Red on black: the brand red, lifted just enough to read on the night surfaces.
      primary: '#FF3B4E',
      onPrimary: '#140405',
      primarySoft: '#4A1A1C',
      onPrimarySoft: '#FFB9B3',
      wash: '#4D0D17',
    },
  },
  ambre: {
    light: {
      primary: '#A34E00',
      onPrimary: '#FFFFFF',
      primarySoft: '#FDEBD3',
      onPrimarySoft: '#6E3300',
      wash: '#FFE3BF',
    },
    dark: {
      primary: '#FFB35C',
      onPrimary: '#1A0E00',
      primarySoft: '#42300F',
      onPrimarySoft: '#FFD9A0',
      wash: '#452B07',
    },
  },
  sauge: {
    light: {
      primary: '#3F6B47',
      onPrimary: '#FFFFFF',
      primarySoft: '#E2EEE0',
      onPrimarySoft: '#2C4A33',
      wash: '#D5EAD1',
    },
    dark: {
      primary: '#8FD19A',
      onPrimary: '#0B1A0E',
      primarySoft: '#1F3324',
      onPrimarySoft: '#BFE5C4',
      wash: '#1C3822',
    },
  },
  lagon: {
    light: {
      primary: '#0A6E78',
      onPrimary: '#FFFFFF',
      primarySoft: '#D6EEF0',
      onPrimarySoft: '#0B4C53',
      wash: '#CBEEF1',
    },
    dark: {
      primary: '#5ED6E0',
      onPrimary: '#04191B',
      primarySoft: '#0F3A3E',
      onPrimarySoft: '#A8EEF3',
      wash: '#0B3C42',
    },
  },
  bleu: {
    light: {
      primary: '#1F5FD1',
      onPrimary: '#FFFFFF',
      primarySoft: '#DFE9FB',
      onPrimarySoft: '#163F8C',
      wash: '#D4E2FF',
    },
    dark: {
      primary: '#7FA8FF',
      onPrimary: '#08142E',
      primarySoft: '#182A4D',
      onPrimarySoft: '#C3D5FF',
      wash: '#122757',
    },
  },
  violet: {
    light: {
      primary: '#6A3FC1',
      onPrimary: '#FFFFFF',
      primarySoft: '#ECE4F9',
      onPrimarySoft: '#482A86',
      wash: '#E4D8FB',
    },
    dark: {
      primary: '#B79BFF',
      onPrimary: '#160B33',
      primarySoft: '#2E2550',
      onPrimarySoft: '#DCCFFF',
      wash: '#2C1E59',
    },
  },
  encre: {
    light: {
      primary: '#1C1C1E',
      onPrimary: '#FFFFFF',
      primarySoft: '#EBEBEF',
      onPrimarySoft: '#1C1C1E',
      wash: '#E4E4EA',
    },
    dark: {
      primary: '#F2F2F7',
      onPrimary: '#1C1C1E',
      primarySoft: '#2C2C2E',
      onPrimarySoft: '#F2F2F7',
      wash: '#2A2A2E',
    },
  },
};

export function isAccentId(value: unknown): value is AccentId {
  return typeof value === 'string' && (ACCENT_IDS as readonly string[]).includes(value);
}

/** Static palettes use the default accent; the theme swaps in the couple's accent. */
export const palettes: Record<ColorScheme, Palette> = {
  light: {
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceMuted: '#F2F2F5',
    text: '#1C1C1E',
    // A shade darker than iOS grey so captions stay AA on the red wash and tinted cards.
    textMuted: '#5F5F64',
    ...accents[DEFAULT_ACCENT].light,
    secondary: '#4F6B52', // sage (deep)
    onSecondary: '#FFFFFF',
    secondarySoft: '#E2EEE0',
    onSecondarySoft: '#2C4A33',
    border: '#E5E5EA',
    danger: '#B3261E',
    scrim: 'rgba(0, 0, 0, 0.42)',
    onScrim: '#FFFFFF',
    brand: '#D0112B',
  },
  dark: {
    background: '#000000',
    surface: '#1C1C1E',
    surfaceMuted: '#2C2C2E',
    text: '#FFFFFF',
    textMuted: '#AEAEB4',
    ...accents[DEFAULT_ACCENT].dark,
    secondary: '#9DBBA0',
    onSecondary: '#14201A',
    secondarySoft: '#1F3324',
    onSecondarySoft: '#BFE5C4',
    border: '#38383A',
    danger: '#FF8A80',
    scrim: 'rgba(0, 0, 0, 0.5)',
    onScrim: '#FFFFFF',
    brand: '#FF3B4E',
  },
};

export function paletteFor(scheme: ColorScheme, accent: AccentId = DEFAULT_ACCENT): Palette {
  return { ...palettes[scheme], ...accents[accent][scheme] };
}

/**
 * Category hues: a small family of warm-to-cool accents used to tell kinds
 * of content apart at a glance, e.g. one hue per memory type. `fg` on `bg` is AA.
 */
export type Hue = 'red' | 'amber' | 'sage' | 'lagoon' | 'violet';
export type HueColors = { fg: string; bg: string };

export const hues: Record<ColorScheme, Record<Hue, HueColors>> = {
  light: {
    // Same rose-red shades as the default accent: one red family across the app.
    red: { fg: '#86101E', bg: '#FFE1E6' },
    amber: { fg: '#6E4300', bg: '#FCEBC8' },
    sage: { fg: '#32493A', bg: '#E2ECDF' },
    lagoon: { fg: '#0B5057', bg: '#D3ECEE' },
    violet: { fg: '#4A3478', bg: '#E9E3F5' },
  },
  dark: {
    red: { fg: '#FFB9B3', bg: '#4A1A1C' },
    amber: { fg: '#F6CD7C', bg: '#43320F' },
    sage: { fg: '#BCD5BE', bg: '#223027' },
    lagoon: { fg: '#9FE3E8', bg: '#123A3E' },
    violet: { fg: '#CFC1F2', bg: '#2F2547' },
  },
};

/**
 * Inks of the finger-drawing game, by index (answers store the index, not the colour).
 * Same in both schemes: a drawing looks the same to both partners.
 */
export const inks: readonly string[] = [
  '#1C1C1E',
  '#D0112B',
  '#F08A24',
  '#F2C94C',
  '#3BA55C',
  '#2F80ED',
  '#8E5CE6',
  '#EC6FA8',
];

/**
 * Elevation as `boxShadow` strings. Neutral and very diffuse in light mode; in dark
 * mode shadows are invisible, so surfaces separate by tone and a hairline instead.
 */
export type Elevation = { card: string; raised: string; hairline: boolean };

export const elevations: Record<ColorScheme, Elevation> = {
  light: {
    card: '0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.07)',
    raised: '0 2px 6px rgba(0, 0, 0, 0.06), 0 16px 40px rgba(0, 0, 0, 0.12)',
    hairline: false,
  },
  dark: {
    card: 'none',
    raised: '0 12px 32px rgba(0, 0, 0, 0.45)',
    hairline: true,
  },
};

export const spacing = { xxs: 2, xs: 4, sm: 8, smd: 12, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

export const radii = { sm: 8, md: 14, lg: 22, xl: 28, pill: 999 } as const;

/** Bundled display faces (loaded in the root layout). Falls back to the system font. */
export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayMedium: 'Fraunces_500Medium',
  displayItalic: 'Fraunces_400Regular_Italic',
} as const;

export const typography = {
  /** Hero moments only: onboarding, welcome, on-this-day. Bold system type, Apple-like. */
  display: { fontSize: 34, lineHeight: 41, fontWeight: '800', letterSpacing: -0.6 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.4 },
  heading: { fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.3 },
  /** Quotes and gentle asides: the one serif touch left (Fraunces italic). */
  quote: { fontSize: 20, lineHeight: 28, fontFamily: fonts.displayItalic },
  /** Long reading: a memory's story. */
  lead: { fontSize: 18, lineHeight: 29, fontWeight: '400' },
  body: { fontSize: 17, lineHeight: 26, fontWeight: '400' },
  label: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  /** Small uppercase eyebrow above a title or a group. */
  overline: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 1.2 },
} as const;

export type TypographyVariant = keyof typeof typography;

export const motion = {
  /** State feedback: press, toggle. */
  fast: 140,
  /** Element transitions: enter, exit. */
  base: 240,
  /** Press-in scale for tappable surfaces. */
  pressScale: 0.97,
} as const;

/** Minimum touch target (iOS HIG 44 pt, Material 48 dp). */
export const MIN_TOUCH_TARGET = 48;
