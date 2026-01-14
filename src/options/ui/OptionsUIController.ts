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
    this.statusMessage.textContent = message;
    this.statusMessage.className = `status-message active ${type}`;
    setTimeout(() => {
      this.statusMessage.classList.remove('active');
    }, 3000);
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
