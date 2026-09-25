import { describe, test, expect } from 'bun:test';
import { byId, element, insertTextAtCaret, shortcutKbds, shortcutKeys, shortcutText } from '../src/options/utils/dom';
import { ensureHappyDom } from './utils/happyDom';

ensureHappyDom();

describe('dom helpers', () => {
  test('element() sets the class and text', () => {
    const node = element('span', 'badge', '<b>not html</b>');
    expect(node.tagName).toBe('SPAN');
    expect(node.className).toBe('badge');
    expect(node.textContent).toBe('<b>not html</b>');
    expect(node.children).toHaveLength(0);
  });

  test('insertTextAtCaret() replaces the selection and reports the change', () => {
    const field = element('textarea');
    document.body.append(field);
    field.value = 'Hello world';
    field.setSelectionRange(6, 11);
    const inputs: string[] = [];
    field.addEventListener('input', () => inputs.push(field.value));

    insertTextAtCaret(field, 'there');

    expect(field.value).toBe('Hello there');
    expect(field.selectionStart).toBe(11);
    expect(inputs).toEqual(['Hello there']);
    field.remove();
  });

  test('byId() returns required elements and reports missing ones', () => {
    const node = element('div');
    node.id = 'present';
    document.body.append(node);
    expect(byId('present')).toBe(node);
    expect(() => byId('absent')).toThrow('#absent');
    node.remove();
  });

  test.each([
    ['MacIntel', ['⌘', '⇧', 'B'], '⌘Z', ['⌘', 'Enter']],
    ['Win32', ['Ctrl', 'Shift', 'B'], 'Ctrl+Z', ['Ctrl', 'Enter']],
  ] as const)('shortcut labels on %s', (platform, withShift, text, kbds) => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'platform');
    Object.defineProperty(navigator, 'platform', { configurable: true, get: () => platform });
    try {
      expect(shortcutKeys('B', { shift: true })).toEqual([...withShift]);
      expect(shortcutText('Z')).toBe(text);
      expect(shortcutKbds('Enter').map((node) => [node.tagName, node.textContent])).toEqual(kbds.map((key) => ['KBD', key]));
    } finally {
      if (original) Object.defineProperty(navigator, 'platform', original);
      else delete (navigator as { platform?: string }).platform;
    }
  });
});
