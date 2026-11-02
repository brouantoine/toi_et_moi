/**
 * Design tokens. Warm and sober palette: terracotta, cream, sage, ink.
 * Text/background pairs are checked for WCAG AA contrast in tests.
 */
export type ColorScheme = 'light' | 'dark';

export type Palette = {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  secondary: string;
  onSecondary: string;
  border: string;
  danger: string;
};

export const palettes: Record<ColorScheme, Palette> = {
  light: {
    background: '#FBF6EF', // cream
    surface: '#FFFFFF',
    text: '#1F2430', // ink
    textMuted: '#585D69',
    primary: '#A84B35', // terracotta
    onPrimary: '#FFFFFF',
    secondary: '#4F6B52', // sage (deep)
    onSecondary: '#FFFFFF',
    border: '#E6DED3',
    danger: '#A23B2C',
  },
  dark: {
    background: '#15171C',
    surface: '#1F222A',
    text: '#F3EDE4',
    textMuted: '#B4AEA5',
    primary: '#E08A6E',
    onPrimary: '#1A1310',
    secondary: '#9DBBA0',
    onSecondary: '#14201A',
    border: '#2E323C',
    danger: '#F08B7A',
  },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

export const radii = { sm: 8, md: 14, lg: 22, pill: 999 } as const;

export const typography = {
  title: { fontSize: 30, lineHeight: 38, fontWeight: '700' },
  heading: { fontSize: 22, lineHeight: 30, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 26, fontWeight: '400' },
  label: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Minimum touch target (iOS HIG 44 pt, Material 48 dp). */
export const MIN_TOUCH_TARGET = 48;
