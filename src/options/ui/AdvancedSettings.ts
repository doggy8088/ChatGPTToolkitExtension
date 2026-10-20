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
  type WriteState = { revision: number; observedAtRevision?: number };
  const writes = new Map<string, WriteState>();

  watchChatGPTWidth((width, origin, writeId) => {
    if (origin === writer && writeId) {
      const state = writes.get(writeId);
      writes.delete(writeId);
      if (state) {
        state.observedAtRevision = externalRevision;
        if (state.revision !== externalRevision) return;
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

  async function writeWidth(width: ChatGPTWidth, revision: number): Promise<WriteState> {
    const writeId = crypto.randomUUID();
    const state: WriteState = { revision };
    writes.set(writeId, state);
    try {
      await saveChatGPTWidth(width, writer, writeId);
      return state;
    } catch (error) {
      writes.delete(writeId);
      throw error;
    }
  }

  select.addEventListener('change', () => {
    const width = parseChatGPTWidth(select.value);
    const request = ++latestRequest;
    const queuedRevision = externalRevision;
    // Keep keyboard focus and serialize rapid changes without disabling the control.
    saveChain = saveChain.then(async () => {
      if (queuedRevision !== externalRevision) return;
      let revision = queuedRevision;
      let reconciling = false;
      try {
        let writtenWidth = width;
        let state = await writeWidth(writtenWidth, revision);
        // An issued storage write cannot be cancelled. Repair it if it landed
        // after a newer selection from another page, including delayed echoes.
        while (revision !== externalRevision) {
          // A write observed before the external update did not overwrite it.
          if (state.observedAtRevision === revision || writtenWidth === externalWidth) break;
          reconciling = true;
          revision = externalRevision;
          writtenWidth = externalWidth;
          state = await writeWidth(writtenWidth, revision);
        }
        if (request === latestRequest) ui.showStatus(getMessage('options_advanced_saved'));
      } catch {
        if (request === latestRequest || reconciling) {
          select.value = savedWidth;
          ui.showStatus(getMessage('options_advanced_save_error'), 'error');
        }
      }
    });
  });
}
