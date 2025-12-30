import type { CustomPrompt } from './models/CustomPrompt';
import { DEFAULT_PROMPTS } from './models/CustomPrompt';
import { PromptsStorageService } from './services/PromptsStorageService';
import { OptionsUIController } from './ui/OptionsUIController';
import { PromptRenderer } from './ui/PromptRenderer';
import { getProperty, downloadFile } from './utils/helpers';

/**
 * Main controller for the options page
 */
export class OptionsController {
  private customPrompts: CustomPrompt[] = [];
  private editingIndex: number = -1;
  private ui: OptionsUIController;
  private renderer: PromptRenderer;

  // DOM Elements
  private promptForm!: HTMLFormElement;
  private promptModal!: HTMLElement;
  private importModal!: HTMLElement;
  private modalTitle!: HTMLElement;
  
  private promptEnabled!: HTMLInputElement;
  private promptInitial!: HTMLInputElement;
  private promptIcon!: HTMLInputElement;
  private promptTitle!: HTMLInputElement;
  private promptAltText!: HTMLInputElement;
  private promptText!: HTMLTextAreaElement;
  private promptAutoPaste!: HTMLInputElement;
  private promptAutoSubmit!: HTMLInputElement;
  private importText!: HTMLTextAreaElement;

  constructor() {
    this.ui = new OptionsUIController('statusMessage', 'promptsList');
    this.renderer = new PromptRenderer();
  }

  /**
   * Initialize the controller
   */
  init(): void {
    this.initializeDOM();
    this.loadPrompts();
    this.renderPrompts();
    this.attachEventListeners();
  }

  /**
   * Initialize DOM element references
   */
  private initializeDOM(): void {
    this.promptForm = document.getElementById('promptForm') as HTMLFormElement;
    this.promptModal = document.getElementById('promptModal')!;
    this.importModal = document.getElementById('importModal')!;
    this.modalTitle = document.getElementById('modalTitle')!;
    
    this.promptEnabled = document.getElementById('promptEnabled') as HTMLInputElement;
    this.promptInitial = document.getElementById('promptInitial') as HTMLInputElement;
    this.promptIcon = document.getElementById('promptIcon') as HTMLInputElement;
    this.promptTitle = document.getElementById('promptTitle') as HTMLInputElement;
    this.promptAltText = document.getElementById('promptAltText') as HTMLInputElement;
    this.promptText = document.getElementById('promptText') as HTMLTextAreaElement;
    this.promptAutoPaste = document.getElementById('promptAutoPaste') as HTMLInputElement;
    this.promptAutoSubmit = document.getElementById('promptAutoSubmit') as HTMLInputElement;
    this.importText = document.getElementById('importText') as HTMLTextAreaElement;
  }

  /**
   * Load prompts from storage
   */
  private loadPrompts(): void {
    this.customPrompts = PromptsStorageService.loadPrompts();
  }

  /**
   * Save prompts to storage
   */
  private savePrompts(): boolean {
    const success = PromptsStorageService.savePrompts(this.customPrompts);
    if (success) {
      this.ui.showStatus('儲存成功！', 'success');
    } else {
      this.ui.showStatus('儲存失敗', 'error');
    }
    return success;
  }

  /**
   * Render all prompts
   */
  private renderPrompts(): void {
    if (this.customPrompts.length === 0) {
      this.ui.setPromptsListHTML(this.renderer.createEmptyStateHTML());
      const emptyStateBtn = document.getElementById('emptyStateAddBtn');
      if (emptyStateBtn) {
        emptyStateBtn.addEventListener('click', () => this.openAddModal());
      }
      return;
    }

    this.ui.clearPromptsList();
    this.customPrompts.forEach((prompt, index) => {
      const element = this.renderer.createPromptElement(
        prompt,
        index,
        this.customPrompts.length,
        {
          onEdit: (i) => this.editPrompt(i),
          onToggle: (i) => this.togglePrompt(i),
          onMoveUp: (i) => this.moveUp(i),
          onMoveDown: (i) => this.moveDown(i),
          onDelete: (i) => this.deletePrompt(i)
        }
      );
      this.ui.appendToPromptsList(element);
    });
  }

  /**
   * Open modal for adding new prompt
   */
  private openAddModal(): void {
    this.editingIndex = -1;
    this.modalTitle.textContent = '新增提示';
    this.resetForm();
    this.promptModal.classList.add('active');
  }

  /**
   * Edit existing prompt
   */
  private editPrompt(index: number): void {
    this.editingIndex = index;
    this.modalTitle.textContent = '編輯提示';
    const prompt = this.customPrompts[index];

    this.promptEnabled.checked = getProperty(prompt, 'enabled', true) as boolean;
    this.promptInitial.checked = getProperty(prompt, 'initial', false) as boolean;
    this.promptIcon.value = prompt.svgIcon || '';
    this.promptTitle.value = prompt.title || '';
    this.promptAltText.value = prompt.altText || '';
    this.promptText.value = prompt.prompt || '';
    this.promptAutoPaste.checked = getProperty(prompt, 'autoPaste', false) as boolean;
    this.promptAutoSubmit.checked = getProperty(prompt, 'autoSubmit', false) as boolean;

    this.promptModal.classList.add('active');
  }

  /**
   * Reset form to default values
   */
  private resetForm(): void {
    this.promptForm.reset();
    this.promptEnabled.checked = true;
    this.promptInitial.checked = false;
    this.promptAutoPaste.checked = false;
    this.promptAutoSubmit.checked = false;
  }

  /**
   * Close modal
   */
  private closeModal(): void {
    this.promptModal.classList.remove('active');
    this.resetForm();
  }

  /**
   * Save prompt from form
   */
  private savePromptFromForm(event: Event): void {
    event.preventDefault();

    const newPrompt: CustomPrompt = {
      enabled: this.promptEnabled.checked,
      title: this.promptTitle.value.trim(),
      prompt: this.promptText.value
    };

    if (this.promptInitial.checked) {
      newPrompt.initial = true;
    }

    if (this.promptIcon.value.trim()) {
      newPrompt.svgIcon = this.promptIcon.value.trim();
    }

    if (this.promptAltText.value.trim()) {
      newPrompt.altText = this.promptAltText.value.trim();
    }

    if (this.promptAutoPaste.checked) {
      newPrompt.autoPaste = true;
    }

    if (this.promptAutoSubmit.checked) {
      newPrompt.autoSubmit = true;
    }

    if (this.editingIndex === -1) {
      this.customPrompts.push(newPrompt);
    } else {
      this.customPrompts[this.editingIndex] = newPrompt;
    }

    if (this.savePrompts()) {
      this.renderPrompts();
      this.closeModal();
    }
  }

  /**
   * Toggle prompt enabled/disabled
   */
  private togglePrompt(index: number): void {
    if (this.customPrompts[index]) {
      const currentEnabled = getProperty(this.customPrompts[index], 'enabled', true);
      this.customPrompts[index].enabled = !currentEnabled;
      this.savePrompts();
      this.renderPrompts();
    }
  }

  /**
   * Delete prompt
   */
  private deletePrompt(index: number): void {
    if (this.ui.confirm('確定要刪除此提示嗎？')) {
      this.customPrompts.splice(index, 1);
      this.savePrompts();
      this.renderPrompts();
    }
  }

  /**
   * Move prompt up
   */
  private moveUp(index: number): void {
    if (index > 0) {
      [this.customPrompts[index - 1], this.customPrompts[index]] = 
        [this.customPrompts[index], this.customPrompts[index - 1]];
      this.savePrompts();
      this.renderPrompts();
    }
  }

  /**
   * Move prompt down
   */
  private moveDown(index: number): void {
    if (index < this.customPrompts.length - 1) {
      [this.customPrompts[index], this.customPrompts[index + 1]] = 
        [this.customPrompts[index + 1], this.customPrompts[index]];
      this.savePrompts();
      this.renderPrompts();
    }
  }

  /**
   * Export prompts
   */
  private exportPrompts(): void {
    const dataStr = PromptsStorageService.exportPrompts(this.customPrompts);
    downloadFile(dataStr, 'chatgpt-toolkit-prompts.json', 'application/json');
    this.ui.showStatus('匯出成功！', 'success');
  }

  /**
   * Open import modal
   */
  private openImportModal(): void {
    this.importText.value = '';
    this.importModal.classList.add('active');
  }

  /**
   * Close import modal
   */
  private closeImportModal(): void {
    this.importModal.classList.remove('active');
    this.importText.value = '';
  }

  /**
   * Import prompts
   */
  private importPrompts(): void {
    try {
      const imported = PromptsStorageService.importPrompts(this.importText.value);

      if (this.ui.confirm(`確定要匯入 ${imported.length} 個提示嗎？這會覆蓋現有的設定。`)) {
        this.customPrompts = imported;
        this.savePrompts();
        this.renderPrompts();
        this.closeImportModal();
      }
    } catch (error) {
      this.ui.showStatus('匯入失敗：' + (error as Error).message, 'error');
    }
  }

  /**
   * Reset to default prompts
   */
  private resetToDefaults(): void {
    if (!this.ui.confirm('確定要重置為預設值嗎？這會清除所有自訂提示。')) {
      return;
    }

    this.customPrompts = [...DEFAULT_PROMPTS];
    this.savePrompts();
    this.renderPrompts();
    this.ui.showStatus('已重置為預設值', 'success');
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Main action buttons
    document.getElementById('addPromptBtn')?.addEventListener('click', () => this.openAddModal());
    document.getElementById('importBtn')?.addEventListener('click', () => this.openImportModal());
    document.getElementById('exportBtn')?.addEventListener('click', () => this.exportPrompts());
    document.getElementById('resetBtn')?.addEventListener('click', () => this.resetToDefaults());

    // Prompt modal
    document.getElementById('closeModalBtn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('cancelBtn')?.addEventListener('click', () => this.closeModal());
    this.promptForm.addEventListener('submit', (e) => this.savePromptFromForm(e));

    // Import modal
    document.getElementById('closeImportModalBtn')?.addEventListener('click', () => this.closeImportModal());
    document.getElementById('cancelImportBtn')?.addEventListener('click', () => this.closeImportModal());
    document.getElementById('confirmImportBtn')?.addEventListener('click', () => this.importPrompts());

    // Close modals when clicking outside
    this.promptModal.addEventListener('click', (e) => {
      if (e.target === this.promptModal) {
        this.closeModal();
      }
    });

    this.importModal.addEventListener('click', (e) => {
      if (e.target === this.importModal) {
        this.closeImportModal();
      }
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const controller = new OptionsController();
    controller.init();
  });
} else {
  const controller = new OptionsController();
  controller.init();
}
