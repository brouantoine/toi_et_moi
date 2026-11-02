import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { palettes, radii, spacing, typography, type ColorScheme, type Palette } from './tokens';

export type Theme = {
  scheme: ColorScheme;
  colors: Palette;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
};

export function buildTheme(scheme: ColorScheme): Theme {
  return { scheme, colors: palettes[scheme], spacing, radii, typography };
}

const ThemeContext = createContext<Theme>(buildTheme('light'));

type Props = {
  children: ReactNode;
  /** Force a scheme (tests, user preference). Defaults to the system setting. */
  scheme?: ColorScheme;
};

export function ThemeProvider({ children, scheme }: Props) {
  const system = useColorScheme();
  const resolved: ColorScheme = scheme ?? (system === 'dark' ? 'dark' : 'light');
  const theme = useMemo(() => buildTheme(resolved), [resolved]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
