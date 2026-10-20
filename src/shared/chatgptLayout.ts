export const CHATGPT_WIDTH_KEY = 'chatgpttoolkit.chatgptConversationWidth';
export const CHATGPT_WIDTHS = ['default', '60', '80', '100'] as const;
export type ChatGPTWidth = (typeof CHATGPT_WIDTHS)[number];

export function parseChatGPTWidth(value: unknown): ChatGPTWidth {
  return CHATGPT_WIDTHS.includes(value as ChatGPTWidth) ? value as ChatGPTWidth : 'default';
}

/** Subscribe before reading so a slow initial read cannot overwrite a newer setting. */
export function watchChatGPTWidth(onWidth: (width: ChatGPTWidth) => void, onError: (error: unknown) => void): void {
  let changed = false;
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !Object.prototype.hasOwnProperty.call(changes, CHATGPT_WIDTH_KEY)) return;
      changed = true;
      onWidth(parseChatGPTWidth(changes[CHATGPT_WIDTH_KEY].newValue));
    });
    chrome.storage.local.get([CHATGPT_WIDTH_KEY], (items) => {
      if (chrome.runtime?.lastError) {
        onError(new Error(chrome.runtime.lastError.message));
      } else if (!changed) {
        onWidth(parseChatGPTWidth(items[CHATGPT_WIDTH_KEY]));
      }
    });
  } catch (error) {
    onError(error);
  }
}

export function saveChatGPTWidth(width: ChatGPTWidth): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [CHATGPT_WIDTH_KEY]: parseChatGPTWidth(width) }, () => {
      if (chrome.runtime?.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}
