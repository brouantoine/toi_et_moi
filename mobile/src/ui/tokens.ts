/**
 * Design tokens. Warm and sober palette: terracotta, cream, sage, ink.
 * Text/background pairs are checked for WCAG AA contrast in tests.
 *
 * Direction: a warm editorial journal. Serif display type (Fraunces) for titles,
 * the platform sans for everything read at length, paper-like surfaces with soft
 * warm shadows, tinted fills instead of hard borders.
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
  /** Tinted terracotta fill and the text that sits on it. */
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
    background: '#FBF6EF', // cream
    surface: '#FFFDFA', // paper
    surfaceMuted: '#F3ECE2',
    text: '#1F2430', // ink
    textMuted: '#585D69',
    primary: '#A84B35', // terracotta
    onPrimary: '#FFFFFF',
    primarySoft: '#F6E4DC',
    onPrimarySoft: '#7A3322',
    secondary: '#4F6B52', // sage (deep)
    onSecondary: '#FFFFFF',
    secondarySoft: '#E4ECE2',
    onSecondarySoft: '#32493A',
    border: '#E8DFD3',
    danger: '#A23B2C',
    scrim: 'rgba(20, 16, 12, 0.45)',
    onScrim: '#FFFFFF',
  },
  dark: {
    background: '#15171C',
    surface: '#1E2128',
    surfaceMuted: '#282B33',
    text: '#F3EDE4',
    textMuted: '#B4AEA5',
    primary: '#E08A6E',
    onPrimary: '#1A1310',
    primarySoft: '#3B2721',
    onPrimarySoft: '#F2BBA8',
    secondary: '#9DBBA0',
    onSecondary: '#14201A',
    secondarySoft: '#223027',
    onSecondarySoft: '#BCD5BE',
    border: '#2E323C',
    danger: '#F08B7A',
    scrim: 'rgba(0, 0, 0, 0.5)',
    onScrim: '#FFFFFF',
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
