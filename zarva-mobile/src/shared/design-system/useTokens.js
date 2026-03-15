/**
 * src/shared/design-system/useTokens.js
 * ZARVA Design System — Primary hook to access all design tokens.
 *
 * This is the canonical hook every screen and component should use.
 * It reads from ThemeProvider and exposes the full resolved theme
 * (colors, spacing, radius, shadows, typography) as a single object.
 *
 * Usage:
 *   const { colors, spacing, radius, shadows } = useTokens();
 */
import { useContext } from 'react';
import { ThemeContext } from './ThemeProvider';

/**
 * useTokens — Returns the full design token map for the active theme.
 * Throws if called outside of ThemeProvider.
 */
export const useTokens = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('[ZARVA] useTokens must be used inside <ThemeProvider>. Wrap your root navigator.');
  }
  return ctx.theme;
};

/**
 * useTheme — Returns the full theme context including setTheme and themeId.
 * Use this only when you need to change the active theme.
 */
export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('[ZARVA] useTheme must be used inside <ThemeProvider>. Wrap your root navigator.');
  }
  return ctx;
};

export default useTokens;
