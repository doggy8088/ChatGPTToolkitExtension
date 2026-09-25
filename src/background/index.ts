/**
 * Service worker (built to scripts/background.js).
 * - Clicking the toolbar button opens the options page.
 * - The toolbar button's right-click menu opens the prompt link builder.
 */
const LINK_BUILDER_MENU_ID = 'open-link-builder';
const LINK_BUILDER_PAGE = 'link-builder.html';

const ignoreLastError = (): void => {
  void chrome.runtime.lastError;
};

/**
 * Menu items persist, so they are (re)created on install/update and on browser start,
 * which also picks up a changed browser language.
 */
function createContextMenus(): void {
  chrome.contextMenus.removeAll(() => {
    ignoreLastError();
    chrome.contextMenus.create(
      {
        id: LINK_BUILDER_MENU_ID,
        title: chrome.i18n.getMessage('context_menu_open_link_builder'),
        contexts: ['action'],
      },
      ignoreLastError
    );
  });
}

/** An open link builder tab, like `chrome.runtime.openOptionsPage()` reuses the options tab. */
async function findLinkBuilderTab(pageUrl: string): Promise<chrome.runtime.ExtensionContext | null> {
  if (typeof chrome.runtime.getContexts !== 'function') return null;
  try {
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['TAB'] });
    return contexts.find((context) => context.tabId >= 0 && context.documentUrl?.split('#')[0] === pageUrl) ?? null;
  } catch {
    return null;
  }
}

async function openLinkBuilder(openerTab?: chrome.tabs.Tab): Promise<void> {
  const pageUrl = chrome.runtime.getURL(LINK_BUILDER_PAGE);

  const existing = await findLinkBuilderTab(pageUrl);
  if (existing) {
    try {
      await chrome.tabs.update(existing.tabId, { active: true });
      await chrome.windows.update(existing.windowId, { focused: true });
      return;
    } catch {
      // The tab closed in the meantime; open a new one.
    }
  }

  // Open next to the tab the menu was used on.
  if (openerTab && openerTab.id !== undefined && openerTab.id >= 0) {
    try {
      await chrome.tabs.create({
        url: pageUrl,
        index: openerTab.index + 1,
        openerTabId: openerTab.id,
        windowId: openerTab.windowId,
      });
      return;
    } catch {
      // Fall through, e.g. when that window cannot take new tabs.
    }
  }
  await chrome.tabs.create({ url: pageUrl });
}

chrome.action.onClicked.addListener(() => {
  void chrome.runtime.openOptionsPage();
});

chrome.runtime.onInstalled.addListener(createContextMenus);
chrome.runtime.onStartup.addListener(createContextMenus);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === LINK_BUILDER_MENU_ID) void openLinkBuilder(tab);
});
