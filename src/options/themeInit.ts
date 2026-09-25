import { getLocalStorage } from './utils/helpers';
import { applyThemePreference, readThemePreference } from './utils/theme';

/**
 * Classic (non-module) bootstrap loaded synchronously in <head>.
 * Applies the stored theme before first paint to avoid a flash of the wrong theme.
 */
try {
  applyThemePreference(document.documentElement, readThemePreference(getLocalStorage()));
} catch {
  // Fall back to the system theme.
}
