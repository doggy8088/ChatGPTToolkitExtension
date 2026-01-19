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
  private activeTab: 'initial' | 'followUp' = 'initial';

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

  private panelInitial!: HTMLElement;
  private panelFollowUp!: HTMLElement;
  private promptsListInitial!: HTMLElement;
  private promptsListFollowUp!: HTMLElement;

  private tabInitialBtn!: HTMLButtonElement;
  private tabFollowUpBtn!: HTMLButtonElement;
  private tabInitialCount!: HTMLElement;
  private tabFollowUpCount!: HTMLElement;

  constructor() {
    this.ui = new OptionsUIController('statusMessage');
    this.renderer = new PromptRenderer();
  }

  /**
   * Initialize the controller
   */
  async init(): Promise<void> {
    this.initializeDOM();
    this.attachEventListeners();
    await this.loadPrompts();
    this.renderPrompts();
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

    this.panelInitial = document.getElementById('panelInitial')!;
    this.panelFollowUp = document.getElementById('panelFollowUp')!;
    this.promptsListInitial = document.getElementById('promptsListInitial')!;
    this.promptsListFollowUp = document.getElementById('promptsListFollowUp')!;

    this.tabInitialBtn = document.getElementById('tabInitialBtn') as HTMLButtonElement;
    this.tabFollowUpBtn = document.getElementById('tabFollowUpBtn') as HTMLButtonElement;
    this.tabInitialCount = document.getElementById('tabInitialCount')!;
    this.tabFollowUpCount = document.getElementById('tabFollowUpCount')!;
  }

  private isPromptInitial(prompt: CustomPrompt): boolean {
    return Boolean(getProperty(prompt, 'initial', false));
  }

  private getPromptTypeLabel(isInitial: boolean): string {
    return isInitial ? '初始按鈕' : '追問按鈕';
  }

  private setModalTitle(action: '新增' | '編輯', isInitial: boolean): void {
    this.modalTitle.textContent = `${action}${this.getPromptTypeLabel(isInitial)}`;
  }

  private updateTabsUI(): void {
    const isInitial = this.activeTab === 'initial';
    this.tabInitialBtn.classList.toggle('active', isInitial);
    this.tabFollowUpBtn.classList.toggle('active', !isInitial);
    this.tabInitialBtn.setAttribute('aria-selected', isInitial ? 'true' : 'false');
    this.tabFollowUpBtn.setAttribute('aria-selected', !isInitial ? 'true' : 'false');
    this.tabInitialBtn.tabIndex = isInitial ? 0 : -1;
    this.tabFollowUpBtn.tabIndex = isInitial ? -1 : 0;

    if (isInitial) {
      this.panelInitial.removeAttribute('hidden');
      this.panelInitial.setAttribute('aria-hidden', 'false');
      this.panelFollowUp.setAttribute('hidden', '');
      this.panelFollowUp.setAttribute('aria-hidden', 'true');
    } else {
      this.panelFollowUp.removeAttribute('hidden');
      this.panelFollowUp.setAttribute('aria-hidden', 'false');
      this.panelInitial.setAttribute('hidden', '');
      this.panelInitial.setAttribute('aria-hidden', 'true');
    }
  }

  private updateTabCounts(): void {
    const initialCount = this.customPrompts.filter(p => this.isPromptInitial(p)).length;
    const followUpCount = this.customPrompts.length - initialCount;
    this.tabInitialCount.textContent = `(${initialCount})`;
    this.tabFollowUpCount.textContent = `(${followUpCount})`;
  }

  private setActiveTab(tab: 'initial' | 'followUp'): void {
    this.activeTab = tab;
    this.renderPrompts();
  }

  /**
   * Load prompts from storage
   */
  private async loadPrompts(): Promise<void> {
    this.customPrompts = await PromptsStorageService.loadPrompts();
  }

  /**
   * Save prompts to storage
   */
  private async savePrompts(): Promise<boolean> {
    const success = await PromptsStorageService.savePrompts(this.customPrompts);
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
    this.updateTabsUI();
    this.updateTabCounts();

    const initialItems = this.customPrompts
      .map((prompt, index) => ({ prompt, index }))
      .filter(({ prompt }) => this.isPromptInitial(prompt));

    const followUpItems = this.customPrompts
      .map((prompt, index) => ({ prompt, index }))
      .filter(({ prompt }) => !this.isPromptInitial(prompt));

    this.renderPromptsList(
      this.promptsListInitial,
      initialItems,
      '尚未建立任何初始按鈕',
      'emptyStateAddBtnInitial',
      () => {
        this.setActiveTab('initial');
        this.openAddModal();
      }
    );

    this.renderPromptsList(
      this.promptsListFollowUp,
      followUpItems,
      '尚未建立任何追問按鈕',
      'emptyStateAddBtnFollowUp',
      () => {
        this.setActiveTab('followUp');
        this.openAddModal();
      }
    );
  }

  private renderPromptsList(
    container: HTMLElement,
    items: Array<{ prompt: CustomPrompt; index: number }>,
    emptyMessage: string,
    emptyButtonId: string,
    onEmptyAdd: () => void
  ): void {
    container.innerHTML = '';

    if (items.length === 0) {
      container.innerHTML = this.renderer.createEmptyStateHTML(emptyMessage, '新增提示', emptyButtonId);
      const emptyBtn = document.getElementById(emptyButtonId);
      emptyBtn?.addEventListener('click', onEmptyAdd);
      return;
    }

    items.forEach(({ prompt, index: indexInStorage }, indexInView) => {
      const element = this.renderer.createPromptElement(
        prompt,
        indexInView,
        items.length,
        indexInStorage,
        {
          onEdit: (i) => this.editPrompt(i),
          onToggle: (i) => this.togglePrompt(i),
          onMoveUp: (i) => this.moveUp(i),
          onMoveDown: (i) => this.moveDown(i),
          onDelete: (i) => this.deletePrompt(i)
        }
      );
      container.appendChild(element);
    });
  }

  /**
   * Open modal for adding new prompt
   */
  private openAddModal(): void {
    this.editingIndex = -1;
    this.resetForm();
    const isInitial = this.activeTab === 'initial';
    this.promptInitial.checked = isInitial;
    this.setModalTitle('新增', isInitial);
    this.promptModal.classList.add('active');
  }

  /**
   * Edit existing prompt
   */
  private editPrompt(index: number): void {
    this.editingIndex = index;
    const prompt = this.customPrompts[index];
    const isInitial = this.isPromptInitial(prompt);

    this.promptEnabled.checked = getProperty(prompt, 'enabled', true) as boolean;
    this.promptInitial.checked = isInitial;
    this.promptIcon.value = prompt.svgIcon || '';
    this.promptTitle.value = prompt.title || '';
    this.promptAltText.value = prompt.altText || '';
    this.promptText.value = prompt.prompt || '';
    this.promptAutoPaste.checked = getProperty(prompt, 'autoPaste', false) as boolean;
    this.promptAutoSubmit.checked = getProperty(prompt, 'autoSubmit', false) as boolean;

    this.setModalTitle('編輯', isInitial);
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

    void (async () => {
      if (!(await this.savePrompts())) return;
      this.activeTab = this.isPromptInitial(newPrompt) ? 'initial' : 'followUp';
      this.renderPrompts();
      this.closeModal();
    })();
  }

  /**
   * Toggle prompt enabled/disabled
   */
  private togglePrompt(index: number): void {
    if (this.customPrompts[index]) {
      const currentEnabled = getProperty(this.customPrompts[index], 'enabled', true);
      this.customPrompts[index].enabled = !currentEnabled;
      void (async () => {
        await this.savePrompts();
        this.renderPrompts();
      })();
    }
  }

  /**
   * Delete prompt
   */
  private deletePrompt(index: number): void {
    if (this.ui.confirm('確定要刪除此提示嗎？')) {
      this.customPrompts.splice(index, 1);
      void (async () => {
        await this.savePrompts();
        this.renderPrompts();
      })();
    }
  }

  /**
   * Move prompt up
   */
  private moveUp(index: number): void {
    const prompt = this.customPrompts[index];
    if (!prompt) return;

    const isInitial = this.isPromptInitial(prompt);
    for (let i = index - 1; i >= 0; i--) {
      if (this.isPromptInitial(this.customPrompts[i]) === isInitial) {
        [this.customPrompts[i], this.customPrompts[index]] =
          [this.customPrompts[index], this.customPrompts[i]];
        void (async () => {
          await this.savePrompts();
          this.renderPrompts();
        })();
        return;
      }
    }
  }

  /**
   * Move prompt down
   */
  private moveDown(index: number): void {
    const prompt = this.customPrompts[index];
    if (!prompt) return;

    const isInitial = this.isPromptInitial(prompt);
    for (let i = index + 1; i < this.customPrompts.length; i++) {
      if (this.isPromptInitial(this.customPrompts[i]) === isInitial) {
        [this.customPrompts[index], this.customPrompts[i]] =
          [this.customPrompts[i], this.customPrompts[index]];
        void (async () => {
          await this.savePrompts();
          this.renderPrompts();
        })();
        return;
      }
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
    void (async () => {
      try {
        const imported = PromptsStorageService.importPrompts(this.importText.value);

        if (this.ui.confirm(`確定要匯入 ${imported.length} 個提示嗎？這會覆蓋現有的設定。`)) {
          this.customPrompts = imported;
          await this.savePrompts();
          this.renderPrompts();
          this.closeImportModal();
        }
      } catch (error) {
        this.ui.showStatus('匯入失敗：' + (error as Error).message, 'error');
      }
    })();
  }

  /**
   * Reset to default prompts
   */
  private resetToDefaults(): void {
    if (!this.ui.confirm('確定要重置設定嗎？這會清除所有自訂提示。')) {
      return;
    }

    this.customPrompts = [...DEFAULT_PROMPTS];
    this.activeTab = 'initial';
    void (async () => {
      await this.savePrompts();
      this.renderPrompts();
      this.ui.showStatus('已重置設定', 'success');
    })();
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

    this.tabInitialBtn.addEventListener('click', () => this.setActiveTab('initial'));
    this.tabFollowUpBtn.addEventListener('click', () => this.setActiveTab('followUp'));

    const onTabKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') {
        return;
      }

      event.preventDefault();

      const nextTab =
        event.key === 'Home' ? 'initial'
        : event.key === 'End' ? 'followUp'
        : this.activeTab === 'initial' ? 'followUp' : 'initial';

      this.setActiveTab(nextTab);
      (nextTab === 'initial' ? this.tabInitialBtn : this.tabFollowUpBtn).focus();
    };

    this.tabInitialBtn.addEventListener('keydown', onTabKeyDown);
    this.tabFollowUpBtn.addEventListener('keydown', onTabKeyDown);

    // Prompt modal
    document.getElementById('closeModalBtn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('cancelBtn')?.addEventListener('click', () => this.closeModal());
    this.promptForm.addEventListener('submit', (e) => this.savePromptFromForm(e));
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (!this.promptModal.classList.contains('active')) return;
      this.closeModal();
    });

    // Import modal
    document.getElementById('closeImportModalBtn')?.addEventListener('click', () => this.closeImportModal());
    document.getElementById('cancelImportBtn')?.addEventListener('click', () => this.closeImportModal());
    document.getElementById('confirmImportBtn')?.addEventListener('click', () => this.importPrompts());

    // Drag & drop import file
    const setDragOver = (isOver: boolean) => {
      this.importText.classList.toggle('drag-over', isOver);
    };

    this.importText.addEventListener('dragenter', (e) => {
      e.preventDefault();
      setDragOver(true);
    });

    this.importText.addEventListener('dragover', (e) => {
      e.preventDefault();
      setDragOver(true);
    });

    this.importText.addEventListener('dragleave', () => {
      setDragOver(false);
    });

    this.importText.addEventListener('drop', (e) => {
      e.preventDefault();
      setDragOver(false);

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      void (async () => {
        try {
          const text = await file.text();
          this.importText.value = text;
          this.importPrompts();
        } catch (error) {
          this.ui.showStatus('讀取檔案失敗：' + (error as Error).message, 'error');
        }
      })();
    });

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
    void controller.init();
  });
} else {
  const controller = new OptionsController();
  void controller.init();
}
