import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';

import {
  DEFAULT_ACCENT,
  elevations,
  hues,
  motion,
  paletteFor,
  radii,
  spacing,
  typography,
  type AccentId,
  type ColorScheme,
  type Elevation,
  type Hue,
  type HueColors,
  type Palette,
} from './tokens';

export type Theme = {
  scheme: ColorScheme;
  accent: AccentId;
  colors: Palette;
  hues: Record<Hue, HueColors>;
  elevation: Elevation;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  motion: typeof motion;
};

export function buildTheme(scheme: ColorScheme, accent: AccentId = DEFAULT_ACCENT): Theme {
  return {
    scheme,
    accent,
    colors: paletteFor(scheme, accent),
    hues: hues[scheme],
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
  /** The couple's colour (Settings). */
  accent?: AccentId;
};

export function ThemeProvider({ children, scheme, accent = DEFAULT_ACCENT }: Props) {
  const system = useColorScheme();
  const resolved: ColorScheme = scheme ?? (system === 'dark' ? 'dark' : 'light');
  const theme = useMemo(() => buildTheme(resolved, accent), [resolved, accent]);
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
