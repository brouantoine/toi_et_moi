import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';

import {
  elevations,
  motion,
  palettes,
  radii,
  spacing,
  typography,
  type ColorScheme,
  type Elevation,
  type Palette,
} from './tokens';

export type Theme = {
  scheme: ColorScheme;
  colors: Palette;
  elevation: Elevation;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  motion: typeof motion;
};

export function buildTheme(scheme: ColorScheme): Theme {
  return {
    scheme,
    colors: palettes[scheme],
    elevation: elevations[scheme],
    spacing,
    radii,
    typography,
    motion,
  };
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

/** True when the user asked the system to reduce motion. Animations must then be skipped. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
