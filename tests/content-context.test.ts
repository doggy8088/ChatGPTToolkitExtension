import { beforeEach, describe, expect, test } from 'bun:test';
import {
  buildPrefixedText,
  createContentContext,
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
});