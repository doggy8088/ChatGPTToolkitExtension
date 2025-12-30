import { describe, test, expect } from 'bun:test';
import { escapeHtml, getProperty } from '../src/options/utils/helpers';

describe('helpers', () => {
  describe('escapeHtml', () => {
    test('should escape HTML special characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>'))
        .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    test('should escape ampersands', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    test('should escape single quotes', () => {
      expect(escapeHtml("It's a test")).toBe('It&#39;s a test');
    });

    test('should handle empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    test('should handle null and undefined', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });

    test('should handle strings without special characters', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });
  });

  describe('getProperty', () => {
    test('should return property value if it exists', () => {
      const obj = { enabled: true, title: 'Test' };
      expect(getProperty(obj, 'enabled', false)).toBe(true);
      expect(getProperty(obj, 'title', '')).toBe('Test');
    });

    test('should return default value if property does not exist', () => {
      const obj = { enabled: true } as any;
      expect(getProperty(obj, 'title', 'Default')).toBe('Default');
    });

    test('should return actual value even if undefined (hasOwnProperty behavior)', () => {
      const obj = { enabled: undefined } as any;
      // hasOwnProperty returns true for properties with undefined values
      expect(getProperty(obj, 'enabled', true)).toBe(undefined);
    });

    test('should handle boolean false values correctly', () => {
      const obj = { enabled: false };
      expect(getProperty(obj, 'enabled', true)).toBe(false);
    });

    test('should handle number zero values correctly', () => {
      const obj = { count: 0 };
      expect(getProperty(obj, 'count', 10)).toBe(0);
    });

    test('should handle empty string values correctly', () => {
      const obj = { text: '' };
      expect(getProperty(obj, 'text', 'default')).toBe('');
    });
  });
});
