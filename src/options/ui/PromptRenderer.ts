import type { CustomPrompt } from '../models/CustomPrompt';
import { getProperty, escapeHtml } from '../utils/helpers';
import { getMessage } from '../utils/i18n';

/**
 * Renders prompt list items
 */
export class PromptRenderer {
  /**
   * Create HTML element for a single prompt
   */
  createPromptElement(
    prompt: CustomPrompt,
    indexInView: number,
    totalCountInView: number,
    indexInStorage: number,
    callbacks: {
      onEdit: (index: number) => void;
      onToggle: (index: number) => void;
      onMoveUp: (index: number) => void;
      onMoveDown: (index: number) => void;
      onDelete: (index: number) => void;
    }
  ): HTMLElement {
    const div = document.createElement('div');
    div.className = 'prompt-item';

    const isEnabled = getProperty(prompt, 'enabled', true);
    const hasAutoPaste = getProperty(prompt, 'autoPaste', false);
    const hasAutoSubmit = getProperty(prompt, 'autoSubmit', false);

    const badges: string[] = [];
    const autoSubmitState = hasAutoSubmit ? 'is-on' : 'is-off';
    const autoPasteState = hasAutoPaste ? 'is-on' : 'is-off';
    const enabledState = isEnabled ? 'is-on' : 'is-off';

    const badgeAutoSubmit = getMessage('options_badge_auto_submit');
    const badgeAutoPaste = getMessage('options_badge_auto_paste');
    const badgeStatus = isEnabled
      ? getMessage('options_badge_enabled')
      : getMessage('options_badge_disabled');

    badges.push(`<span class="badge auto-submit ${autoSubmitState}">${escapeHtml(badgeAutoSubmit)}</span>`);
    badges.push(`<span class="badge auto-paste ${autoPasteState}">${escapeHtml(badgeAutoPaste)}</span>`);
    badges.push(`<span class="badge status ${enabledState}">${escapeHtml(badgeStatus)}</span>`);

    const promptTitleFallback = getMessage('options_prompt_title_fallback');
    const promptAltLabel = getMessage('options_prompt_alt_label');
    const promptContentLabel = getMessage('options_prompt_content_label');

    const actionEdit = getMessage('options_action_edit');
    const actionToggle = isEnabled
      ? getMessage('options_action_disable')
      : getMessage('options_action_enable');
    const actionMoveUp = getMessage('options_action_move_up');
    const actionMoveDown = getMessage('options_action_move_down');
    const actionDelete = getMessage('options_action_delete');

    div.innerHTML = `
      <div class="prompt-header">
        <div class="prompt-icon">${prompt.svgIcon || '📝'}</div>
        <div class="prompt-title">${escapeHtml(prompt.title || promptTitleFallback)}</div>
        <div class="prompt-badges">
          ${badges.join('')}
        </div>
      </div>
      <div class="prompt-content">
        ${prompt.altText ? `
          <div class="prompt-field">
            <label>${escapeHtml(promptAltLabel)}</label>
            <span class="prompt-field-value">${escapeHtml(prompt.altText)}</span>
          </div>
        ` : ''}
        <div class="prompt-field">
          <label>${escapeHtml(promptContentLabel)}</label>
          <div class="prompt-text">${escapeHtml(prompt.prompt || '')}</div>
        </div>
      </div>
      <div class="prompt-actions">
        <button class="btn-edit">${escapeHtml(actionEdit)}</button>
        <button class="btn-toggle secondary">
          ${escapeHtml(actionToggle)}
        </button>
        <button class="btn-move-up secondary" ${indexInView === 0 ? 'disabled' : ''}>${escapeHtml(actionMoveUp)}</button>
        <button class="btn-move-down secondary" ${indexInView === totalCountInView - 1 ? 'disabled' : ''}>${escapeHtml(actionMoveDown)}</button>
        <button class="btn-delete danger">${escapeHtml(actionDelete)}</button>
      </div>
    `;

    // Attach event listeners
    const editBtn = div.querySelector('.btn-edit') as HTMLButtonElement;
    const toggleBtn = div.querySelector('.btn-toggle') as HTMLButtonElement;
    const moveUpBtn = div.querySelector('.btn-move-up') as HTMLButtonElement;
    const moveDownBtn = div.querySelector('.btn-move-down') as HTMLButtonElement;
    const deleteBtn = div.querySelector('.btn-delete') as HTMLButtonElement;

    editBtn.addEventListener('click', () => callbacks.onEdit(indexInStorage));
    toggleBtn.addEventListener('click', () => callbacks.onToggle(indexInStorage));
    moveUpBtn.addEventListener('click', () => callbacks.onMoveUp(indexInStorage));
    moveDownBtn.addEventListener('click', () => callbacks.onMoveDown(indexInStorage));
    deleteBtn.addEventListener('click', () => callbacks.onDelete(indexInStorage));

    return div;
  }

  /**
   * Create empty state HTML
   */
  createEmptyStateHTML(
    message: string,
    buttonText: string,
    buttonId: string = 'emptyStateAddBtn'
  ): string {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <div class="empty-state-text">${escapeHtml(message)}</div>
        <button id="${escapeHtml(buttonId)}">${escapeHtml(buttonText)}</button>
      </div>
    `;
  }
}
