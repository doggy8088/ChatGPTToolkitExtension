import { parseChatGPTWidth, saveChatGPTWidth, watchChatGPTWidth, type ChatGPTWidth } from '../../shared/chatgptLayout';
import { byId } from '../utils/dom';
import { getMessage } from '../utils/i18n';
import type { OptionsUIController } from './OptionsUIController';

export function initAdvancedSettings(ui: OptionsUIController): void {
  const select = byId<HTMLSelectElement>('chatgptConversationWidth');
  let savedWidth: ChatGPTWidth = 'default';
  let saveChain: Promise<void> = Promise.resolve();
  let latestRequest = 0;

  watchChatGPTWidth((width) => {
    savedWidth = width;
    select.value = width;
    select.disabled = false;
  }, () => ui.showStatus(getMessage('options_advanced_load_error'), 'error'));

  select.addEventListener('change', () => {
    const width = parseChatGPTWidth(select.value);
    const request = ++latestRequest;
    // Keep keyboard focus and serialize rapid changes without disabling the control.
    saveChain = saveChain.then(async () => {
      try {
        await saveChatGPTWidth(width);
        if (request === latestRequest) ui.showStatus(getMessage('options_advanced_saved'));
      } catch {
        if (request === latestRequest) {
          select.value = savedWidth;
          ui.showStatus(getMessage('options_advanced_save_error'), 'error');
        }
      }
    });
  });
}
