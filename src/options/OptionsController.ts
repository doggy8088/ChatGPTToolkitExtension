import type { CustomPrompt } from './models/CustomPrompt';
import { PROMPTS_STORAGE_KEY, PromptsStorageService } from './services/PromptsStorageService';
import { OptionsUIController, onDialogBackdropClick } from './ui/OptionsUIController';
import { PromptRenderer, type PromptCardCallbacks } from './ui/PromptRenderer';
import { ThemeSwitcher } from './ui/ThemeSwitcher';
import { byId, insertTextAtCaret, shortcutKbds } from './utils/dom';
import { downloadFile } from './utils/helpers';
import { applyPageI18n, getMessage } from './utils/i18n';
import { renderPromptIcon } from './utils/promptIcon';
import {
  ARGS_PLACEHOLDER,
  arePromptListsEqual,
  buildPromptFromForm,
  countByGroup,
  getGroupItems,
  getPromptFormValues,
  getPromptGroup,
  insertPromptAtTop,
  matchesPromptQuery,
  movePromptWithinGroup,
  removePromptAt,
  replacePromptAt,
  setPromptEnabledAt,
  type PromptFormValues,
  type PromptGroup,
} from './utils/promptList';

interface EditingState {
  mode: 'add' | 'edit';
  /** Starts as the active tab (add) or the edited prompt's group (edit); the type picker can change it. */
  group: PromptGroup;
  index: number;
}

interface FocusRequest {
  index?: number;
  selectors: string[];
}

interface GroupElements {
  tab: HTMLButtonElement;
  count: HTMLElement;
  panel: HTMLElement;
  list: HTMLElement;
}

type ViewTransitionDocument = { startViewTransition?: (update: () => void) => unknown };

const GROUPS: readonly PromptGroup[] = ['initial', 'followUp'];
const EXPORT_FILENAME = 'chatgpt-toolkit-prompts.json';
const MAX_TRACKED_WRITES = 20;

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Main controller for the options page.
 */
class OptionsController {
  private customPrompts: CustomPrompt[] = [];
  private activeTab: PromptGroup = 'initial';
  private searchQuery = '';
  private editing: EditingState | null = null;
  private formSnapshot = '';
  private isSaving = false;
  private isImporting = false;

  /** External storage changes that arrived while a dialog was open. */
  private pendingExternalPrompts: CustomPrompt[] | null = null;
  /** Serialized snapshots this page wrote, used to ignore our own `storage.onChanged` echoes. */
  private readonly ownWrites: string[] = [];
  private saveChain: Promise<unknown> = Promise.resolve();

  private readonly expandedPrompts = new WeakSet<CustomPrompt>();
  private readonly transitionKeys = new WeakMap<CustomPrompt, string>();
  private transitionKeyCounter = 0;
  private pendingFocus: FocusRequest | null = null;
  private overflowFrame = 0;

  private readonly ui: OptionsUIController;
  private readonly renderer = new PromptRenderer();

  private groups!: Record<PromptGroup, GroupElements>;
  private searchInput!: HTMLInputElement;
  private addPromptBtn!: HTMLButtonElement;
  private addPromptLabel!: HTMLElement;

  private promptModal!: HTMLDialogElement;
  private promptForm!: HTMLFormElement;
  private modalTitle!: HTMLElement;
  private promptIcon!: HTMLInputElement;
  private promptIconPreview!: HTMLElement;
  private promptTitle!: HTMLInputElement;
  private promptAltText!: HTMLInputElement;
  private promptText!: HTMLTextAreaElement;
  private promptArgsHint!: HTMLElement;
  private promptArgsInsert!: HTMLButtonElement;
  private promptArgsWarning!: HTMLElement;
  private promptAutoPaste!: HTMLInputElement;
  private promptAutoSubmit!: HTMLInputElement;
  private promptEnabled!: HTMLInputElement;
  private promptSaveBtn!: HTMLButtonElement;
  private promptGroupInputs!: HTMLInputElement[];

  private importModal!: HTMLDialogElement;
  private importText!: HTMLTextAreaElement;
  private importDropzone!: HTMLElement;
  private importFileInput!: HTMLInputElement;

  private readonly cardCallbacks: PromptCardCallbacks = {
    onEdit: (index) => this.openEditModal(index),
    onToggle: (index, enabled) => this.togglePrompt(index, enabled),
    onMove: (index, direction) => this.movePrompt(index, direction),
    onDelete: (index) => void this.deletePrompt(index),
    onExpandedChange: (index, expanded) => {
      const prompt = this.customPrompts[index];
      if (!prompt) return;
      if (expanded) {
        this.expandedPrompts.add(prompt);
      } else {
        this.expandedPrompts.delete(prompt);
      }
    },
  };

  constructor() {
    this.ui = new OptionsUIController('statusMessage', 'confirmDialog');
  }

  async init(): Promise<void> {
    this.initializeDOM();
    this.applyI18n();
    new ThemeSwitcher().init();
    this.attachEventListeners();
    this.listenForStorageChanges();
    this.updateTabsUI();
    this.customPrompts = await PromptsStorageService.loadPrompts();
    this.renderPrompts();
  }

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------

  private initializeDOM(): void {
    this.groups = {
      initial: {
        tab: byId<HTMLButtonElement>('tabInitialBtn'),
        count: byId('tabInitialCount'),
        panel: byId('panelInitial'),
        list: byId('promptsListInitial'),
      },
      followUp: {
        tab: byId<HTMLButtonElement>('tabFollowUpBtn'),
        count: byId('tabFollowUpCount'),
        panel: byId('panelFollowUp'),
        list: byId('promptsListFollowUp'),
      },
    };
    this.searchInput = byId<HTMLInputElement>('promptSearch');
    this.addPromptBtn = byId<HTMLButtonElement>('addPromptBtn');
    this.addPromptLabel = byId('addPromptLabel');

    this.promptModal = byId<HTMLDialogElement>('promptModal');
    this.promptForm = byId<HTMLFormElement>('promptForm');
    this.modalTitle = byId('modalTitle');
    this.promptIcon = byId<HTMLInputElement>('promptIcon');
    this.promptIconPreview = byId('promptIconPreview');
    this.promptTitle = byId<HTMLInputElement>('promptTitle');
    this.promptAltText = byId<HTMLInputElement>('promptAltText');
    this.promptText = byId<HTMLTextAreaElement>('promptText');
    this.promptArgsHint = byId('promptArgsHint');
    this.promptArgsInsert = byId<HTMLButtonElement>('promptArgsInsert');
    this.promptArgsWarning = byId('promptArgsWarning');
    this.promptAutoPaste = byId<HTMLInputElement>('promptAutoPaste');
    this.promptAutoSubmit = byId<HTMLInputElement>('promptAutoSubmit');
    this.promptEnabled = byId<HTMLInputElement>('promptEnabled');
    this.promptSaveBtn = byId<HTMLButtonElement>('promptSaveBtn');
    this.promptGroupInputs = Array.from(
      this.promptForm.querySelectorAll<HTMLInputElement>('input[name="promptGroup"]')
    );

    this.importModal = byId<HTMLDialogElement>('importModal');
    this.importText = byId<HTMLTextAreaElement>('importText');
    this.importDropzone = byId('importDropzone');
    this.importFileInput = byId<HTMLInputElement>('importFileInput');
  }

  private applyI18n(): void {
    applyPageI18n();
    this.renderShortcutHint();
  }

  /**
   * "⌘ Enter to save" / "Ctrl Enter to save" with the keys rendered as <kbd>.
   */
  private renderShortcutHint(): void {
    const hint = document.getElementById('saveShortcutHint');
    if (!hint) return;

    const marker = '';
    const [before, after = ''] = getMessage('options_modal_save_shortcut', marker).split(marker);
    hint.replaceChildren(before, ...shortcutKbds('Enter'), after);
  }

  private attachEventListeners(): void {
    this.addPromptBtn.addEventListener('click', () => this.openAddModal());
    byId('importBtn').addEventListener('click', () => this.openImportModal());
    byId('exportBtn').addEventListener('click', () => this.exportPrompts());
    byId('resetBtn').addEventListener('click', () => void this.resetToDefaults());

    this.attachTabListeners();
    this.attachSearchListeners();
    this.attachPromptModalListeners();
    this.attachImportModalListeners();

    // Re-measure clamped previews when the layout width changes.
    window.addEventListener('resize', () => this.scheduleOverflowCheck());
  }

  private attachTabListeners(): void {
    GROUPS.forEach((group) => {
      const { tab } = this.groups[group];
      tab.addEventListener('click', () => this.setActiveTab(group));
      tab.addEventListener('keydown', (event) => {
        const currentIndex = GROUPS.indexOf(this.activeTab);
        let nextIndex: number;
        switch (event.key) {
          case 'ArrowLeft':
            nextIndex = (currentIndex - 1 + GROUPS.length) % GROUPS.length;
            break;
          case 'ArrowRight':
            nextIndex = (currentIndex + 1) % GROUPS.length;
            break;
          case 'Home':
            nextIndex = 0;
            break;
          case 'End':
            nextIndex = GROUPS.length - 1;
            break;
          default:
            return;
        }
        event.preventDefault();
        const next = GROUPS[nextIndex];
        this.setActiveTab(next);
        this.groups[next].tab.focus();
      });
    });
  }

  private attachSearchListeners(): void {
    this.searchInput.addEventListener('input', () => {
      this.searchQuery = this.searchInput.value;
      this.renderPrompts();
    });

    this.searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.searchInput.value && !event.isComposing) {
        event.preventDefault();
        this.clearSearch();
        this.renderPrompts();
      }
    });

    // "/" focuses the search box, like many web apps.
    document.addEventListener('keydown', (event) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      if (document.querySelector('dialog[open]')) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      event.preventDefault();
      this.searchInput.focus();
      this.searchInput.select();
    });
  }

  private attachPromptModalListeners(): void {
    this.promptForm.addEventListener('submit', (event) => void this.savePromptFromForm(event));
    byId('cancelBtn').addEventListener('click', () => void this.requestClosePromptModal());
    byId('closeModalBtn').addEventListener('click', () => void this.requestClosePromptModal());

    // Escape: ask before discarding changes. Handling keydown (instead of only `cancel`) keeps the
    // dialog open reliably, and IME composition (Chinese/Japanese input) is left alone.
    this.promptModal.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || event.isComposing) return;
      event.preventDefault();
      void this.requestClosePromptModal();
    });
    this.promptModal.addEventListener('cancel', (event) => {
      event.preventDefault();
      void this.requestClosePromptModal();
    });
    onDialogBackdropClick(this.promptModal, () => void this.requestClosePromptModal());
    this.promptModal.addEventListener('close', () => this.onPromptModalClosed());

    // Ctrl/Cmd + Enter submits from any field.
    this.promptForm.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey) || event.isComposing) return;
      event.preventDefault();
      this.promptForm.requestSubmit();
    });

    [this.promptTitle, this.promptText].forEach((field) => {
      field.addEventListener('input', () => field.setCustomValidity(''));
    });

    this.promptGroupInputs.forEach((input) => {
      input.addEventListener('change', () => {
        if (input.checked) this.setEditingGroup(input.value === 'followUp' ? 'followUp' : 'initial');
      });
    });

    this.promptIcon.addEventListener('input', () => this.updateIconPreview());
    this.promptText.addEventListener('input', () => this.updateArgsUI());
    this.promptAutoPaste.addEventListener('change', () => this.updateArgsUI());

    // Keep the textarea's selection while clicking the {{args}} button.
    this.promptArgsInsert.addEventListener('pointerdown', (event) => event.preventDefault());
    this.promptArgsInsert.addEventListener('click', () => this.insertPromptArgsAtCursor());
  }

  private attachImportModalListeners(): void {
    byId('closeImportModalBtn').addEventListener('click', () => this.importModal.close());
    byId('cancelImportBtn').addEventListener('click', () => this.importModal.close());
    byId('confirmImportBtn').addEventListener('click', () => void this.importFromText(this.importText.value));
    byId('chooseImportFileBtn').addEventListener('click', () => this.importFileInput.click());
    onDialogBackdropClick(this.importModal, () => this.importModal.close());

    this.importModal.addEventListener('close', () => {
      this.importText.value = '';
      this.setDragOver(false);
      this.flushPendingExternalPrompts();
    });

    this.importFileInput.addEventListener('change', () => {
      const file = this.importFileInput.files?.[0];
      // Reset so choosing the same file again still fires `change`.
      this.importFileInput.value = '';
      if (file) void this.importFromFile(file);
    });

    const hasFiles = (event: DragEvent): boolean => Array.from(event.dataTransfer?.types ?? []).includes('Files');

    this.importText.addEventListener('dragenter', (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      this.setDragOver(true);
    });
    this.importText.addEventListener('dragover', (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      this.setDragOver(true);
    });
    this.importText.addEventListener('dragleave', () => this.setDragOver(false));
    this.importText.addEventListener('drop', (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      event.stopPropagation();
      this.setDragOver(false);
      const file = event.dataTransfer?.files?.[0];
      if (file) void this.importFromFile(file);
    });

    // A file dropped anywhere else must not navigate away from the options page.
    window.addEventListener('dragover', (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer && event.target !== this.importText) event.dataTransfer.dropEffect = 'none';
    });
    window.addEventListener('drop', (event) => {
      if (hasFiles(event)) event.preventDefault();
    });
  }

  private listenForStorageChanges(): void {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return;
        const change = changes[PROMPTS_STORAGE_KEY];
        if (!change || !Array.isArray(change.newValue)) return;
        this.handleExternalPrompts(change.newValue as CustomPrompt[]);
      });
    } catch {
      // Storage events are an enhancement; ignore when unavailable.
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private renderPrompts(): void {
    this.updateTabsUI();
    this.updateTabCounts();
    GROUPS.forEach((group) => this.renderGroup(group));
    this.applyPendingFocus();
    this.scheduleOverflowCheck();
  }

  private renderGroup(group: PromptGroup): void {
    const { list } = this.groups[group];
    const items = getGroupItems(this.customPrompts, group);
    const query = this.searchQuery.trim();
    const visible = query ? items.filter(({ prompt }) => matchesPromptQuery(prompt, query)) : items;

    if (items.length === 0) {
      list.replaceChildren(this.renderer.createEmptyState({
        message: getMessage(group === 'initial' ? 'options_empty_initial' : 'options_empty_followup'),
        actionLabel: getMessage(this.getModalTitleKey('add', group)),
        actionIcon: 'plus',
        onAction: () => this.openAddModal(group),
      }));
      return;
    }

    if (visible.length === 0) {
      list.replaceChildren(this.renderer.createEmptyState({
        message: getMessage('options_search_no_results', query),
        actionLabel: getMessage('options_search_clear'),
        actionVariant: 'secondary',
        art: false,
        onAction: () => {
          this.clearSearch();
          this.renderPrompts();
          this.searchInput.focus();
        },
      }));
      return;
    }

    const positions = new Map(items.map((item, position) => [item.index, position]));
    const ol = document.createElement('ol');
    ol.className = 'prompt-list';
    visible.forEach(({ prompt, index }) => {
      ol.append(this.renderer.createPromptCard({
        prompt,
        index,
        position: positions.get(index) ?? 0,
        groupSize: items.length,
        reorderEnabled: !query,
        expanded: this.expandedPrompts.has(prompt),
        transitionName: this.getTransitionName(prompt),
      }, this.cardCallbacks));
    });
    list.replaceChildren(ol);
  }

  private updateTabsUI(): void {
    GROUPS.forEach((group) => {
      const { tab, panel } = this.groups[group];
      const isActive = group === this.activeTab;
      tab.setAttribute('aria-selected', String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
      panel.hidden = !isActive;
    });
    // The add button names (and takes the color of) the group it adds to.
    this.addPromptBtn.dataset.group = this.activeTab;
    this.addPromptLabel.textContent = getMessage(this.getModalTitleKey('add', this.activeTab));
  }

  private updateTabCounts(): void {
    const counts = countByGroup(this.customPrompts);
    GROUPS.forEach((group) => {
      this.groups[group].count.textContent = String(counts[group]);
    });
  }

  private setActiveTab(group: PromptGroup): void {
    if (this.activeTab === group) return;
    this.activeTab = group;
    this.updateTabsUI();
    this.scheduleOverflowCheck();
  }

  private scheduleOverflowCheck(): void {
    window.cancelAnimationFrame(this.overflowFrame);
    this.overflowFrame = window.requestAnimationFrame(() => {
      this.renderer.updateOverflowToggles(this.groups[this.activeTab].panel);
    });
  }

  private applyPendingFocus(): void {
    const request = this.pendingFocus;
    if (!request) return;
    this.pendingFocus = null;

    const panel = this.groups[this.activeTab].panel;
    const card = request.index === undefined
      ? null
      : panel.querySelector<HTMLElement>(`.prompt-card[data-index="${request.index}"]`);

    for (const selector of request.selectors) {
      const target = card?.querySelector<HTMLElement>(selector);
      if (target && !(target as HTMLButtonElement).disabled) {
        target.focus();
        target.scrollIntoView({ block: 'nearest' });
        return;
      }
    }
    this.addPromptBtn.focus();
  }

  /** Stable per-object names so reordering can animate with the View Transitions API. */
  private getTransitionName(prompt: CustomPrompt): string {
    let key = this.transitionKeys.get(prompt);
    if (!key) {
      key = `prompt-card-${++this.transitionKeyCounter}`;
      this.transitionKeys.set(prompt, key);
    }
    return key;
  }

  /** Keep UI identity (animation name, expanded preview) when a prompt object is replaced. */
  private carryOverIdentity(from: CustomPrompt | undefined, to: CustomPrompt): void {
    if (!from) return;
    const key = this.transitionKeys.get(from);
    if (key) this.transitionKeys.set(to, key);
    if (this.expandedPrompts.has(from)) this.expandedPrompts.add(to);
  }

  private withViewTransition(update: () => void): void {
    const doc = document as unknown as ViewTransitionDocument;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (typeof doc.startViewTransition !== 'function' || reduceMotion) {
      update();
      return;
    }
    doc.startViewTransition(update);
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  /**
   * Queue a save. Saves run one at a time, in order, so rapid changes cannot overtake each other.
   */
  private enqueueSave(snapshot: CustomPrompt[]): Promise<boolean> {
    const json = JSON.stringify(snapshot);
    this.ownWrites.push(json);
    if (this.ownWrites.length > MAX_TRACKED_WRITES) this.ownWrites.shift();

    const run = this.saveChain.then(() => PromptsStorageService.savePrompts(snapshot));
    this.saveChain = run.catch(() => false);

    return run.catch(() => false).then((ok) => {
      if (ok) {
        // Our write supersedes anything that changed elsewhere while a dialog was open.
        this.pendingExternalPrompts = null;
      } else {
        const index = this.ownWrites.indexOf(json);
        if (index !== -1) this.ownWrites.splice(index, 1);
        this.ui.showStatus(getMessage('options_status_save_error'), 'error');
      }
      return ok;
    });
  }

  /**
   * Apply a change immediately and save in the background (for inline list actions).
   * On failure the list is re-synced from storage.
   */
  private applyChange(next: CustomPrompt[], options: { render?: boolean; animate?: boolean; focus?: FocusRequest } = {}): void {
    // State updates synchronously so rapid follow-up actions always build on it; only the
    // re-render may be deferred into a view transition.
    this.customPrompts = next;
    if (options.focus) this.pendingFocus = options.focus;
    if (options.render !== false) {
      if (options.animate) {
        this.withViewTransition(() => this.renderPrompts());
      } else {
        this.renderPrompts();
      }
    }

    void this.enqueueSave(next).then((ok) => {
      if (!ok) void this.resyncFromStorage();
    });
  }

  /**
   * Save first and only then update the list (for dialog flows, so a failed save keeps the dialog open).
   */
  private async commitChange(next: CustomPrompt[]): Promise<boolean> {
    const ok = await this.enqueueSave(next);
    if (ok) this.customPrompts = next;
    return ok;
  }

  private async resyncFromStorage(): Promise<void> {
    await this.saveChain;
    const stored = await PromptsStorageService.readStoredPrompts();
    if (stored && !arePromptListsEqual(stored, this.customPrompts)) {
      this.customPrompts = stored;
      this.renderPrompts();
    }
  }

  private handleExternalPrompts(next: CustomPrompt[]): void {
    const json = JSON.stringify(next);
    const ownIndex = this.ownWrites.indexOf(json);
    if (ownIndex !== -1) {
      this.ownWrites.splice(0, ownIndex + 1);
      return;
    }
    if (json === JSON.stringify(this.customPrompts)) return;

    // Never swap the list under an open dialog (edit form, confirmation, import).
    if (document.querySelector('dialog[open]')) {
      this.pendingExternalPrompts = next;
      return;
    }

    this.customPrompts = next;
    this.renderPrompts();
  }

  private flushPendingExternalPrompts(): void {
    const next = this.pendingExternalPrompts;
    if (!next || document.querySelector('dialog[open]')) return;
    this.pendingExternalPrompts = null;
    if (arePromptListsEqual(next, this.customPrompts)) return;
    this.customPrompts = next;
    this.renderPrompts();
  }

  // ---------------------------------------------------------------------------
  // Inline list actions
  // ---------------------------------------------------------------------------

  private togglePrompt(index: number, enabled: boolean): void {
    const current = this.customPrompts[index];
    if (!current) return;
    const next = setPromptEnabledAt(this.customPrompts, index, enabled);
    this.carryOverIdentity(current, next[index]);
    // The card already reflects the new state; skip the re-render so the switch keeps focus and animates.
    this.applyChange(next, { render: false });
  }

  private movePrompt(index: number, direction: -1 | 1): void {
    if (this.searchQuery.trim()) return;
    const result = movePromptWithinGroup(this.customPrompts, index, direction);
    if (!result) return;

    const same = direction === -1 ? '[data-action="move-up"]' : '[data-action="move-down"]';
    const other = direction === -1 ? '[data-action="move-down"]' : '[data-action="move-up"]';
    this.applyChange(result.prompts, { animate: true, focus: { index: result.index, selectors: [same, other] } });
  }

  private async deletePrompt(index: number): Promise<void> {
    const prompt = this.customPrompts[index];
    if (!prompt) return;

    const title = (typeof prompt.title === 'string' && prompt.title.trim()) || getMessage('options_prompt_title_fallback');
    const confirmed = await this.ui.confirm({
      message: getMessage('options_confirm_delete_prompt', title),
      confirmLabel: getMessage('options_confirm_delete_button'),
      danger: true,
    });
    if (!confirmed) return;

    const currentIndex = this.customPrompts.indexOf(prompt);
    if (currentIndex === -1) return;

    // Move focus to the next visible card of the group, else the previous one.
    const query = this.searchQuery.trim();
    const visible = getGroupItems(this.customPrompts, getPromptGroup(prompt))
      .filter((item) => !query || matchesPromptQuery(item.prompt, query));
    const position = visible.findIndex((item) => item.index === currentIndex);
    const neighbour = visible[position + 1] ?? visible[position - 1];
    const focusIndex = neighbour
      ? (neighbour.index > currentIndex ? neighbour.index - 1 : neighbour.index)
      : undefined;

    this.applyChange(removePromptAt(this.customPrompts, currentIndex), {
      focus: { index: focusIndex, selectors: ['[data-action="edit"]'] },
    });
    this.ui.showStatus(getMessage('options_status_prompt_deleted'), 'success');
  }

  private clearSearch(): void {
    this.searchInput.value = '';
    this.searchQuery = '';
  }

  // ---------------------------------------------------------------------------
  // Add / edit dialog
  // ---------------------------------------------------------------------------

  private openAddModal(group: PromptGroup = this.activeTab): void {
    this.setActiveTab(group);
    this.openPromptModal({ mode: 'add', group, index: -1 });
  }

  private openEditModal(index: number): void {
    const prompt = this.customPrompts[index];
    if (!prompt) return;
    this.openPromptModal({ mode: 'edit', group: getPromptGroup(prompt), index }, prompt);
  }

  private openPromptModal(state: EditingState, prompt?: CustomPrompt): void {
    if (this.promptModal.open) return;
    this.editing = state;
    this.writeFormValues(getPromptFormValues(prompt));
    this.setEditingGroup(state.group);
    this.formSnapshot = this.serializeForm();
    this.promptModal.showModal();
    this.promptTitle.focus();
  }

  /**
   * Apply the group chosen in the type picker: title, accent color and radio state follow it.
   */
  private setEditingGroup(group: PromptGroup): void {
    if (!this.editing) return;
    this.editing.group = group;
    this.promptModal.dataset.group = group;
    this.promptGroupInputs.forEach((input) => {
      input.checked = input.value === group;
    });
    this.modalTitle.textContent = getMessage(this.getModalTitleKey(this.editing.mode, group));
  }

  private serializeForm(): string {
    return JSON.stringify({ ...this.readFormValues(), group: this.editing?.group });
  }

  private getModalTitleKey(action: 'add' | 'edit', group: PromptGroup): string {
    const isInitial = group === 'initial';
    if (action === 'add') {
      return isInitial ? 'options_modal_title_add_initial' : 'options_modal_title_add_followup';
    }
    return isInitial ? 'options_modal_title_edit_initial' : 'options_modal_title_edit_followup';
  }

  private readFormValues(): PromptFormValues {
    return {
      svgIcon: this.promptIcon.value,
      title: this.promptTitle.value,
      altText: this.promptAltText.value,
      prompt: this.promptText.value,
      autoPaste: this.promptAutoPaste.checked,
      autoSubmit: this.promptAutoSubmit.checked,
      enabled: this.promptEnabled.checked,
    };
  }

  private writeFormValues(values: PromptFormValues): void {
    this.promptIcon.value = values.svgIcon;
    this.promptTitle.value = values.title;
    this.promptAltText.value = values.altText;
    this.promptText.value = values.prompt;
    this.promptAutoPaste.checked = values.autoPaste;
    this.promptAutoSubmit.checked = values.autoSubmit;
    this.promptEnabled.checked = values.enabled;
    this.promptTitle.setCustomValidity('');
    this.promptText.setCustomValidity('');
    this.updateIconPreview();
    this.updateArgsUI();
  }

  private isFormDirty(): boolean {
    return this.editing !== null && this.serializeForm() !== this.formSnapshot;
  }

  private updateIconPreview(): void {
    this.promptIconPreview.replaceChildren(renderPromptIcon(this.promptIcon.value));
  }

  private updateArgsUI(): void {
    const autoPaste = this.promptAutoPaste.checked;
    this.promptArgsHint.hidden = !autoPaste;
    this.promptArgsWarning.hidden = autoPaste || !this.promptText.value.includes(ARGS_PLACEHOLDER);
  }

  private insertPromptArgsAtCursor(): void {
    if (!this.promptAutoPaste.checked) return;
    insertTextAtCaret(this.promptText, ARGS_PLACEHOLDER);
  }

  private async requestClosePromptModal(): Promise<void> {
    if (!this.promptModal.open) return;

    if (this.isFormDirty()) {
      const discard = await this.ui.confirm({
        message: getMessage('options_confirm_discard_changes'),
        confirmLabel: getMessage('options_confirm_discard_button'),
        cancelLabel: getMessage('options_confirm_keep_editing'),
        danger: true,
      });
      if (!discard) return;
    }

    this.promptModal.close();
  }

  private onPromptModalClosed(): void {
    this.editing = null;
    this.formSnapshot = '';
    this.writeFormValues(getPromptFormValues());
    this.flushPendingExternalPrompts();
  }

  private validateForm(): boolean {
    const requiredFields: Array<HTMLInputElement | HTMLTextAreaElement> = [this.promptTitle, this.promptText];
    requiredFields.forEach((field) => {
      field.setCustomValidity(field.value.trim() ? '' : getMessage('options_validation_required'));
    });
    if (this.promptForm.checkValidity()) return true;
    this.promptForm.reportValidity();
    return false;
  }

  private async savePromptFromForm(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const state = this.editing;
    if (!state || this.isSaving || !this.validateForm()) return;

    const base = state.mode === 'edit' ? this.customPrompts[state.index] : undefined;
    const prompt = buildPromptFromForm(this.readFormValues(), state.group, base);

    let next: CustomPrompt[];
    let index: number;
    if (base && getPromptGroup(base) === state.group) {
      next = replacePromptAt(this.customPrompts, state.index, prompt);
      index = state.index;
      this.carryOverIdentity(base, prompt);
    } else if (base) {
      // Moved to the other group: place it at the top of that group, like a new prompt.
      ({ prompts: next, index } = insertPromptAtTop(removePromptAt(this.customPrompts, state.index), prompt));
      this.carryOverIdentity(base, prompt);
    } else {
      ({ prompts: next, index } = insertPromptAtTop(this.customPrompts, prompt));
    }

    this.isSaving = true;
    this.promptSaveBtn.disabled = true;
    const ok = await this.commitChange(next);
    this.isSaving = false;
    this.promptSaveBtn.disabled = false;
    if (!ok) return;

    this.promptModal.close();
    this.activeTab = state.group;
    if (this.searchQuery.trim() && !matchesPromptQuery(prompt, this.searchQuery)) {
      this.clearSearch();
    }
    this.pendingFocus = { index, selectors: ['[data-action="edit"]'] };
    this.renderPrompts();
    this.ui.showStatus(getMessage('options_status_save_success'), 'success');
  }

  // ---------------------------------------------------------------------------
  // Import / export / reset
  // ---------------------------------------------------------------------------

  private openImportModal(): void {
    if (this.importModal.open) return;
    this.importText.value = '';
    this.importModal.showModal();
    this.importText.focus();
  }

  private setDragOver(isOver: boolean): void {
    this.importDropzone.classList.toggle('is-drag-over', isOver);
  }

  private async importFromFile(file: File): Promise<void> {
    let text: string;
    try {
      text = await file.text();
    } catch (error) {
      this.ui.showStatus(getMessage('options_status_file_read_error', errorMessage(error)), 'error');
      return;
    }
    this.importText.value = text;
    await this.importFromText(text);
  }

  private async importFromText(text: string): Promise<void> {
    if (this.isImporting) return;

    let imported: CustomPrompt[];
    try {
      imported = PromptsStorageService.importPrompts(text);
    } catch (error) {
      this.ui.showStatus(getMessage('options_status_import_error', errorMessage(error)), 'error');
      return;
    }

    this.isImporting = true;
    try {
      const confirmed = await this.ui.confirm({
        message: getMessage('options_confirm_import', String(imported.length)),
        confirmLabel: getMessage('options_import_confirm_button'),
      });
      if (!confirmed || !(await this.commitChange(imported))) return;

      this.importModal.close();
      this.clearSearch();
      this.renderPrompts();
      this.ui.showStatus(getMessage('options_status_import_success', String(imported.length)), 'success');
    } finally {
      this.isImporting = false;
    }
  }

  private exportPrompts(): void {
    downloadFile(PromptsStorageService.exportPrompts(this.customPrompts), EXPORT_FILENAME, 'application/json');
    this.ui.showStatus(getMessage('options_status_export_success'), 'success');
  }

  private async resetToDefaults(): Promise<void> {
    const confirmed = await this.ui.confirm({
      message: getMessage('options_confirm_reset'),
      confirmLabel: getMessage('options_confirm_reset_button'),
      danger: true,
    });
    if (!confirmed) return;

    // Deep copies: later edits must never mutate DEFAULT_PROMPTS.
    if (!(await this.commitChange(PromptsStorageService.getDefaultPrompts()))) return;

    this.activeTab = 'initial';
    this.clearSearch();
    this.renderPrompts();
    this.ui.showStatus(getMessage('options_status_reset_success'), 'success');
  }
}

// Initialize when DOM is ready
const start = (): void => {
  void new OptionsController().init();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
