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
  const writer = crypto.randomUUID();
  let externalWidth: ChatGPTWidth = 'default';
  const writes = new Map<string, number>();

  watchChatGPTWidth((width, origin, writeId) => {
    if (origin === writer && writeId) {
      const revision = writes.get(writeId);
      writes.delete(writeId);
      if (revision !== undefined && revision !== externalRevision) {
        // Repair on the stale event itself: set callbacks may arrive before
        // external events, so callback ordering cannot establish the winner.
        if (width !== externalWidth) queueSave(externalWidth, externalRevision);
        return;
      }
    }
    if (origin !== writer) {
      // A newer selection from another page supersedes our queued requests.
      externalRevision++;
      latestRequest++;
      externalWidth = width;
    }
    savedWidth = width;
    select.value = width;
    select.disabled = false;
  }, () => ui.showStatus(getMessage('options_advanced_load_error'), 'error'));

  function queueSave(width: ChatGPTWidth, revision: number, request?: number): void {
    // Keep keyboard focus and serialize rapid changes without disabling the control.
    saveChain = saveChain.then(async () => {
      if (revision !== externalRevision) return;
      const writeId = crypto.randomUUID();
      writes.set(writeId, revision);
      try {
        await saveChatGPTWidth(width, writer, writeId);
        if (request === latestRequest) ui.showStatus(getMessage('options_advanced_saved'));
      } catch {
        writes.delete(writeId);
        if (request === latestRequest || request === undefined) {
          select.value = savedWidth;
          ui.showStatus(getMessage('options_advanced_save_error'), 'error');
        }
      }
    });
  }

  select.addEventListener('change', () => {
    queueSave(parseChatGPTWidth(select.value), externalRevision, ++latestRequest);
  });
}
