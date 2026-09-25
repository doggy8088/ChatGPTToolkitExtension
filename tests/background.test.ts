import { describe, test, expect, beforeAll, beforeEach } from 'bun:test';
import { loadMessages } from './utils/messages';

const EXTENSION_ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const BUILDER_URL = `${EXTENSION_ORIGIN}/link-builder.html`;
const t = loadMessages('zh_TW');

type Listener = (...args: any[]) => unknown;
const listeners: Record<string, Listener[]> = {};
const calls: Array<[string, ...unknown[]]> = [];
let contexts: Array<Partial<chrome.runtime.ExtensionContext>> | null = [];
let failCreateWithPlacement = false;

const event = (name: string) => ({ addListener: (listener: Listener) => (listeners[name] ??= []).push(listener) });
const fire = async (name: string, ...args: unknown[]) => {
  (listeners[name] ?? []).forEach((listener) => listener(...args));
  await new Promise((done) => setTimeout(done, 0));
};

function installChromeStub(): void {
  (globalThis as any).chrome = {
    i18n: { getMessage: t },
    action: { onClicked: event('action.onClicked') },
    contextMenus: {
      onClicked: event('contextMenus.onClicked'),
      removeAll: (callback: () => void) => {
        calls.push(['contextMenus.removeAll']);
        callback();
      },
      create: (properties: unknown, callback?: () => void) => {
        calls.push(['contextMenus.create', properties]);
        callback?.();
      },
    },
    runtime: {
      lastError: undefined,
      onInstalled: event('runtime.onInstalled'),
      onStartup: event('runtime.onStartup'),
      getURL: (path: string) => `${EXTENSION_ORIGIN}/${path}`,
      openOptionsPage: async () => void calls.push(['runtime.openOptionsPage']),
      get getContexts() {
        if (contexts === null) return undefined;
        return async (filter: unknown) => {
          calls.push(['runtime.getContexts', filter]);
          return contexts;
        };
      },
    },
    tabs: {
      create: async (properties: Record<string, unknown>) => {
        calls.push(['tabs.create', properties]);
        if (failCreateWithPlacement && 'index' in properties) throw new Error('cannot place tab');
        return { id: 99 };
      },
      update: async (tabId: number, properties: unknown) => void calls.push(['tabs.update', tabId, properties]),
    },
    windows: {
      update: async (windowId: number, properties: unknown) => void calls.push(['windows.update', windowId, properties]),
    },
  };
}

const callsOf = (name: string) => calls.filter(([callName]) => callName === name).map(([, ...args]) => args);

describe('background service worker', () => {
  beforeAll(async () => {
    installChromeStub();
    await import('../src/background/index');
  });

  beforeEach(() => {
    calls.length = 0;
    contexts = [];
    failCreateWithPlacement = false;
  });

  test('adds a localized "open link builder" item to the toolbar button menu', async () => {
    await fire('runtime.onInstalled', { reason: 'install' });
    expect(calls.map(([name]) => name)).toEqual(['contextMenus.removeAll', 'contextMenus.create']);
    expect(callsOf('contextMenus.create')[0][0]).toEqual({
      id: 'open-link-builder',
      title: t('context_menu_open_link_builder'),
      contexts: ['action'],
    });
  });

  test('recreates the menu on browser start without duplicating it', async () => {
    await fire('runtime.onStartup');
    expect(calls.map(([name]) => name)).toEqual(['contextMenus.removeAll', 'contextMenus.create']);
  });

  test('opens the link builder next to the current tab', async () => {
    await fire('contextMenus.onClicked', { menuItemId: 'open-link-builder' }, { id: 7, index: 2, windowId: 3 });
    expect(callsOf('runtime.getContexts')).toEqual([[{ contextTypes: ['TAB'] }]]);
    expect(callsOf('tabs.create')).toEqual([[{ url: BUILDER_URL, index: 3, openerTabId: 7, windowId: 3 }]]);
  });

  test('falls back to a plain new tab when it cannot be placed next to the current one', async () => {
    failCreateWithPlacement = true;
    await fire('contextMenus.onClicked', { menuItemId: 'open-link-builder' }, { id: 7, index: 2, windowId: 3 });
    expect(callsOf('tabs.create')).toEqual([[{ url: BUILDER_URL, index: 3, openerTabId: 7, windowId: 3 }], [{ url: BUILDER_URL }]]);
  });

  test('switches to an open link builder tab instead of opening another one', async () => {
    contexts = [
      { contextType: 'TAB', tabId: 11, windowId: 1, documentUrl: `${EXTENSION_ORIGIN}/options.html` },
      { contextType: 'TAB', tabId: 12, windowId: 2, documentUrl: `${BUILDER_URL}#prompt=hi` },
    ];
    await fire('contextMenus.onClicked', { menuItemId: 'open-link-builder' }, { id: 7, index: 2, windowId: 3 });
    expect(callsOf('tabs.update')).toEqual([[12, { active: true }]]);
    expect(callsOf('windows.update')).toEqual([[2, { focused: true }]]);
    expect(callsOf('tabs.create')).toEqual([]);
  });

  test('works without runtime.getContexts (older browsers)', async () => {
    contexts = null;
    await fire('contextMenus.onClicked', { menuItemId: 'open-link-builder' });
    expect(callsOf('tabs.create')).toEqual([[{ url: BUILDER_URL }]]);
  });

  test('ignores other menu items', async () => {
    await fire('contextMenus.onClicked', { menuItemId: 'something-else' });
    expect(calls).toEqual([]);
  });

  test('the toolbar button still opens the options page', async () => {
    await fire('action.onClicked', { id: 1 });
    expect(callsOf('runtime.openOptionsPage')).toEqual([[]]);
  });
});
