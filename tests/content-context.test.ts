import { beforeEach, describe, expect, test } from 'bun:test';
import {
  buildPrefixedText,
  createContentContext,
  normalizeComparableText,
  resolvePromptText,
} from '../src/content/context';
import { ensureHappyDom } from './utils/happyDom';

ensureHappyDom();

function installContentUtilsStub() {
  const previous = (window as typeof window & { ChatGPTToolkitContentUtils?: unknown })
    .ChatGPTToolkitContentUtils;

  (window as typeof window & { ChatGPTToolkitContentUtils?: unknown }).ChatGPTToolkitContentUtils = {
    parseToolkitHash: () => ({
      prompt: null,
      autoSubmit: false,
      pasteImage: false,
      tool: '',
    }),
  };

  return () => {
    (window as typeof window & { ChatGPTToolkitContentUtils?: unknown }).ChatGPTToolkitContentUtils = previous;
  };
}

describe('content context prompt composition', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('buildPrefixedText keeps existing text after the prefix', () => {
    expect(buildPrefixedText('前綴', '原文')).toBe('前綴\n原文');
    expect(buildPrefixedText('前綴\n', '原文')).toBe('前綴\n原文');
    expect(buildPrefixedText('', '原文')).toBe('原文');
  });

  test('resolvePromptText uses {{args}} when present and otherwise appends clipboard text', () => {
    expect(resolvePromptText('請評論：\n\n', '  剪貼簿內容  ')).toBe('請評論：\n\n剪貼簿內容');
    expect(resolvePromptText('前綴 {{args}} 後綴', '  剪貼簿內容  ')).toBe('前綴 剪貼簿內容 後綴');
  });

  test('normalizeComparableText normalizes whitespace consistently', () => {
    expect(normalizeComparableText(' \u00A0foo\n\tbar\u200B ')).toBe('foo bar');
  });

  test('content helpers preserve the existing content when requested', () => {
    const restoreUtils = installContentUtilsStub();

    try {
      const ctx = createContentContext();
      expect(ctx).not.toBeNull();
      if (!ctx) return;

      const editor = document.createElement('div');
      editor.setAttribute('contenteditable', 'true');
      editor.innerHTML = '<p>原文</p>';

      const textarea = document.createElement('textarea');
      textarea.value = '原文';

      ctx.fillContentEditableWithParagraphs(editor, '前綴', true);
      ctx.fillTextareaAndDispatchInput(textarea, '前綴', true);

      expect(editor.children.length).toBe(2);
      expect(editor.children[0].textContent).toBe('前綴');
      expect(editor.children[1].textContent).toBe('原文');
      expect(textarea.value).toBe('前綴\n原文');

      ctx.fillContentEditableWithParagraphs(editor, '前綴', true);
      ctx.fillTextareaAndDispatchInput(textarea, '前綴', true);

      expect(editor.children.length).toBe(2);
      expect(editor.children[0].textContent).toBe('前綴');
      expect(editor.children[1].textContent).toBe('原文');
      expect(textarea.value).toBe('前綴\n原文');
    } finally {
      restoreUtils();
    }
  });

  test('content helpers do not treat partial word matches as an existing prefix', () => {
    const restoreUtils = installContentUtilsStub();

    try {
      const ctx = createContentContext();
      expect(ctx).not.toBeNull();
      if (!ctx) return;

      const editor = document.createElement('div');
      editor.setAttribute('contenteditable', 'true');
      editor.innerHTML = '<p>hello</p>';

      const textarea = document.createElement('textarea');
      textarea.value = 'hello';

      ctx.fillContentEditableWithParagraphs(editor, 'he', true);
      ctx.fillTextareaAndDispatchInput(textarea, 'he', true);

      expect(editor.children.length).toBe(2);
      expect(editor.children[0].textContent).toBe('he');
      expect(editor.children[1].textContent).toBe('hello');
      expect(textarea.value).toBe('he\nhello');
    } finally {
      restoreUtils();
    }
  });

  test('content helpers prefer innerText for connected contenteditable elements', () => {
    const restoreUtils = installContentUtilsStub();

    try {
      const ctx = createContentContext();
      expect(ctx).not.toBeNull();
      if (!ctx) return;

      const editor = document.createElement('div');
      editor.setAttribute('contenteditable', 'true');
      editor.innerHTML = 'alpha<br>';
      Object.defineProperty(editor, 'innerText', {
        configurable: true,
        get: () => 'alpha',
      });
      document.body.appendChild(editor);

      ctx.fillContentEditableWithParagraphs(editor, 'alpha', true);

      expect(editor.children.length).toBe(1);
      expect(editor.children[0].textContent).toBe('alpha');
    } finally {
      restoreUtils();
    }
  });
});