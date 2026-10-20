import { parseChatGPTWidth, saveChatGPTWidth, watchChatGPTWidth, type ChatGPTWidth } from '../../shared/chatgptLayout';
import { byId } from '../utils/dom';
import { getMessage } from '../utils/i18n';
import type { OptionsUIController } from './OptionsUIController';

export function initAdvancedSettings(ui: OptionsUIController): void {
  const select = byId<HTMLSelectElement>('chatgptConversationWidth');
  let savedWidth: ChatGPTWidth = 'default';
  let saveChain: Promise<void> = Promise.resolve();
  let latestRequest = 0;
  let externalRevision = 0;
  const ownWrites: ChatGPTWidth[] = [];

  watchChatGPTWidth((width) => {
    const ownWrite = ownWrites.indexOf(width);
    if (ownWrite !== -1) {
      ownWrites.splice(ownWrite, 1);
    } else {
      // A newer selection from another page supersedes our queued requests.
      externalRevision++;
      latestRequest++;
      ownWrites.length = 0;
    }
    savedWidth = width;
    select.value = width;
    select.disabled = false;
  }, () => ui.showStatus(getMessage('options_advanced_load_error'), 'error'));

  select.addEventListener('change', () => {
    const width = parseChatGPTWidth(select.value);
    const request = ++latestRequest;
    const revision = externalRevision;
    // Keep keyboard focus and serialize rapid changes without disabling the control.
    saveChain = saveChain.then(async () => {
      if (revision !== externalRevision) return;
      // Unchanged writes do not emit storage events, so do not expect an echo.
      if (width !== savedWidth) ownWrites.push(width);
      // Bound tracking if a context is disconnected before its event arrives.
      if (ownWrites.length > 20) ownWrites.shift();
      try {
        await saveChatGPTWidth(width);
        if (request === latestRequest) ui.showStatus(getMessage('options_advanced_saved'));
      } catch {
        const ownWrite = ownWrites.indexOf(width);
        if (ownWrite !== -1) ownWrites.splice(ownWrite, 1);
        if (request === latestRequest) {
          select.value = savedWidth;
          ui.showStatus(getMessage('options_advanced_save_error'), 'error');
        }
      }
    });
  });
}
