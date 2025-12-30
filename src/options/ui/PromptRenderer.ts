import type { CustomPrompt } from '../models/CustomPrompt';
import { getProperty, escapeHtml } from '../utils/helpers';

/**
 * Renders prompt list items
 */
export class PromptRenderer {
  /**
   * Create HTML element for a single prompt
   */
  createPromptElement(
    prompt: CustomPrompt,
    index: number,
    totalCount: number,
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

    const isInitial = getProperty(prompt, 'initial', false);
    const isEnabled = getProperty(prompt, 'enabled', true);
    const hasAutoPaste = getProperty(prompt, 'autoPaste', false);
    const hasAutoSubmit = getProperty(prompt, 'autoSubmit', false);

    const badges: string[] = [];
    badges.push(`<span class="badge ${isEnabled ? 'enabled' : 'disabled'}">${isEnabled ? '已啟用' : '已停用'}</span>`);
    badges.push(`<span class="badge ${isInitial ? 'initial' : 'follow-up'}">${isInitial ? '初始按鈕' : '後續按鈕'}</span>`);
    if (hasAutoSubmit) badges.push(`<span class="badge auto-submit">自動送出</span>`);
    if (hasAutoPaste) badges.push(`<span class="badge auto-paste">自動貼上</span>`);

    div.innerHTML = `
      <div class="prompt-header">
        <div class="prompt-icon">${prompt.svgIcon || '📝'}</div>
        <div class="prompt-title">${escapeHtml(prompt.title || '(無標題)')}</div>
        <div class="prompt-badges">
          ${badges.join('')}
        </div>
      </div>
      <div class="prompt-content">
        ${prompt.altText ? `
          <div class="prompt-field">
            <label>提示文字:</label>
            <span class="prompt-field-value">${escapeHtml(prompt.altText)}</span>
          </div>
        ` : ''}
        <div class="prompt-field">
          <label>提示內容:</label>
          <div class="prompt-text">${escapeHtml(prompt.prompt || '')}</div>
        </div>
      </div>
      <div class="prompt-actions">
        <button class="btn-edit">✏️ 編輯</button>
        <button class="btn-toggle secondary">
          ${isEnabled ? '🚫 停用' : '✅ 啟用'}
        </button>
        <button class="btn-move-up secondary" ${index === 0 ? 'disabled' : ''}>⬆️ 上移</button>
        <button class="btn-move-down secondary" ${index === totalCount - 1 ? 'disabled' : ''}>⬇️ 下移</button>
        <button class="btn-delete danger">🗑️ 刪除</button>
      </div>
    `;

    // Attach event listeners
    const editBtn = div.querySelector('.btn-edit') as HTMLButtonElement;
    const toggleBtn = div.querySelector('.btn-toggle') as HTMLButtonElement;
    const moveUpBtn = div.querySelector('.btn-move-up') as HTMLButtonElement;
    const moveDownBtn = div.querySelector('.btn-move-down') as HTMLButtonElement;
    const deleteBtn = div.querySelector('.btn-delete') as HTMLButtonElement;

    editBtn.addEventListener('click', () => callbacks.onEdit(index));
    toggleBtn.addEventListener('click', () => callbacks.onToggle(index));
    moveUpBtn.addEventListener('click', () => callbacks.onMoveUp(index));
    moveDownBtn.addEventListener('click', () => callbacks.onMoveDown(index));
    deleteBtn.addEventListener('click', () => callbacks.onDelete(index));

    return div;
  }

  /**
   * Create empty state HTML
   */
  createEmptyStateHTML(): string {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <div class="empty-state-text">尚未建立任何自訂提示</div>
        <button id="emptyStateAddBtn">建立第一個提示</button>
      </div>
    `;
  }
}
