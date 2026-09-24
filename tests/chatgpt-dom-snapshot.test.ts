import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initChatGPT } from '../src/content/sites/chatgpt';
import type { ContentContext } from '../src/content/context';
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

function createPromptUrlContext(): ContentContext {
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
      state.prompt = '誰是保哥？';
      state.autoSubmit = true;
      state.pasteImage = false;
      state.tool = '';
      return state;
    },
    clearHash: () => {},
    fillContentEditableWithParagraphs: () => {},
    fillTextareaAndDispatchInput: (textarea, text) => {
      if (!textarea) return;
      textarea.value = text;
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

function createArgsResolutionContext(): ContentContext {
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
    fillTextareaAndDispatchInput: (textarea, text) => {
      if (!textarea) return;
      textarea.value = text;
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

function installClipboardStub(readText: () => string) {
  const navigatorRef = globalThis.navigator as Navigator & { clipboard?: unknown };
  const previousDescriptor = Object.getOwnPropertyDescriptor(navigatorRef, 'clipboard');

  Object.defineProperty(navigatorRef, 'clipboard', {
    configurable: true,
    value: {
      readText: () => Promise.resolve(readText()),
    },
  });

  return () => {
    if (previousDescriptor) {
      Object.defineProperty(navigatorRef, 'clipboard', previousDescriptor);
    } else {
      delete navigatorRef.clipboard;
    }
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

  test('skips initial buttons on non-root chatgpt pages', async () => {
    for (const pathname of [
      '/scheduled',
      '/deep-research',
      '/g/g-p-6aa3bbc864c08191a8dd67f0585b6b07-tie-wen-chan-sheng-qi/project',
      '/g/g-abc123-some-gpt',
      '/gpts',
      '/library',
      '/codex',
    ]) {
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

  test('auto paste button replaces {{args}} with clipboard content when input is empty', async () => {
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

    let clipboardReads = 0;
    const restoreClipboard = installClipboardStub(() => {
      clipboardReads += 1;
      return '剪貼簿內容';
    });
    const restoreChrome = installChromeStub([
      {
        enabled: true,
        initial: true,
        title: '快速摘要',
        prompt: '請摘要：{{args}}',
        autoPaste: true,
      },
    ]);

    try {
      withPatchedTimers(() => {
        initChatGPT(createArgsResolutionContext());
      });
      await flushAsyncWork();

      const button = document
        .getElementById('custom-chatgpt-initial-buttons')
        ?.querySelector<HTMLButtonElement>('button');
      expect(button).not.toBeNull();

      withPatchedTimers(() => {
        button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushAsyncWork();
      await flushAsyncWork();

      const textarea = document.querySelector<HTMLTextAreaElement>('textarea');
      expect(clipboardReads).toBe(1);
      expect(textarea?.value).toBe('請摘要：剪貼簿內容');
    } finally {
      restoreChrome();
      restoreClipboard();
    }
  });

  test('auto paste button replaces {{args}} with existing input content without reading clipboard', async () => {
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

    let clipboardReads = 0;
    const restoreClipboard = installClipboardStub(() => {
      clipboardReads += 1;
      return '剪貼簿內容';
    });
    const restoreChrome = installChromeStub([
      {
        enabled: true,
        initial: true,
        title: '快速摘要',
        prompt: '請摘要：{{args}}',
        autoPaste: true,
      },
    ]);

    try {
      withPatchedTimers(() => {
        initChatGPT(createArgsResolutionContext());
      });
      await flushAsyncWork();

      const textarea = document.querySelector<HTMLTextAreaElement>('textarea');
      expect(textarea).not.toBeNull();
      textarea!.value = '既有的輸入內容';

      const button = document
        .getElementById('custom-chatgpt-initial-buttons')
        ?.querySelector<HTMLButtonElement>('button');
      expect(button).not.toBeNull();

      withPatchedTimers(() => {
        button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushAsyncWork();
      await flushAsyncWork();

      expect(clipboardReads).toBe(0);
      expect(textarea?.value).toBe('請摘要：既有的輸入內容');
    } finally {
      restoreChrome();
      restoreClipboard();
    }
  });

  test('auto paste button preserves soft line breaks from existing editor content', async () => {
    document.documentElement.innerHTML = `
      <head></head>
      <body>
        <main>
          <form data-type="unified-composer">
            <div id="prompt-textarea" contenteditable="true" role="textbox">
              <p>第一行<br>第二行</p>
            </div>
            <button type="button" data-testid="composer-send-button"></button>
          </form>
        </main>
      </body>
    `;

    let clipboardReads = 0;
    const restoreClipboard = installClipboardStub(() => {
      clipboardReads += 1;
      return '剪貼簿內容';
    });
    const restoreChrome = installChromeStub([
      {
        enabled: true,
        initial: true,
        title: '快速摘要',
        prompt: '請摘要：{{args}}',
        autoPaste: true,
      },
    ]);

    try {
      withPatchedTimers(() => {
        initChatGPT(createArgsResolutionContext());
      });
      await flushAsyncWork();

      const button = document
        .getElementById('custom-chatgpt-initial-buttons')
        ?.querySelector<HTMLButtonElement>('button');
      expect(button).not.toBeNull();

      withPatchedTimers(() => {
        button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushAsyncWork();
      await flushAsyncWork();

      const editor = document.querySelector<HTMLElement>('#prompt-textarea');
      const paragraphs = Array.from(editor?.querySelectorAll('p') || []).map(
        (paragraph) => paragraph.textContent || ''
      );
      expect(clipboardReads).toBe(0);
      expect(paragraphs).toEqual(['請摘要：第一行', '第二行']);
    } finally {
      restoreChrome();
      restoreClipboard();
    }
  });
});

// Markup modelled on the logged-in chatgpt.com app shell (2026-09): a `form[data-chatgpt-composer]`
// composer with a ProseMirror editor, turns keyed by `data-turn-key`, messages keyed by
// `data-content-search-unit-key`, and the assistant action bar rendered next to the message column.
function renderAppShellConversation(options: {
  actionBar?: boolean;
  composerButton?: string;
  editForm?: boolean;
  codeLanguage?: string;
} = {}) {
  const {
    actionBar = true,
    composerButton = '<button type="submit" aria-label="Send"></button>',
    editForm = false,
    codeLanguage = 'Markdown',
  } = options;

  document.documentElement.innerHTML = `
    <head></head>
    <body>
      <main data-app-shell-main-surface="browser">
        <div data-thread-find-target="conversation">
          <div data-turn-key="u1">
            <div data-content-search-turn-key="fallback-turn-0">
              <div><div><div id="turn-column">
                <div>
                  <div id="user-section">
                    <h4>You said:</h4>
                    <div data-chatgpt-search-unit-key="fallback-turn-0:0:user">
                      <div data-content-search-unit-key="fallback-turn-0:0:user">
                        <div data-user-message-bubble="true"><div id="user-text" dir="auto">Hello there</div></div>
                        <div>
                          <span><button type="button" id="copy-message" aria-label="Copy message"></button></span>
                          <span><button type="button" id="edit-message" aria-label="Edit message"></button></span>
                        </div>
                      </div>
                    </div>
                    ${
                      editForm
                        ? `<form id="edit-form">
                            <div id="edit-editor" contenteditable="true" role="textbox" data-composer-markdown="" aria-label="Edit message"><p>Hello there</p></div>
                            <button type="button" id="edit-send">Send</button>
                          </form>`
                        : ''
                    }
                  </div>
                  <div>
                    <div data-content-search-unit-key="fallback-turn-0:2:assistant">
                      <h4 data-conversation-role="assistant">ChatGPT said:</h4>
                      <div data-markdown-text-style="assistant-message">
                        <div data-markdown-copy="code-block" id="code-block">
                          <div data-markdown-copy="exclude">
                            <div>${codeLanguage}</div>
                            <div><div><span><button type="button" aria-label="Copy"></button></span></div></div>
                          </div>
                          <div dir="ltr" id="code-content"><code># Fruits\n- Apple</code></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                ${
                  actionBar
                    ? `<div id="action-bar">
                        <span><button type="button" aria-label="Copy"></button></span>
                        <button type="button" aria-label="Regenerate response"></button>
                      </div>`
                    : ''
                }
              </div></div></div>
            </div>
          </div>
        </div>
        <form id="composer" data-composer-placement="thread" data-chatgpt-composer="">
          <div id="composer-editor" contenteditable="true" role="textbox" data-composer-markdown="" aria-label="Ask ChatGPT"><p></p></div>
          ${composerButton}
        </form>
      </main>
    </body>
  `;

  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', (event) => event.preventDefault());
  });
}

const followUpPrompt = {
  enabled: true,
  title: '繼續',
  prompt: '請繼續',
  autoSubmit: true,
};

describe('chatgpt.com app shell (2026)', () => {
  beforeEach(() => {
    setChatGPTLocation('/c/abc');
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  test('injects theme-aware initial buttons into the home composer', async () => {
    setChatGPTLocation('/');
    document.documentElement.innerHTML = `
      <head></head>
      <body>
        <main>
          <div><h1>Ready when you are.</h1></div>
          <form data-composer-placement="home" data-chatgpt-composer="">
            <div contenteditable="true" role="textbox" data-composer-markdown=""><p></p></div>
            <button type="button" aria-label="Start Voice"></button>
          </form>
        </main>
      </body>
    `;
    const restoreChrome = installChromeStub([
      { enabled: true, initial: true, title: '總結', prompt: '請總結：', altText: '總結內容' },
    ]);

    try {
      withPatchedTimers(() => {
        initChatGPT(createContentContext());
      });
      await flushAsyncWork();

      const bar = document.getElementById('custom-chatgpt-initial-buttons');
      expect(bar?.parentElement?.matches('form[data-chatgpt-composer]')).toBe(true);
      const button = bar?.querySelector<HTMLButtonElement>('button.chatgpttoolkit-btn');
      expect(button?.textContent).toBe('總結');
      expect(button?.title).toBe('總結內容');
      // Colors come from currentColor instead of a `.dark` class the new app no longer sets.
      expect(document.getElementById('custom-chatgpt-button-styles')?.textContent).toContain('currentColor');
    } finally {
      restoreChrome();
    }
  });

  test('hides initial buttons while a reply is streaming', async () => {
    setChatGPTLocation('/');
    document.documentElement.innerHTML = `
      <head></head>
      <body>
        <main>
          <form data-composer-placement="home" data-chatgpt-composer="">
            <div contenteditable="true" role="textbox" data-composer-markdown=""><p></p></div>
            <button type="button" aria-label="Stop"></button>
          </form>
        </main>
      </body>
    `;
    const restoreChrome = installChromeStub([
      { enabled: true, initial: true, title: '總結', prompt: '請總結：' },
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
  });

  test('adds follow-up buttons after the assistant action bar', async () => {
    renderAppShellConversation();
    const restoreChrome = installChromeStub([followUpPrompt]);

    try {
      withPatchedTimers(() => {
        initChatGPT(createContentContext());
      });
      await flushAsyncWork();

      const area = document.getElementById('custom-chatgpt-magic-box-buttons');
      expect(area).not.toBeNull();
      expect(area?.parentElement?.id).toBe('turn-column');
      expect(area?.previousElementSibling?.id).toBe('action-bar');
      expect(area?.textContent).toContain('繼續');
      // Prompts without altText must not get an "undefined" tooltip.
      expect(area?.querySelector('button')?.hasAttribute('title')).toBe(false);
    } finally {
      restoreChrome();
    }
  });

  test('waits for the action bar before adding follow-up buttons', async () => {
    renderAppShellConversation({ actionBar: false });
    const restoreChrome = installChromeStub([followUpPrompt]);

    try {
      withPatchedTimers(() => {
        initChatGPT(createContentContext());
      });
      await flushAsyncWork();

      expect(document.getElementById('custom-chatgpt-magic-box-buttons')).toBeNull();
    } finally {
      restoreChrome();
    }
  });

  test('skips follow-up buttons while the stop button is shown', async () => {
    renderAppShellConversation({ composerButton: '<button type="button" aria-label="Stop"></button>' });
    const restoreChrome = installChromeStub([followUpPrompt]);

    try {
      withPatchedTimers(() => {
        initChatGPT(createContentContext());
      });
      await flushAsyncWork();

      expect(document.getElementById('custom-chatgpt-magic-box-buttons')).toBeNull();
    } finally {
      restoreChrome();
    }
  });

  test('follow-up button fills and submits the composer, not an open inline edit form', async () => {
    renderAppShellConversation({ editForm: true });
    let composerSubmits = 0;
    let editSends = 0;
    document.querySelector('#composer button[type="submit"]')?.addEventListener('click', () => {
      composerSubmits += 1;
    });
    document.getElementById('edit-send')?.addEventListener('click', () => {
      editSends += 1;
    });
    const restoreChrome = installChromeStub([followUpPrompt]);

    try {
      withPatchedTimers(() => {
        initChatGPT(createArgsResolutionContext());
      });
      await flushAsyncWork();

      const button = document
        .getElementById('custom-chatgpt-magic-box-buttons')
        ?.querySelector<HTMLButtonElement>('button');
      expect(button).not.toBeNull();

      withPatchedTimers(() => {
        button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushAsyncWork();
      await flushAsyncWork();

      expect(document.getElementById('composer-editor')?.textContent).toBe('請繼續');
      expect(document.getElementById('edit-editor')?.textContent).toBe('Hello there');
      expect(composerSubmits).toBe(1);
      expect(editSends).toBe(0);
    } finally {
      restoreChrome();
    }
  });

  test('double-clicking a sent message clicks its edit button', async () => {
    renderAppShellConversation();
    let edits = 0;
    let copies = 0;
    document.getElementById('edit-message')?.addEventListener('click', () => {
      edits += 1;
    });
    document.getElementById('copy-message')?.addEventListener('click', () => {
      copies += 1;
    });
    const restoreChrome = installChromeStub([followUpPrompt]);

    try {
      withPatchedTimers(() => {
        initChatGPT(createContentContext());
      });
      document.getElementById('user-text')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

      expect(edits).toBe(1);
      expect(copies).toBe(0);
    } finally {
      restoreChrome();
    }
  });

  test('adds a mindmap toggle only to markdown code blocks', async () => {
    renderAppShellConversation();
    const restoreChrome = installChromeStub([followUpPrompt]);

    try {
      withPatchedTimers(() => {
        initChatGPT(createContentContext());
      });
      await flushAsyncWork();

      const header = document.querySelector('#code-block [data-markdown-copy="exclude"]');
      expect(header?.querySelector('button[aria-label="Mindmap"]')).not.toBeNull();
    } finally {
      restoreChrome();
    }

    renderAppShellConversation({ codeLanguage: 'Python' });
    const restoreChromeAgain = installChromeStub([followUpPrompt]);

    try {
      withPatchedTimers(() => {
        initChatGPT(createContentContext());
      });
      await flushAsyncWork();

      expect(document.querySelector('button[aria-label="Mindmap"]')).toBeNull();
    } finally {
      restoreChromeAgain();
    }
  });
});
