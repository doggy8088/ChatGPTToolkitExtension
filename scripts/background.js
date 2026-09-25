(() => {
  // src/background/index.ts
  var LINK_BUILDER_MENU_ID = "open-link-builder";
  var LINK_BUILDER_PAGE = "link-builder.html";
  var ignoreLastError = () => {
    chrome.runtime.lastError;
  };
  function createContextMenus() {
    chrome.contextMenus.removeAll(() => {
      ignoreLastError();
      chrome.contextMenus.create({
        id: LINK_BUILDER_MENU_ID,
        title: chrome.i18n.getMessage("context_menu_open_link_builder"),
        contexts: ["action"]
      }, ignoreLastError);
    });
  }
  async function findLinkBuilderTab(pageUrl) {
    if (typeof chrome.runtime.getContexts !== "function")
      return null;
    try {
      const contexts = await chrome.runtime.getContexts({ contextTypes: ["TAB"] });
      return contexts.find((context) => context.tabId >= 0 && context.documentUrl?.split("#")[0] === pageUrl) ?? null;
    } catch {
      return null;
    }
  }
  async function openLinkBuilder(openerTab) {
    const pageUrl = chrome.runtime.getURL(LINK_BUILDER_PAGE);
    const existing = await findLinkBuilderTab(pageUrl);
    if (existing) {
      try {
        await chrome.tabs.update(existing.tabId, { active: true });
        await chrome.windows.update(existing.windowId, { focused: true });
        return;
      } catch {}
    }
    if (openerTab && openerTab.id !== undefined && openerTab.id >= 0) {
      try {
        await chrome.tabs.create({
          url: pageUrl,
          index: openerTab.index + 1,
          openerTabId: openerTab.id,
          windowId: openerTab.windowId
        });
        return;
      } catch {}
    }
    await chrome.tabs.create({ url: pageUrl });
  }
  chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
  });
  chrome.runtime.onInstalled.addListener(createContextMenus);
  chrome.runtime.onStartup.addListener(createContextMenus);
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === LINK_BUILDER_MENU_ID)
      openLinkBuilder(tab);
  });
})();

//# debugId=27C497E7775080DA64756E2164756E21
