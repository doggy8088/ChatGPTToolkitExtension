export type StatusType = 'success' | 'error';

/**
 * UI Controller for the options page
 */
export class OptionsUIController {
  private statusMessage: HTMLElement;
  private promptsList: HTMLElement;

  constructor(statusMessageId: string, promptsListId: string) {
    this.statusMessage = document.getElementById(statusMessageId)!;
    this.promptsList = document.getElementById(promptsListId)!;
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
    this.promptsList.innerHTML = '';
  }

  /**
   * Append element to prompts list
   */
  appendToPromptsList(element: HTMLElement): void {
    this.promptsList.appendChild(element);
  }

  /**
   * Set prompts list innerHTML
   */
  setPromptsListHTML(html: string): void {
    this.promptsList.innerHTML = html;
  }

  /**
   * Confirm action with user
   */
  confirm(message: string): boolean {
    return window.confirm(message);
  }
}
