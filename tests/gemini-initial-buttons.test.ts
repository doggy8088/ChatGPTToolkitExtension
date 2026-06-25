import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { initGemini } from '../src/content/sites/gemini';
import type { ContentContext } from '../src/content/context';
import { ensureHappyDom } from './utils/happyDom';

ensureHappyDom();

const originalLocation = globalThis.location;

function createContentContext(): ContentContext {
  return {
    debug: false,
    state: {
      prompt: '',
      autoSubmit: false,
      pasteImage: false,
      tool: '',
      pastingImage: false,
    },
    refreshParamsFromHash: () => null,
    clearHash: () => {},
    fillContentEditableWithParagraphs: () => {},
    fillTextareaAndDispatchInput: () => {},
    startRetryInterval: () => 0,
    delay: async () => {},
    fetchClipboardImageAndSimulatePaste: async () => false,
  };
}

function createPromptFillContext(options?: {
  prompt?: string;
  autoSubmit?: boolean;
  pasteImage?: boolean;
  tool?: string;
  onClearHash?: () => void;
}): ContentContext {
  const state = {
    prompt: '',
    autoSubmit: false,
    pasteImage: false,
    tool: '',
    pastingImage: false,
  };

  return {
    debug: false,
    state,
    refreshParamsFromHash: () => {
      state.prompt = options?.prompt || '';
      state.autoSubmit = options?.autoSubmit === true;
      state.pasteImage = options?.pasteImage === true;
      state.tool = options?.tool || '';
      return state;
    },
    clearHash: () => {
      options?.onClearHash?.();
    },
    fillContentEditableWithParagraphs: (target, text) => {
      if (!target) return;
      const lines = (text || '').split('\n');
      target.innerHTML = '';
      lines.forEach((line) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = line;
        target.appendChild(paragraph);
      });
    },
    fillTextareaAndDispatchInput: () => {},
    startRetryInterval: ({ retries = 10, tick }) => {
      void (async () => {
        for (let attempt = 0; attempt < retries; attempt++) {
          if (await tick()) break;
        }
      })();

      return 0;
    },
    delay: async () => {},
    fetchClipboardImageAndSimulatePaste: async () => false,
  };
}

function installChromeStub() {
  const previousChrome = (globalThis as { chrome?: unknown }).chrome;
  (globalThis as { chrome?: unknown }).chrome = {
    i18n: {
      getUILanguage: () => 'zh-TW',
    },
    storage: {
      local: {
        get: (_keys: string[], callback: (items: Record<string, unknown>) => void) => {
          callback({
            'chatgpttoolkit.customPrompts': [
              {
                enabled: true,
                initial: true,
                title: '快速摘要',
                prompt: '請先幫我整理重點',
              },
            ],
          });
        },
        set: (_items: Record<string, unknown>, callback?: () => void) => {
          callback?.();
        },
      },
      onChanged: {
        addListener: () => {},
      },
    },
  };

  return () => {
    (globalThis as { chrome?: unknown }).chrome = previousChrome;
  };
}

function withPatchedTimers<T>(run: () => T) {
  const originalSetTimeout = globalThis.setTimeout;
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;

  globalThis.setTimeout = ((handler: TimerHandler, _timeout?: number, ...args: unknown[]) => {
    if (typeof handler === 'function') {
      handler(...args);
    }
    return 0 as unknown as number;
  }) as typeof setTimeout;

  globalThis.setInterval = (() => 0) as any;
  globalThis.clearInterval = (() => {}) as typeof clearInterval;

  try {
    return run();
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
}

function loadDom(bodyHtml: string) {
  document.documentElement.innerHTML = `<head></head><body>${bodyHtml}</body>`;
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: {
      hostname: 'gemini.google.com',
      hash: '',
      search: '',
      pathname: '/app',
    },
  });
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('gemini initial buttons', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>';
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: {
        hostname: 'gemini.google.com',
        hash: '',
        search: '',
        pathname: '/app',
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  test('injects initial buttons into modular zero state', async () => {
    loadDom(`
      <modular-zero-state>
        <div class="bottom-section-container">
          <div class="zero-state-block-container">
            <intent-chips-block></intent-chips-block>
          </div>
        </div>
      </modular-zero-state>
      <input-container>
        <rich-textarea>
          <div class="ql-editor"></div>
        </rich-textarea>
      </input-container>
    `);

    const restoreChrome = installChromeStub();

    try {
      withPatchedTimers(() => {
        initGemini(createContentContext());
      });

      await flushAsyncWork();

      const bar = document.getElementById('custom-gemini-initial-buttons');
      expect(bar).not.toBeNull();
      expect(bar?.children.length).toBeGreaterThanOrEqual(1);
      expect(bar?.textContent).toContain('快速摘要');
      expect(bar?.nextElementSibling?.tagName.toLowerCase()).toBe('intent-chips-block');
    } finally {
      restoreChrome();
    }
  });

  test('injects initial buttons into gem vm zero state', async () => {
    loadDom(`
      <div class="zero-state-container bot-info-card-container">
        <bot-info-card></bot-info-card>
        <bot-experiment-disclaimer></bot-experiment-disclaimer>
      </div>
      <input-container>
        <rich-textarea>
          <div class="ql-editor"></div>
        </rich-textarea>
      </input-container>
    `);

    const restoreChrome = installChromeStub();

    try {
      withPatchedTimers(() => {
        initGemini(createContentContext());
      });

      await flushAsyncWork();

      const zeroState = document.querySelector<HTMLElement>('.zero-state-container.bot-info-card-container');
      const bar = document.getElementById('custom-gemini-initial-buttons');
      expect(zeroState).not.toBeNull();
      expect(bar).not.toBeNull();
      expect(bar?.parentElement).toBe(zeroState);
      expect(bar?.nextElementSibling?.tagName.toLowerCase()).toBe('bot-experiment-disclaimer');
    } finally {
      restoreChrome();
    }
  });

  test('fills prompt on gem path ql-editor and clears hash when auto submit is disabled', async () => {
    loadDom(`
      <input-container>
        <rich-textarea>
          <div class="ql-editor" contenteditable="true" role="textbox"><p>既有內容</p></div>
        </rich-textarea>
      </input-container>
    `);

    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: {
        hostname: 'gemini.google.com',
        hash: '#autoSubmit=false&pasteImage=false&prompt=%E4%BD%A0%E5%A5%BD',
        search: '',
        pathname: '/gem/aa913d33c700',
      },
    });

    let clearHashCalls = 0;
    const restoreChrome = installChromeStub();

    try {
      initGemini(
        createPromptFillContext({
          prompt: '你好',
          onClearHash: () => {
            clearHashCalls += 1;
          },
        })
      );

      await flushAsyncWork();

      const editor = document.querySelector<HTMLElement>('input-container rich-textarea .ql-editor');
      expect(editor).not.toBeNull();
      expect(editor?.children.length).toBe(2);
      expect(editor?.children[0].textContent).toBe('你好');
      expect(editor?.children[1].textContent).toBe('既有內容');
      expect(clearHashCalls).toBe(1);
    } finally {
      restoreChrome();
    }
  });
});