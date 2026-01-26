export type StatusType = 'success' | 'error';

/**
 * UI Controller for the options page
 */
export class OptionsUIController {
  private statusMessage: HTMLElement;
  private promptsList: HTMLElement | null;

  constructor(statusMessageId: string, promptsListId?: string) {
    this.statusMessage = document.getElementById(statusMessageId)!;
    this.promptsList = promptsListId ? document.getElementById(promptsListId) : null;
  }

  /**
   * Show status message
   */
  showStatus(message: string, type: StatusType = 'success'): void {
    const toast = document.createElement('div');
    toast.className = `toast-message ${type}`;
    toast.textContent = message;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    this.statusMessage.appendChild(toast);

    while (this.statusMessage.children.length > 3) {
      this.statusMessage.firstElementChild?.remove();
    }

    window.requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    const displayDurationMs = 2800;
    const transitionMs = 200;

    window.setTimeout(() => {
      toast.classList.remove('show');
      toast.classList.add('hide');
    }, displayDurationMs);

    window.setTimeout(() => {
      toast.remove();
    }, displayDurationMs + transitionMs);
  }

  /**
   * Clear the prompts list
   */
  clearPromptsList(): void {
    if (!this.promptsList) return;
    this.promptsList.innerHTML = '';
  }

  /**
   * Append element to prompts list
   */
  appendToPromptsList(element: HTMLElement): void {
    if (!this.promptsList) return;
    this.promptsList.appendChild(element);
  }

  /**
   * Set prompts list innerHTML
   */
  setPromptsListHTML(html: string): void {
    if (!this.promptsList) return;
    this.promptsList.innerHTML = html;
  }

  /**
   * Confirm action with user
   */
  confirm(message: string): boolean {
    return window.confirm(message);
  }
}
