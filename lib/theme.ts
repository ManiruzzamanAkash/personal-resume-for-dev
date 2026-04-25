'use client';

import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

/**
 * Theme hook with a hydration-safe initial value. The server can't read
 * localStorage or `prefers-color-scheme`, so render starts with 'light'
 * (matching the `data-theme="light"` baked into <html>), then we read
 * the real preference in useEffect. The inline script in app/layout.tsx
 * <head> sets the correct `data-theme` on <html> *before* hydration —
 * so CSS picks up the right palette on first paint and only the toggle
 * icon briefly flickers (and only if user-preference != 'light').
 *
 * `mounted` lets consumers gate theme-dependent markup (e.g. sun/moon
 * icon swap) until after first commit, avoiding any visible flicker.
 */
export const useTheme = (): {
  theme: Theme;
  setTheme: (t: Theme) => void;
  mounted: boolean;
} => {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem('theme');
    const resolved: Theme =
      stored === 'light' || stored === 'dark'
        ? stored
        : window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    setTheme(resolved);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('theme', theme);
  }, [theme, mounted]);

  return { theme, setTheme, mounted };
};
