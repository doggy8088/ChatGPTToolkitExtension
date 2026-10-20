import { parseChatGPTWidth, saveChatGPTWidth, watchChatGPTWidth, type ChatGPTWidth } from '../../shared/chatgptLayout';
import { byId } from '../utils/dom';
import { getMessage } from '../utils/i18n';
import type { OptionsUIController } from './OptionsUIController';

export function initAdvancedSettings(ui: OptionsUIController): void {
  const select = byId<HTMLSelectElement>('chatgptConversationWidth');
  let savedWidth: ChatGPTWidth = 'default';

  watchChatGPTWidth((width) => {
    savedWidth = width;
    select.value = width;
    select.disabled = false;
  }, () => ui.showStatus(getMessage('options_advanced_load_error'), 'error'));

  select.addEventListener('change', async () => {
    const width = parseChatGPTWidth(select.value);
    select.disabled = true;
    try {
      await saveChatGPTWidth(width);
      savedWidth = width;
      ui.showStatus(getMessage('options_advanced_saved'));
    } catch {
      select.value = savedWidth;
      ui.showStatus(getMessage('options_advanced_save_error'), 'error');
    } finally {
      select.disabled = false;
    }
  });
}
