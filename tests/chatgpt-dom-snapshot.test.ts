import { beforeEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initChatGPT } from '../src/content/sites/chatgpt';
import type { ContentContext } from '../src/content/context';
import { ensureHappyDom } from './utils/happyDom';

ensureHappyDom();

const snapshotPath = fileURLToPath(new URL('./fixtures/chatgpt/chatgpt.dom.html', import.meta.url));
const rawSnapshot = readFileSync(snapshotPath, 'utf8');
const sanitizedSnapshot = sanitizeSnapshot(rawSnapshot);

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

function installChromeStub() {
  const previousChrome = (globalThis as { chrome?: unknown }).chrome;
  (globalThis as { chrome?: unknown }).chrome = {
    i18n: {
      getUILanguage: () => 'zh-TW',
    },
    storage: {
      local: {
        get: (_keys: string[], callback: (items: Record<string, unknown>) => void) => {
          callback({});
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

describe('chatgpt.com DOM snapshot', () => {
  beforeEach(() => {
    loadSnapshot();
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
      await Promise.resolve();
      expect(document.getElementById('custom-chatgpt-initial-buttons')).toBeNull();
      expect(document.getElementById('custom-chatgpt-magic-box-buttons')).toBeNull();
    } finally {
      restoreChrome();
    }
  });
});
