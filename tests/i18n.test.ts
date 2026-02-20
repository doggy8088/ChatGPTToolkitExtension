import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { getMessage } from '../src/options/utils/i18n';

describe('i18n', () => {
  let originalChrome: any;

  beforeEach(() => {
    // Save original chrome object
    originalChrome = (globalThis as any).chrome;
    // Clear chrome for each test to ensure isolation
    (globalThis as any).chrome = undefined;
  });

  afterEach(() => {
    // Restore chrome object
    (globalThis as any).chrome = originalChrome;
  });

  describe('getMessage', () => {
    test('should return key if chrome is undefined', () => {
      // chrome is already undefined from beforeEach
      expect(getMessage('test_key')).toBe('test_key');
    });

    test('should return key if chrome.i18n is undefined', () => {
      (globalThis as any).chrome = {};
      expect(getMessage('test_key')).toBe('test_key');
    });

    test('should return key if chrome.i18n.getMessage is undefined', () => {
      (globalThis as any).chrome = { i18n: {} };
      expect(getMessage('test_key')).toBe('test_key');
    });

    test('should return translated message when available', () => {
      const mockGetMessage = mock(() => 'Translated Message');
      (globalThis as any).chrome = {
        i18n: {
          getMessage: mockGetMessage
        }
      };

      expect(getMessage('test_key')).toBe('Translated Message');
      expect(mockGetMessage).toHaveBeenCalledWith('test_key', undefined);
    });

    test('should return key when translated message is empty string', () => {
      const mockGetMessage = mock(() => '');
      (globalThis as any).chrome = {
        i18n: {
          getMessage: mockGetMessage
        }
      };

      expect(getMessage('test_key')).toBe('test_key');
      expect(mockGetMessage).toHaveBeenCalledWith('test_key', undefined);
    });

    test('should return key when translated message is null', () => {
        // null is not a valid return type for getMessage strictly speaking but good to test robust fallback
        const mockGetMessage = mock(() => null);
        (globalThis as any).chrome = {
          i18n: {
            getMessage: mockGetMessage
          }
        };

        expect(getMessage('test_key')).toBe('test_key');
    });

    test('should pass substitutions to chrome.i18n.getMessage', () => {
      const mockGetMessage = mock(() => 'Hello World');
      (globalThis as any).chrome = {
        i18n: {
          getMessage: mockGetMessage
        }
      };

      const substitutions = ['World'];
      getMessage('greeting', substitutions);

      expect(mockGetMessage).toHaveBeenCalledWith('greeting', substitutions);
    });

    test('should handle single string substitution', () => {
        const mockGetMessage = mock(() => 'Hello World');
        (globalThis as any).chrome = {
          i18n: {
            getMessage: mockGetMessage
          }
        };

        const substitution = 'World';
        getMessage('greeting', substitution);

        expect(mockGetMessage).toHaveBeenCalledWith('greeting', substitution);
      });
  });
});
