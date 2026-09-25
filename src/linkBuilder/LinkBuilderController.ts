import { OptionsUIController, onDialogBackdropClick } from '../options/ui/OptionsUIController';
import { ThemeSwitcher } from '../options/ui/ThemeSwitcher';
import { createIcon, iconHref, type IconName } from '../options/ui/icons';
import { byId, element, insertTextAtCaret, shortcutKbds, shortcutText } from '../options/utils/dom';
import { getLocalStorage } from '../options/utils/helpers';
import { applyPageI18n, getMessage, getMessagesLangTag } from '../options/utils/i18n';
import { parseBuilderParams, parseImportedLink } from './linkImport';
import { LINK_OPTIONS, type LinkOptions } from './promptLink';
import { PROVIDERS, findProvider, type Provider, type TargetChoice } from './sites';
import { readState, resolveLink, writeState, type LinkBuilderState, type ResolvedLink, type UnavailableReason } from './state';
import { getPromptTemplates, type PromptTemplate } from './templates';

/** The outputs a copy button copies (its `data-copy`). */
type CopyableOutput = 'url' | 'markdown' | 'searchName' | 'searchUrl';

const SEARCH_ENGINE_SETTINGS_URL = 'chrome://settings/searchEngines';
const COPIED_FEEDBACK_MS = 1600;

/**
 * Host shown on a provider tile, with the path only when services share a host
 * (`chatgpt.com` / `chatgpt.com/images`).
 */
function providerDetail(provider: Provider): string {
  const url = new URL(provider.url);
  const host = url.hostname.replace(/^www\./, '');
  const path = url.pathname.replace(/\/+$/, '');
  const sharesHost = PROVIDERS.some((other) => other !== provider && new URL(other.url).hostname === url.hostname);
  return sharesHost && path ? `${host}${path}` : host;
}

/**
 * The link split into parts for coloring, like an address bar. `withScheme` keeps `https://`.
 */
function renderUrl(url: string, withScheme: boolean): Node[] {
  const hashIndex = url.indexOf('#');
  const base = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex + 1);

  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    return [document.createTextNode(url)];
  }

  const host = `${withScheme ? `${parsed.protocol}//` : ''}${parsed.host}`;
  const nodes: Node[] = [element('span', 'url-host', host)];
  const path = `${parsed.pathname}${parsed.search}`;
  if (path !== '/' || withScheme || hash) nodes.push(element('span', 'url-path', path));
  if (!hash) return nodes;

  nodes.push(element('span', 'url-punct', '#'));
  const segments = hash.split('&');
  for (let index = 0; index < segments.length; index++) {
    if (index > 0) nodes.push(element('span', 'url-punct', '&'));
    const segment = segments[index];
    const separator = segment.indexOf('=');
    if (separator === -1) {
      nodes.push(element('span', 'url-value', segment));
      continue;
    }
    const key = segment.slice(0, separator);
    nodes.push(element('span', 'url-key', key), element('span', 'url-punct', '='));
    if (key === 'prompt') {
      // Like the content script, everything after `prompt=` is the prompt.
      nodes.push(element('span', 'url-prompt', segments.slice(index).join('&').slice(separator + 1)));
      break;
    }
    nodes.push(element('span', 'url-value', segment.slice(separator + 1)));
  }
  return nodes;
}

/**
 * The prompt link builder page (link-builder.html), opened from the toolbar button's context menu.
 */
class LinkBuilderController {
  private state: LinkBuilderState;
  private view!: ResolvedLink;
  private templates: readonly PromptTemplate[] = [];
  private readonly ui: OptionsUIController;
  private readonly copyTimers = new WeakMap<HTMLButtonElement, number>();

  private providerPicker!: HTMLFieldSetElement;
  private customUrlField!: HTMLElement;
  private customUrlInput!: HTMLInputElement;
  private customUrlMessage!: HTMLElement;
  private promptInput!: HTMLTextAreaElement;
  private titleInput!: HTMLInputElement;
  private optionInputs!: Record<keyof LinkOptions, HTMLInputElement>;
  private omniboxUrl!: HTMLElement;
  private bookmarkLink!: HTMLAnchorElement;
  private bookmarkIcon!: SVGUseElement;
  private bookmarkTitle!: HTMLElement;
  private resultNotice!: HTMLElement;
  private resultNoticeText!: HTMLElement;
  private openLinkBtn!: HTMLAnchorElement;
  private openLinkLabel!: HTMLElement;
  private urlOutput!: HTMLElement;
  private markdownOutput!: HTMLElement;
  private searchNameOutput!: HTMLElement;
  private searchUrlOutput!: HTMLElement;
  private searchTermsNote!: HTMLElement;
  private liveAnnouncer!: HTMLElement;
  private templatesDialog!: HTMLDialogElement;
  private importDialog!: HTMLDialogElement;
  private importInput!: HTMLTextAreaElement;
  private importError!: HTMLElement;

  constructor(private readonly codec: ChatGPTToolkitContentUtils) {
    this.state = readState(getLocalStorage());
    this.ui = new OptionsUIController('statusMessage');
  }

  init(): void {
    this.initializeDOM();
    applyPageI18n();
    new ThemeSwitcher().init();
    this.templates = getPromptTemplates(getMessagesLangTag());
    this.renderProviders();
    this.renderTemplates();
    this.renderShortcutKeys();
    this.applyHashParams();
    this.writeInputs();
    this.attachEventListeners();
    this.update({ save: false });
  }

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------

  private initializeDOM(): void {
    this.providerPicker = byId<HTMLFieldSetElement>('providerPicker');
    this.customUrlField = byId('customUrlField');
    this.customUrlInput = byId<HTMLInputElement>('customUrl');
    this.customUrlMessage = byId('customUrlMessage');
    this.promptInput = byId<HTMLTextAreaElement>('promptText');
    this.titleInput = byId<HTMLInputElement>('linkTitle');
    this.optionInputs = {
      autoSubmit: byId<HTMLInputElement>('autoSubmit'),
      pasteImage: byId<HTMLInputElement>('pasteImage'),
      imageTool: byId<HTMLInputElement>('imageTool'),
    };
    this.omniboxUrl = byId('omniboxUrl');
    this.bookmarkLink = byId<HTMLAnchorElement>('bookmarkLink');
    this.bookmarkIcon = byId<SVGUseElement>('bookmarkIcon');
    this.bookmarkTitle = byId('bookmarkTitle');
    this.resultNotice = byId('resultNotice');
    this.resultNoticeText = byId('resultNoticeText');
    this.openLinkBtn = byId<HTMLAnchorElement>('openLinkBtn');
    this.openLinkLabel = byId('openLinkLabel');
    this.urlOutput = byId('urlOutput');
    this.markdownOutput = byId('markdownOutput');
    this.searchNameOutput = byId('searchNameOutput');
    this.searchUrlOutput = byId('searchUrlOutput');
    this.searchTermsNote = byId('searchTermsNote');
    this.liveAnnouncer = byId('liveAnnouncer');
    this.templatesDialog = byId<HTMLDialogElement>('templatesDialog');
    this.importDialog = byId<HTMLDialogElement>('importDialog');
    this.importInput = byId<HTMLTextAreaElement>('importInput');
    this.importError = byId('importError');
  }

  private renderProviders(): void {
    const choices: Array<{ id: TargetChoice; name: string; detail: string; icon: IconName }> = [
      ...PROVIDERS.map((provider) => ({ id: provider.id, name: provider.name, detail: providerDetail(provider), icon: provider.icon })),
      { id: 'custom', name: getMessage('link_builder_custom_name'), detail: getMessage('link_builder_custom_hint'), icon: 'globe' },
    ];

    const tiles = choices.map((choice) => {
      const label = element('label', choice.id === 'custom' ? 'provider provider--custom' : 'provider');
      const input = element('input', 'provider__input');
      input.type = 'radio';
      input.name = 'target';
      input.value = choice.id;

      const icon = element('span', 'provider__icon');
      icon.append(createIcon(choice.icon));

      const text = element('span', 'provider__text');
      text.append(element('span', 'provider__name', choice.name), element('span', 'provider__detail', choice.detail));
      label.append(input, icon, text);
      return label;
    });
    this.providerPicker.append(...tiles);
  }

  private renderTemplates(): void {
    const items = this.templates.map((template) => {
      const item = element('li');
      const button = element('button', 'template');
      button.type = 'button';
      button.append(element('span', 'template__name', template.name), element('span', 'template__prompt', template.prompt));
      button.addEventListener('click', () => this.applyTemplate(template));
      item.append(button);
      return item;
    });
    byId('templateList').replaceChildren(...items);
  }

  private renderShortcutKeys(): void {
    const bookmarksBar = byId('bookmarksBarKeys');
    bookmarksBar.replaceChildren(
      element('span', undefined, getMessage('link_builder_bookmarks_bar_shortcut')),
      ...shortcutKbds('B', { shift: true })
    );
    this.openLinkBtn.title = shortcutText('Enter');
  }

  /** `link-builder.html#subject=…&prompt=…` (the original web builder's parameters) prefills the form once. */
  private applyHashParams(): void {
    const fields = parseBuilderParams(location.hash);
    if (!fields) return;
    this.state = { ...this.state, ...fields };
    history.replaceState(null, document.title, location.pathname + location.search);
    writeState(getLocalStorage(), this.state);
  }

  private attachEventListeners(): void {
    // Jump into the URL field only when "Custom URL" is clicked: arrow keys also change the
    // selection, and must keep moving through the tiles.
    let pickedWithPointer = false;
    this.providerPicker.addEventListener('pointerdown', () => {
      pickedWithPointer = true;
    });
    this.providerPicker.addEventListener('keydown', () => {
      pickedWithPointer = false;
    });
    this.providerPicker.addEventListener('change', (event) => {
      const input = event.target as HTMLInputElement;
      if (input.name === 'target' && input.checked) this.selectTarget(input.value as TargetChoice, pickedWithPointer);
    });

    this.customUrlInput.addEventListener('input', () => {
      this.state.customUrl = this.customUrlInput.value;
      this.update();
    });

    this.promptInput.addEventListener('input', () => {
      this.state.prompt = this.promptInput.value;
      this.update();
    });

    this.titleInput.addEventListener('input', () => {
      this.state.title = this.titleInput.value;
      this.update();
    });

    LINK_OPTIONS.forEach((key) => {
      this.optionInputs[key].addEventListener('change', () => {
        this.state[key] = this.optionInputs[key].checked;
        this.update();
      });
    });

    // Insert at the caret when typing in the prompt (pointerdown keeps its focus), else at the end.
    const insertButton = byId<HTMLButtonElement>('insertSearchTermsBtn');
    insertButton.addEventListener('pointerdown', (event) => event.preventDefault());
    insertButton.addEventListener('click', () => {
      if (document.activeElement !== this.promptInput) {
        const end = this.promptInput.value.length;
        this.promptInput.setSelectionRange(end, end);
      }
      insertTextAtCaret(this.promptInput, '%s');
    });

    document.querySelectorAll<HTMLButtonElement>('.copy-btn').forEach((button) => {
      button.addEventListener('click', () => void this.copy(button.dataset.copy as CopyableOutput, button));
    });

    this.openLinkBtn.addEventListener('click', (event) => {
      if (!this.view.ready) event.preventDefault();
    });
    this.bookmarkLink.addEventListener('click', (event) => {
      if (!this.view.ready) event.preventDefault();
    });
    this.bookmarkLink.addEventListener('dragstart', (event) => {
      if (!this.view.ready) event.preventDefault();
    });

    // Ctrl/⌘ + Enter opens the link from anywhere on the page.
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey) || event.isComposing) return;
      if (document.querySelector('dialog[open]') || !this.view.ready) return;
      event.preventDefault();
      window.open(this.view.url, '_blank', 'noopener');
    });

    byId('openSearchSettingsBtn').addEventListener('click', () => void this.openSearchEngineSettings());
    byId('managePromptsBtn').addEventListener('click', () => void chrome.runtime.openOptionsPage());
    byId('openTemplatesBtn').addEventListener('click', () => this.openTemplatesDialog());
    byId('importLinkBtn').addEventListener('click', () => this.openImportDialog());

    [this.templatesDialog, this.importDialog].forEach((dialog) => {
      onDialogBackdropClick(dialog, () => dialog.close());
      dialog.querySelectorAll('[data-close-dialog]').forEach((button) => {
        button.addEventListener('click', () => dialog.close());
      });
    });

    byId<HTMLFormElement>('importForm').addEventListener('submit', (event) => {
      event.preventDefault();
      this.importLink();
    });
    this.importInput.addEventListener('input', () => this.setImportError(false));
    this.importDialog.addEventListener('close', () => {
      this.importInput.value = '';
      this.setImportError(false);
    });
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  private selectTarget(target: TargetChoice, focusUrl = false): void {
    const previous = findProvider(this.state.target);
    this.state.target = target;

    // Start the custom URL from the service that was selected, e.g. to append a GPT's path.
    if (target === 'custom' && !this.state.customUrl.trim() && previous) {
      this.state.customUrl = previous.url;
      this.customUrlInput.value = previous.url;
    }
    this.update();

    if (target === 'custom' && focusUrl) {
      this.customUrlInput.focus();
      const end = this.customUrlInput.value.length;
      this.customUrlInput.setSelectionRange(end, end);
    }
  }

  private applyTemplate(template: PromptTemplate): void {
    this.templatesDialog.close();
    // Replace the whole prompt as one edit, so Ctrl/⌘ + Z brings the previous one back.
    this.promptInput.focus();
    this.promptInput.select();
    insertTextAtCaret(this.promptInput, template.prompt);

    // Name the link after the template, unless the user already named it.
    const title = this.titleInput.value.trim();
    if (!title || this.templates.some((item) => item.name === title)) {
      this.titleInput.value = template.name;
      this.state.title = template.name;
      this.update();
    }

    this.ui.showStatus(getMessage('link_builder_template_applied', [template.name, shortcutText('Z')]), 'success');
  }

  private openTemplatesDialog(): void {
    if (this.templatesDialog.open) return;
    this.templatesDialog.showModal();
    // Start on the first template so it can be picked with the keyboard right away.
    this.templatesDialog.querySelector<HTMLButtonElement>('.template')?.focus();
  }

  private openImportDialog(): void {
    if (this.importDialog.open) return;
    this.importDialog.showModal();
    this.importInput.focus();
  }

  private setImportError(visible: boolean): void {
    this.importError.hidden = !visible;
    this.importInput.setAttribute('aria-invalid', String(visible));
  }

  private importLink(): void {
    const imported = parseImportedLink(this.importInput.value, this.codec);
    if (!imported) {
      this.setImportError(true);
      this.importInput.focus();
      return;
    }
    this.state = imported;
    this.writeInputs();
    this.update();
    this.importDialog.close();
    this.ui.showStatus(getMessage('link_builder_import_success'), 'success');
  }

  private textFor(output: CopyableOutput): string {
    switch (output) {
      case 'url':
        return this.view.url;
      case 'markdown':
        return this.view.markdown;
      case 'searchName':
        return this.view.siteSearchName;
      case 'searchUrl':
        return this.view.siteSearchUrl;
    }
  }

  private async copy(output: CopyableOutput, button: HTMLButtonElement): Promise<void> {
    const text = this.textFor(output);
    if (!text) return;

    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      copied = this.copyWithSelection(text);
    }

    if (!copied) {
      this.ui.showStatus(getMessage('link_builder_copy_error'), 'error');
      return;
    }
    this.showCopied(button);
    this.announce(getMessage('link_builder_status_copied'));
  }

  private copyWithSelection(text: string): boolean {
    const scratch = element('textarea');
    scratch.value = text;
    scratch.setAttribute('readonly', '');
    scratch.style.position = 'fixed';
    scratch.style.opacity = '0';
    document.body.append(scratch);
    scratch.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      scratch.remove();
    }
  }

  private showCopied(button: HTMLButtonElement): void {
    const label = button.querySelector<HTMLElement>('.copy-btn__label');
    const icon = button.querySelector('use');
    button.classList.add('is-copied');
    if (label) label.textContent = getMessage('link_builder_copied');
    icon?.setAttribute('href', iconHref('check'));

    window.clearTimeout(this.copyTimers.get(button));
    this.copyTimers.set(button, window.setTimeout(() => {
      button.classList.remove('is-copied');
      if (label) label.textContent = getMessage('link_builder_copy');
      icon?.setAttribute('href', iconHref('copy'));
    }, COPIED_FEEDBACK_MS));
  }

  private announce(message: string): void {
    // Re-announce identical messages by clearing first.
    this.liveAnnouncer.textContent = '';
    window.setTimeout(() => {
      this.liveAnnouncer.textContent = message;
    }, 50);
  }

  private async openSearchEngineSettings(): Promise<void> {
    try {
      await chrome.tabs.create({ url: SEARCH_ENGINE_SETTINGS_URL });
    } catch {
      this.ui.showStatus(getMessage('link_builder_search_settings_error'), 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  /** Copy the state into the form fields (on load and after an import). */
  private writeInputs(): void {
    this.providerPicker.querySelectorAll<HTMLInputElement>('input[name="target"]').forEach((input) => {
      input.checked = input.value === this.state.target;
    });
    this.customUrlInput.value = this.state.customUrl;
    this.promptInput.value = this.state.prompt;
    this.titleInput.value = this.state.title;
  }

  private update(options: { save?: boolean } = {}): void {
    this.view = resolveLink(this.state, this.codec);
    this.renderTarget();
    this.renderOptions();
    this.renderResult();
    this.renderSiteSearch();
    if (options.save !== false) writeState(getLocalStorage(), this.state);
  }

  private renderTarget(): void {
    const isCustom = this.state.target === 'custom';
    this.customUrlField.hidden = !isCustom;

    let messageKey = '';
    if (isCustom && this.view.problem) {
      messageKey = this.view.problem === 'empty' ? 'link_builder_custom_url_empty' : 'link_builder_custom_url_invalid';
    } else if (isCustom && !this.view.site) {
      messageKey = 'link_builder_custom_url_unsupported';
    }
    this.customUrlInput.setAttribute('aria-invalid', String(isCustom && this.view.problem !== null));

    // Only touch the live region when the message changes, so typing is not announced on every key.
    if (this.customUrlMessage.dataset.key !== messageKey) {
      this.customUrlMessage.dataset.key = messageKey;
      const message = messageKey ? element('p', this.view.problem ? 'field__error' : 'field__warning') : null;
      message?.append(createIcon(this.view.problem ? 'alert-circle' : 'alert-triangle'), element('span', undefined, getMessage(messageKey)));
      this.customUrlMessage.replaceChildren(...(message ? [message] : []));
    }

    this.titleInput.placeholder = this.view.siteName || getMessage('link_builder_bookmark_placeholder');
  }

  private renderOptions(): void {
    const { site, unavailable } = this.view;
    const reasonText: Record<UnavailableReason, string> = {
      'site-unsupported': getMessage('link_builder_site_unsupported'),
      'generates-images': getMessage('link_builder_image_tool_builtin', site?.name ?? ''),
      'feature-unsupported': getMessage('link_builder_feature_unavailable', site?.name ?? ''),
    };

    LINK_OPTIONS.forEach((key) => {
      const input = this.optionInputs[key];
      const reason = unavailable[key];
      input.disabled = Boolean(reason);
      input.checked = !reason && this.state[key];
      input.closest<HTMLElement>('.switch-row')?.classList.toggle('is-unavailable', Boolean(reason));

      const note = byId(`${key}Note`);
      note.hidden = !reason;
      if (reason) note.textContent = reasonText[reason];
    });
  }

  private renderResult(): void {
    const { ready, url, baseUrl, siteName, title, markdown } = this.view;

    this.omniboxUrl.replaceChildren(...(ready ? renderUrl(url, false) : baseUrl ? renderUrl(baseUrl, false) : []));

    this.bookmarkTitle.textContent = title || getMessage('link_builder_bookmark_placeholder');
    this.bookmarkIcon.setAttribute('href', iconHref(this.view.icon));
    this.setLinkEnabled(this.bookmarkLink, ready ? url : '');
    this.bookmarkLink.draggable = ready;

    this.resultNotice.hidden = ready;
    if (!ready) {
      this.resultNoticeText.textContent = getMessage(baseUrl ? 'link_builder_result_empty' : 'link_builder_result_url_problem');
    }

    this.openLinkLabel.textContent = siteName ? getMessage('link_builder_open', siteName) : getMessage('link_builder_open_fallback');
    this.setLinkEnabled(this.openLinkBtn, ready ? url : '');

    this.urlOutput.replaceChildren(...(ready ? renderUrl(url, true) : []));
    this.markdownOutput.textContent = markdown;
    this.setCopyEnabled('url', ready);
    this.setCopyEnabled('markdown', ready);
  }

  private renderSiteSearch(): void {
    const { siteSearchName, siteSearchUrl, searchTermsInPrompt } = this.view;
    this.searchNameOutput.textContent = siteSearchName;
    this.searchUrlOutput.replaceChildren(...(siteSearchUrl ? renderUrl(siteSearchUrl, true) : []));
    this.setCopyEnabled('searchName', Boolean(siteSearchName));
    this.setCopyEnabled('searchUrl', Boolean(siteSearchUrl));

    // "%s" is shown as a token inside the sentence.
    const message = getMessage(searchTermsInPrompt ? 'link_builder_search_terms_in_prompt' : 'link_builder_search_terms_appended');
    const parts = message.split('%s');
    const nodes: Node[] = [];
    parts.forEach((part, index) => {
      if (index > 0) nodes.push(element('code', 'inline-token', '%s'));
      nodes.push(document.createTextNode(part));
    });
    this.searchTermsNote.replaceChildren(...nodes);
  }

  private setLinkEnabled(link: HTMLAnchorElement, href: string): void {
    if (href) {
      link.href = href;
      link.removeAttribute('aria-disabled');
      link.removeAttribute('tabindex');
    } else {
      link.removeAttribute('href');
      link.setAttribute('aria-disabled', 'true');
      link.tabIndex = -1;
    }
  }

  private setCopyEnabled(output: CopyableOutput, enabled: boolean): void {
    document.querySelectorAll<HTMLButtonElement>(`.copy-btn[data-copy="${output}"]`).forEach((button) => {
      button.disabled = !enabled;
    });
  }
}

const start = (): void => {
  const codec = window.ChatGPTToolkitContentUtils;
  if (!codec) {
    console.error('[ChatGPTToolkit] link-builder.html must load scripts/content-utils.js before scripts/link-builder.js.');
    return;
  }
  new LinkBuilderController(codec).init();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
