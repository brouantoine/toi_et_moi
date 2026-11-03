/**
 * Design tokens. Passion red, warm cream, sage and ink: lively but never pink
 * (pink is the couple-app cliché the brief rules out, see docs/DECISIONS.md).
 * Every text/background pair is checked for WCAG AA contrast in tests.
 *
 * Direction: a warm editorial journal. Serif display type (Fraunces) for titles,
 * the platform sans for everything read at length, paper-like surfaces with soft
 * warm shadows, tinted fills instead of hard borders. Light tints lean peach, so
 * the red stays red and never turns pink.
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
  /** Tinted red fill and the text that sits on it. */
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
};

export const palettes: Record<ColorScheme, Palette> = {
  light: {
    background: '#FFF8F2', // warm cream
    surface: '#FFFFFF', // paper
    surfaceMuted: '#F7ECE3',
    text: '#231A16', // ink
    textMuted: '#62564F',
    primary: '#B3132B', // passion red
    onPrimary: '#FFFFFF',
    primarySoft: '#FCE3D8', // peach-leaning, never pink
    onPrimarySoft: '#7D0A1C',
    secondary: '#4F6B52', // sage (deep)
    onSecondary: '#FFFFFF',
    secondarySoft: '#E2ECDF',
    onSecondarySoft: '#32493A',
    border: '#EEDFD4',
    danger: '#9F1D1D',
    scrim: 'rgba(20, 12, 10, 0.45)',
    onScrim: '#FFFFFF',
  },
  dark: {
    background: '#16120F',
    surface: '#211B17',
    surfaceMuted: '#2E2620',
    text: '#F6EEE7',
    textMuted: '#C2B6AC',
    primary: '#FF5C5C',
    onPrimary: '#2E0505',
    primarySoft: '#4A1A16',
    onPrimarySoft: '#FFB7AC',
    secondary: '#9DBBA0',
    onSecondary: '#14201A',
    secondarySoft: '#223027',
    onSecondarySoft: '#BCD5BE',
    border: '#3A2F28',
    danger: '#FF8A80',
    scrim: 'rgba(0, 0, 0, 0.5)',
    onScrim: '#FFFFFF',
  },
};

/**
 * Category hues: a small family of warm-to-cool accents (no pink) used to tell kinds
 * of content apart at a glance, e.g. one hue per memory type. `fg` on `bg` is AA.
 */
export type Hue = 'red' | 'amber' | 'sage' | 'lagoon' | 'violet';
export type HueColors = { fg: string; bg: string };

export const hues: Record<ColorScheme, Record<Hue, HueColors>> = {
  light: {
    red: { fg: '#7D0A1C', bg: '#FCE3D8' },
    amber: { fg: '#6E4300', bg: '#FCEBC8' },
    sage: { fg: '#32493A', bg: '#E2ECDF' },
    lagoon: { fg: '#0B5057', bg: '#D3ECEE' },
    violet: { fg: '#4A3478', bg: '#E9E3F5' },
  },
  dark: {
    red: { fg: '#FFB7AC', bg: '#4A1A16' },
    amber: { fg: '#F6CD7C', bg: '#43320F' },
    sage: { fg: '#BCD5BE', bg: '#223027' },
    lagoon: { fg: '#9FE3E8', bg: '#123A3E' },
    violet: { fg: '#CFC1F2', bg: '#2F2547' },
  },
};

/**
 * Elevation as `boxShadow` strings. Warm-tinted, very diffuse in light mode; in dark
 * mode shadows are invisible, so surfaces separate by tone and a hairline instead.
 */
export type Elevation = { card: string; raised: string; hairline: boolean };

export const elevations: Record<ColorScheme, Elevation> = {
  light: {
    card: '0 1px 2px rgba(74, 46, 26, 0.05), 0 6px 20px rgba(74, 46, 26, 0.06)',
    raised: '0 2px 6px rgba(74, 46, 26, 0.08), 0 14px 36px rgba(74, 46, 26, 0.12)',
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
  /** Hero moments only: onboarding, welcome, on-this-day. */
  display: { fontSize: 36, lineHeight: 42, fontFamily: fonts.display, letterSpacing: -0.6 },
  title: { fontSize: 30, lineHeight: 36, fontFamily: fonts.display, letterSpacing: -0.4 },
  heading: { fontSize: 22, lineHeight: 28, fontFamily: fonts.displayMedium, letterSpacing: -0.2 },
  /** Quotes and gentle asides. */
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
