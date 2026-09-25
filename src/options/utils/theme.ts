/**
 * Theme preference helpers shared by the synchronous `theme-init.js` bootstrap
 * (loaded in <head> to avoid a flash of the wrong theme) and the options page UI.
 */
export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'chatgpttoolkit.options.theme';
export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

type ThemeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Normalize any stored/user-provided value into a valid preference.
 * Unknown values fall back to `system`.
 */
export function parseThemePreference(value: unknown): ThemePreference {
  if (typeof value !== 'string') return 'system';
  const normalized = value.trim().toLowerCase();
  return (THEME_PREFERENCES as readonly string[]).includes(normalized)
    ? (normalized as ThemePreference)
    : 'system';
}

/**
 * Resolve a preference to the theme that is actually shown.
 */
export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}

/**
 * Value for `<html data-theme>`; `null` means "remove the attribute" (follow the system).
 */
export function getThemeAttribute(preference: ThemePreference): ResolvedTheme | null {
  return preference === 'system' ? null : preference;
}

export function readThemePreference(storage: Pick<Storage, 'getItem'> | null | undefined): ThemePreference {
  if (!storage) return 'system';
  try {
    return parseThemePreference(storage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

/**
 * Persist the preference. `system` is stored by removing the key so the default stays implicit.
 */
export function writeThemePreference(storage: ThemeStorage | null | undefined, preference: ThemePreference): boolean {
  if (!storage) return false;
  try {
    if (preference === 'system') {
      storage.removeItem(THEME_STORAGE_KEY);
    } else {
      storage.setItem(THEME_STORAGE_KEY, preference);
    }
    return true;
  } catch {
    return false;
  }
}

export function applyThemePreference(root: HTMLElement, preference: ThemePreference): void {
  const attribute = getThemeAttribute(preference);
  if (attribute) {
    root.dataset.theme = attribute;
  } else {
    delete root.dataset.theme;
  }
}
