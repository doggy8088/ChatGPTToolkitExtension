import { describe, test, expect, beforeEach } from 'bun:test';
import {
  THEME_STORAGE_KEY,
  applyThemePreference,
  getThemeAttribute,
  parseThemePreference,
  readThemePreference,
  resolveTheme,
  writeThemePreference,
} from '../src/options/utils/theme';
import { ensureHappyDom } from './utils/happyDom';

ensureHappyDom();

function createMemoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    has: (key: string) => store.has(key),
  };
}

const throwingStorage = {
  getItem: () => { throw new Error('blocked'); },
  setItem: () => { throw new Error('blocked'); },
  removeItem: () => { throw new Error('blocked'); },
};

describe('theme', () => {
  describe('parseThemePreference', () => {
    test('accepts the three known preferences', () => {
      expect(parseThemePreference('system')).toBe('system');
      expect(parseThemePreference('light')).toBe('light');
      expect(parseThemePreference('dark')).toBe('dark');
    });

    test('normalizes case and whitespace', () => {
      expect(parseThemePreference('  DARK ')).toBe('dark');
    });

    test('falls back to system for unknown or non-string values', () => {
      expect(parseThemePreference('sepia')).toBe('system');
      expect(parseThemePreference('')).toBe('system');
      expect(parseThemePreference(null)).toBe('system');
      expect(parseThemePreference(undefined)).toBe('system');
      expect(parseThemePreference(1)).toBe('system');
    });
  });

  describe('resolveTheme', () => {
    test('system follows the OS preference', () => {
      expect(resolveTheme('system', true)).toBe('dark');
      expect(resolveTheme('system', false)).toBe('light');
    });

    test('explicit preferences ignore the OS preference', () => {
      expect(resolveTheme('light', true)).toBe('light');
      expect(resolveTheme('dark', false)).toBe('dark');
    });
  });

  describe('getThemeAttribute', () => {
    test('returns null for system so the attribute is removed', () => {
      expect(getThemeAttribute('system')).toBeNull();
      expect(getThemeAttribute('light')).toBe('light');
      expect(getThemeAttribute('dark')).toBe('dark');
    });
  });

  describe('readThemePreference / writeThemePreference', () => {
    test('defaults to system when nothing is stored', () => {
      expect(readThemePreference(createMemoryStorage())).toBe('system');
      expect(readThemePreference(null)).toBe('system');
    });

    test('round-trips light and dark', () => {
      const storage = createMemoryStorage();
      expect(writeThemePreference(storage, 'dark')).toBe(true);
      expect(storage.getItem(THEME_STORAGE_KEY)).toBe('dark');
      expect(readThemePreference(storage)).toBe('dark');
    });

    test('stores system by removing the key', () => {
      const storage = createMemoryStorage({ [THEME_STORAGE_KEY]: 'light' });
      expect(writeThemePreference(storage, 'system')).toBe(true);
      expect(storage.has(THEME_STORAGE_KEY)).toBe(false);
      expect(readThemePreference(storage)).toBe('system');
    });

    test('ignores invalid stored values', () => {
      expect(readThemePreference(createMemoryStorage({ [THEME_STORAGE_KEY]: 'neon' }))).toBe('system');
    });

    test('survives storage that throws', () => {
      expect(readThemePreference(throwingStorage)).toBe('system');
      expect(writeThemePreference(throwingStorage, 'dark')).toBe(false);
      expect(writeThemePreference(null, 'dark')).toBe(false);
    });
  });

  describe('applyThemePreference', () => {
    beforeEach(() => {
      delete document.documentElement.dataset.theme;
    });

    test('sets data-theme for explicit preferences', () => {
      applyThemePreference(document.documentElement, 'dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      applyThemePreference(document.documentElement, 'light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    test('removes data-theme for system', () => {
      document.documentElement.dataset.theme = 'dark';
      applyThemePreference(document.documentElement, 'system');
      expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    });
  });
});
