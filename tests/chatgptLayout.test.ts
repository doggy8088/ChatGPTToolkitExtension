import { afterEach, describe, expect, test } from 'bun:test';
import { CHATGPT_WIDTH_KEY, parseChatGPTWidth, saveChatGPTWidth, watchChatGPTWidth } from '../src/shared/chatgptLayout';
import { applyChatGPTWidth, CHATGPT_LAYOUT_STYLE_ID, initChatGPTLayout } from '../src/content/sites/chatgptLayout';
import { ensureHappyDom } from './utils/happyDom';

ensureHappyDom();
const originalChrome = globalThis.chrome;
afterEach(() => {
  globalThis.chrome = originalChrome;
  document.getElementById(CHATGPT_LAYOUT_STYLE_ID)?.remove();
});

function storageStub(value: unknown) {
  let listener: (changes: Record<string, { newValue?: unknown }>, area: string) => void = () => {};
  let finishRead: () => void = () => {};
  const api = {
    runtime: { lastError: undefined as { message: string } | undefined },
    storage: {
      local: {
        get(_keys: string[], callback: (items: Record<string, unknown>) => void) {
          finishRead = () => callback({ [CHATGPT_WIDTH_KEY]: value });
        },
        set(_items: unknown, callback: () => void) { callback(); },
      },
      onChanged: { addListener(fn: typeof listener) { listener = fn; } },
    },
  };
  globalThis.chrome = api as unknown as typeof chrome;
  return {
    api,
    finishRead: () => finishRead(),
    change: (next: unknown, area = 'local') => listener({ [CHATGPT_WIDTH_KEY]: { newValue: next } }, area),
  };
}

describe('ChatGPT conversation layout', () => {
  test('accepts only supported widths and safely defaults for malformed storage', () => {
    for (const value of ['default', '60', '80', '100']) expect(parseChatGPTWidth(value)).toBe(value);
    for (const value of [undefined, null, {}, 80, '90', '80; color: red']) expect(parseChatGPTWidth(value)).toBe('default');
  });

  test('loads saved width, updates open tabs, and removes overrides on reset or deletion', () => {
    const stub = storageStub('80');
    initChatGPTLayout();
    stub.finishRead();
    const style = () => document.getElementById(CHATGPT_LAYOUT_STYLE_ID);
    expect(style()?.textContent).toContain('80cqw');
    stub.change('60', 'sync');
    expect(style()?.textContent).toContain('80cqw');
    stub.change('100');
    expect(style()?.textContent).toContain('100cqw');
    expect(document.querySelectorAll(`#${CHATGPT_LAYOUT_STYLE_ID}`).length).toBe(1);
    stub.change('default');
    expect(style()).toBeNull();
    stub.change('60');
    expect(style()?.textContent).toContain('60cqw');
    stub.change(undefined);
    expect(style()).toBeNull();
  });

  test('does not let a delayed initial read undo a newer setting', () => {
    const stub = storageStub('60');
    const widths: string[] = [];
    watchChatGPTWidth((width) => widths.push(width), () => {});
    stub.change('100');
    stub.finishRead();
    expect(widths).toEqual(['100']);
  });

  test('reports storage failures instead of claiming the setting was saved', async () => {
    const stub = storageStub('80');
    stub.api.runtime.lastError = { message: 'Storage unavailable' };
    const errors: unknown[] = [];
    watchChatGPTWidth(() => { throw new Error('must not apply on read failure'); }, (error) => errors.push(error));
    stub.finishRead();
    expect(errors).toHaveLength(1);
    await expect(saveChatGPTWidth('80')).rejects.toThrow('Storage unavailable');
  });

  test('limits overrides to desktop and leaves default pages untouched', () => {
    applyChatGPTWidth('default');
    expect(document.getElementById(CHATGPT_LAYOUT_STYLE_ID)).toBeNull();
    applyChatGPTWidth('80');
    expect(document.getElementById(CHATGPT_LAYOUT_STYLE_ID)?.textContent).toContain('@media screen and (min-width: 768px)');
  });

  test('app-shell width rules match both the conversation and its sibling composer', () => {
    const main = document.createElement('main');
    main.dataset.appShellMainSurface = 'browser';
    main.innerHTML = '<div data-thread-find-target="conversation"></div><form data-chatgpt-composer></form>';
    document.body.appendChild(main);
    try {
      applyChatGPTWidth('80');
      const style = document.getElementById(CHATGPT_LAYOUT_STYLE_ID) as HTMLStyleElement;
      const media = style.sheet!.cssRules[0] as CSSMediaRule;
      const widthRule = Array.from(media.cssRules).find((rule) => (rule as CSSStyleRule).style?.getPropertyValue('max-width')) as CSSStyleRule;
      const matches = Array.from(main.querySelectorAll(widthRule.selectorText));
      expect(matches).toEqual([main.firstElementChild, main.lastElementChild]);
      expect(widthRule.style.getPropertyValue('max-width')).toContain('80cqw');
    } finally {
      main.remove();
    }
  });
});
