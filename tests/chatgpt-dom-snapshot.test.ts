import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initChatGPT } from '../src/content/sites/chatgpt';
import { buildPrefixedText, hasPrefixText, type ContentContext } from '../src/content/context';
import { ensureHappyDom } from './utils/happyDom';

ensureHappyDom();

const snapshotPath = fileURLToPath(new URL('./fixtures/chatgpt/chatgpt.dom.html', import.meta.url));
const rawSnapshot = readFileSync(snapshotPath, 'utf8');
const sanitizedSnapshot = sanitizeSnapshot(rawSnapshot);
const originalLocation = globalThis.location;

function sanitizeSnapshot(html: string) {
  const withoutScripts = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  const match = withoutScripts.match(/<html[^>]*>([\s\S]*?)<\/html>/i);
  return match ? match[1] : withoutScripts;
}

function loadSnapshot() {
  document.documentElement.innerHTML = sanitizedSnapshot;
}

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

function createPromptUrlContext(options?: {
  prompt?: string;
  autoSubmit?: boolean;
  fillTextareaPreservingExistingText?: boolean;
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
      state.prompt = options?.prompt || '誰是保哥？';
      state.autoSubmit = options?.autoSubmit ?? true;
      state.pasteImage = false;
      state.tool = '';
      return state;
    },
    clearHash: () => {},
    fillContentEditableWithParagraphs: () => {},
    fillTextareaAndDispatchInput: (textarea, text, preserveExistingText = false) => {
      if (!textarea) return;
      const shouldPreserveExistingText =
        preserveExistingText || options?.fillTextareaPreservingExistingText === true;
      textarea.value = shouldPreserveExistingText
        ? hasPrefixText(textarea.value, text)
          ? textarea.value
          : buildPrefixedText(text, textarea.value)
        : text;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    },
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

function installChromeStub(customPrompts?: unknown[]) {
  const previousChrome = (globalThis as { chrome?: unknown }).chrome;
  (globalThis as { chrome?: unknown }).chrome = {
    i18n: {
      getUILanguage: () => 'zh-TW',
    },
    storage: {
      local: {
        get: (_keys: string[], callback: (items: Record<string, unknown>) => void) => {
          callback(
            customPrompts
              ? {
                  'chatgpttoolkit.customPrompts': customPrompts,
                }
              : {}
          );
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

function setChatGPTLocation(pathname: string) {
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: {
      hostname: 'chatgpt.com',
      href: `https://chatgpt.com${pathname}`,
      hash: '',
      search: '',
      pathname,
    },
  });
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

  globalThis.setInterval = (() => 0 as unknown as number) as typeof setInterval;
  globalThis.clearInterval = (() => {}) as typeof clearInterval;

  try {
    return run();
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
}

async function flushAsyncWork() {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
}

async function withQueuedIntervals<T>(run: (flushIntervals: () => Promise<void>) => T | Promise<T>) {
  const originalSetTimeout = globalThis.setTimeout;
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  const intervals: TimerHandler[] = [];
  const cleared = new Set<number>();

  globalThis.setTimeout = ((handler: TimerHandler, _timeout?: number, ...args: unknown[]) => {
    if (typeof handler === 'function') {
      handler(...args);
    }
    return 0 as unknown as number;
  }) as typeof setTimeout;

  globalThis.setInterval = ((handler: TimerHandler) => {
    intervals.push(handler);
    return intervals.length as unknown as number;
  }) as typeof setInterval;

  globalThis.clearInterval = ((id?: number) => {
    if (typeof id === 'number') cleared.add(id);
  }) as typeof clearInterval;

  const flushIntervals = async () => {
    for (let index = 0; index < intervals.length; index += 1) {
      const id = index + 1;
      if (cleared.has(id)) continue;
      const handler = intervals[index];
      if (typeof handler === 'function') {
        await handler();
      }
    }
  };

  try {
    return await run(flushIntervals);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
}

describe('chatgpt.com DOM snapshot', () => {
  beforeEach(() => {
    loadSnapshot();
    setChatGPTLocation('/');
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  test('loads expected shell elements from snapshot', () => {
    expect(document.querySelector('[data-testid="create-new-chat-button"]')).not.toBeNull();
    expect(document.querySelector('#stage-slideover-sidebar')).not.toBeNull();
  });

  test('initChatGPT does not inject buttons when composer is missing', async () => {
    const restoreChrome = installChromeStub();

    try {
      withPatchedTimers(() => {
        initChatGPT(createContentContext());
      });
      await flushAsyncWork();
      expect(document.getElementById('custom-chatgpt-initial-buttons')).toBeNull();
      expect(document.getElementById('custom-chatgpt-magic-box-buttons')).toBeNull();
    } finally {
      restoreChrome();
    }
  });

  test('fills URL prompt into textarea composer and auto submits', async () => {
    document.documentElement.innerHTML = `
      <head></head>
      <body>
        <form>
          <textarea placeholder="Ask anything"></textarea>
          <button type="button" aria-label="傳送提示詞"></button>
        </form>
      </body>
    `;

    let clickCalls = 0;
    document.querySelector('button')?.addEventListener('click', () => {
      clickCalls += 1;
    });
    const restoreChrome = installChromeStub();

    try {
      await withQueuedIntervals(async (flushIntervals) => {
        initChatGPT(createPromptUrlContext());
        await flushIntervals();
        await flushIntervals();
      });

      const textarea = document.querySelector<HTMLTextAreaElement>('textarea');
      expect(textarea?.value).toBe('誰是保哥？');
      expect(clickCalls).toBe(1);
    } finally {
      restoreChrome();
    }
  });

  test('fills URL prompt into textarea composer when existing text starts with a partial word match', async () => {
    document.documentElement.innerHTML = `
      <head></head>
      <body>
        <form>
          <textarea placeholder="Ask anything">hello</textarea>
          <button type="button" aria-label="傳送提示詞"></button>
        </form>
      </body>
    `;

    const restoreChrome = installChromeStub();

    try {
      await withQueuedIntervals(async (flushIntervals) => {
        initChatGPT(
          createPromptUrlContext({
            prompt: 'he',
            autoSubmit: false,
            fillTextareaPreservingExistingText: true,
          })
        );
        await flushIntervals();
        await flushIntervals();
      });

      const textarea = document.querySelector<HTMLTextAreaElement>('textarea');
      expect(textarea?.value).toBe('he\nhello');
    } finally {
      restoreChrome();
    }
  });

  test('injects initial buttons on chatgpt root page', async () => {
    document.documentElement.innerHTML = `
      <head></head>
      <body>
        <main>
          <form data-type="unified-composer">
            <textarea placeholder="Ask anything"></textarea>
            <button type="button" data-testid="composer-send-button"></button>
          </form>
        </main>
      </body>
    `;

    const restoreChrome = installChromeStub([
      {
        enabled: true,
        initial: true,
        title: '快速摘要',
        prompt: '請先幫我整理重點',
      },
    ]);

    try {
      withPatchedTimers(() => {
        initChatGPT(createContentContext());
      });
      await flushAsyncWork();

      const bar = document.getElementById('custom-chatgpt-initial-buttons');
      expect(bar).not.toBeNull();
      expect(bar?.textContent).toContain('快速摘要');
    } finally {
      restoreChrome();
    }
  });

  test('skips initial buttons on excluded chatgpt pages', async () => {
    for (const pathname of ['/scheduled', '/deep-research']) {
      setChatGPTLocation(pathname);
      document.documentElement.innerHTML = `
        <head></head>
        <body>
          <main>
            <form data-type="unified-composer">
              <textarea placeholder="Ask anything"></textarea>
              <button type="button" data-testid="composer-send-button"></button>
            </form>
          </main>
        </body>
      `;

      const staleBar = document.createElement('div');
      staleBar.id = 'custom-chatgpt-initial-buttons';
      document.body.appendChild(staleBar);

      const restoreChrome = installChromeStub([
        {
          enabled: true,
          initial: true,
          title: '快速摘要',
          prompt: '請先幫我整理重點',
        },
      ]);

      try {
        withPatchedTimers(() => {
          initChatGPT(createContentContext());
        });
        await flushAsyncWork();

        expect(document.getElementById('custom-chatgpt-initial-buttons')).toBeNull();
      } finally {
        restoreChrome();
      }
    }
  });
});
