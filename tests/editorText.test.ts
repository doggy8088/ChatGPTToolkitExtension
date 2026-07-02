import { describe, expect, test } from 'bun:test';
import { extractPromptEditorText } from '../src/content/editorText';
import { ensureHappyDom } from './utils/happyDom';

ensureHappyDom();

describe('extractPromptEditorText', () => {
  test('preserves soft line breaks inside paragraphs', () => {
    const editor = document.createElement('div');
    editor.innerHTML = '<p>first<br>second</p><p>third</p>';

    expect(extractPromptEditorText(editor)).toBe('first\nsecond\nthird');
  });

  test('reads textarea values directly', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'first\nsecond';

    expect(extractPromptEditorText(textarea)).toBe('first\nsecond');
  });
});
