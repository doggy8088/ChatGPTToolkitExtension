export const CHATGPT_WIDTH_KEY = 'chatgpttoolkit.chatgptConversationWidth';
export const CHATGPT_WIDTH_WRITE_KEY = `${CHATGPT_WIDTH_KEY}.write`;
export const CHATGPT_WIDTHS = ['default', '60', '80', '100'] as const;
export type ChatGPTWidth = (typeof CHATGPT_WIDTHS)[number];

export function parseChatGPTWidth(value: unknown): ChatGPTWidth {
  return CHATGPT_WIDTHS.includes(value as ChatGPTWidth) ? value as ChatGPTWidth : 'default';
}

function parseWidthWrite(value: unknown): { width: ChatGPTWidth; writer: string } | null {
  if (!value || typeof value !== 'object' || !('width' in value) || !('writer' in value)) return null;
  if (typeof value.writer !== 'string' || !CHATGPT_WIDTHS.includes(value.width as ChatGPTWidth)) return null;
  return { width: value.width as ChatGPTWidth, writer: value.writer };
}

/** Subscribe before reading so a slow initial read cannot overwrite a newer setting. */
export function watchChatGPTWidth(onWidth: (width: ChatGPTWidth, writer?: string) => void, onError: (error: unknown) => void): void {
  let changed = false;
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      const widthChanged = Object.prototype.hasOwnProperty.call(changes, CHATGPT_WIDTH_KEY);
      const write = parseWidthWrite(changes[CHATGPT_WIDTH_WRITE_KEY]?.newValue);
      if (!widthChanged && !write) return;
      changed = true;
      const width = parseChatGPTWidth(widthChanged ? changes[CHATGPT_WIDTH_KEY].newValue : write?.width);
      onWidth(width, write?.width === width ? write.writer : undefined);
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

export function saveChatGPTWidth(width: ChatGPTWidth, writer: string = crypto.randomUUID()): Promise<void> {
  return new Promise((resolve, reject) => {
    const validWidth = parseChatGPTWidth(width);
    // Store origin metadata with the value, including same-value writes from another page.
    chrome.storage.local.set({
      [CHATGPT_WIDTH_KEY]: validWidth,
      [CHATGPT_WIDTH_WRITE_KEY]: { width: validWidth, writer, revision: crypto.randomUUID() },
    }, () => {
      if (chrome.runtime?.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}
