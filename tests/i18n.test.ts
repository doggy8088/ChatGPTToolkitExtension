import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { getMessage } from '../src/options/utils/i18n';

describe('i18n', () => {
  const originalChrome = globalThis.chrome;

  beforeEach(() => {
    // Reset chrome global before each test
    // We don't restore here because we modify it in tests
    // But we should start clean
    (globalThis as any).chrome = undefined;
  });

  afterEach(() => {
    // Restore original chrome global after each test
    (globalThis as any).chrome = originalChrome;
  });

  describe('getMessage', () => {
    test('should return key when chrome is undefined', () => {
      (globalThis as any).chrome = undefined;
      expect(getMessage('testKey')).toBe('testKey');
    });

    test('should return key when chrome.i18n is undefined', () => {
      (globalThis as any).chrome = {};
      expect(getMessage('testKey')).toBe('testKey');
    });

    test('should return key when chrome.i18n.getMessage is undefined', () => {
      (globalThis as any).chrome = { i18n: {} };
      expect(getMessage('testKey')).toBe('testKey');
    });

    test('should return message from chrome.i18n.getMessage', () => {
      const getMessageMock = mock((key: string) => `Translated ${key}`);
      (globalThis as any).chrome = {
        i18n: {
          getMessage: getMessageMock
        }
      };

      expect(getMessage('hello')).toBe('Translated hello');
      expect(getMessageMock).toHaveBeenCalledWith('hello', undefined);
    });

    test('should return key when chrome.i18n.getMessage returns empty string', () => {
      const getMessageMock = mock(() => '');
      (globalThis as any).chrome = {
        i18n: {
          getMessage: getMessageMock
        }
      };

      expect(getMessage('hello')).toBe('hello');
    });

    test('should return key when chrome.i18n.getMessage returns null/undefined', () => {
      const getMessageMock = mock(() => null);
      (globalThis as any).chrome = {
        i18n: {
          getMessage: getMessageMock
        }
      };

      expect(getMessage('hello')).toBe('hello');
    });

    test('should pass substitutions to chrome.i18n.getMessage', () => {
      const getMessageMock = mock((key: string, subs: string[]) => `${key} ${subs.join(' ')}`);
      (globalThis as any).chrome = {
        i18n: {
          getMessage: getMessageMock
        }
      };

      expect(getMessage('hello', ['world'])).toBe('hello world');
      expect(getMessageMock).toHaveBeenCalledWith('hello', ['world']);
    });
  });
});
