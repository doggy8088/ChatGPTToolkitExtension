import type { ContentContext } from '../context';
import { extractPromptEditorText } from '../editorText';
import {
  CUSTOM_PROMPTS_KEY,
  getLocaleDefaultFollowUpPrompts,
  getReadyPromptsSignature,
  loadCustomPrompts,
  resolveAutoPastePrompt,
  selectReadyPrompts,
  type PromptItem,
  type ReadyPrompt,
} from '../prompts';

type MarkmapInstanceHandle = {
  destroy: () => void;
  fit: () => void;
};

// ChatGPT serves several front-ends side by side: the 2026 app shell (logged in), the older
// React app and the logged-out "Octane" app. Every lookup lists the current markup first and
// keeps the older selectors as fallbacks.
const COMPOSER_FORM_SELECTORS = [
  'form[data-chatgpt-composer]',
  'form[data-type="unified-composer"]',
  'form[data-mobile-composer]',
];

const PROMPT_EDITOR_SELECTORS = [
  '#prompt-textarea',
  '[data-composer-markdown][contenteditable="true"]',
  'textarea[name="prompt"]',
  '[contenteditable="true"][role="textbox"]',
  'textarea[data-testid*="prompt"]',
  'textarea[placeholder]',
  'textarea',
  '[contenteditable="true"][data-virtualkeyboard="true"]',
  '[contenteditable="true"]',
];

const SEND_BUTTON_SELECTORS = [
  'button[data-testid="composer-send-button"]',
  'button[data-testid="send-button"]',
  'button[data-testid*="send-button"]',
  'button[data-composer-submit]',
  'button[aria-label*="Submit"]',
  'button[aria-label*="Send"]',
  'button[aria-label*="傳送"]',
  'button[aria-label*="送出"]',
  'button[aria-label*="送信"]',
];

// Messages, turns and inline edit forms. Nothing inside these belongs to the main composer.
const CONVERSATION_CONTENT_SELECTOR =
  '[data-turn-key], [data-content-search-unit-key], article[data-turn], [data-message-author-role]';
const ASSISTANT_UNIT_SELECTOR =
  '[data-content-search-unit-key$=":assistant"], [data-chatgpt-search-unit-key$=":assistant"]';
const USER_MESSAGE_SELECTOR =
  '[data-content-search-unit-key$=":user"], [data-chatgpt-search-unit-key$=":user"], div[data-message-author-role="user"]';

// The send button turns into a stop button while a reply streams; only its (localized) label changes.
const STOP_LABEL_PATTERN = /stop|停止|中止|중지/i;
const NOT_STOP_LABEL_PATTERN = /dictat|voice|record|聽寫|語音|音声|録音|음성/i;
const EDIT_LABEL_PATTERN = /edit|編輯|编辑|編集|修改|편집/i;

const INITIAL_BAR_ID = 'custom-chatgpt-initial-buttons';
const FOLLOW_UP_AREA_ID = 'custom-chatgpt-magic-box-buttons';
const STYLE_ID = 'custom-chatgpt-button-styles';
const HEADING_SHIFT_ATTR = 'data-chatgpttoolkit-chatgpt-heading-shift';
const MARKMAP_SCANNED_ATTR = 'data-chatgpttoolkit-markmap';
const REBUILD_THROTTLE_MS = 150;
const HEADING_SHIFT_PX = 48;

// Colors derive from the inherited text color, so the buttons match light and dark themes
// without depending on how the page marks its theme (it has used `.dark`, `data-theme`, ...).
const BUTTON_STYLES = `
  #${INITIAL_BAR_ID} {
    position: absolute;
    bottom: 100%;
    left: 0;
    z-index: 10;
    box-sizing: border-box;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    width: 100%;
    margin: 0;
    padding: 0.15rem 0.25rem;
    transform: translateY(-16px);
    pointer-events: auto;
  }
  #${FOLLOW_UP_AREA_ID} {
    box-sizing: border-box;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem 0 0.25rem;
  }
  #${FOLLOW_UP_AREA_ID}.chatgpttoolkit-legacy-area {
    margin: 0 auto;
    padding: 0.75rem 1rem 1rem calc(30px + 0.75rem);
  }
  .chatgpttoolkit-btn {
    box-sizing: border-box;
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0.3rem 0.85rem;
    border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, currentColor 5%, transparent);
    color: inherit;
    font: inherit;
    font-size: 0.82rem;
    font-weight: 500;
    line-height: 1.25;
    letter-spacing: 0.01em;
    white-space: nowrap;
    cursor: pointer;
    transition: background-color 140ms ease, border-color 140ms ease, transform 140ms ease;
  }
  #${FOLLOW_UP_AREA_ID} .chatgpttoolkit-btn {
    padding: 0.4rem 0.95rem;
    font-size: 0.875rem;
  }
  .chatgpttoolkit-btn:hover {
    border-color: color-mix(in srgb, currentColor 36%, transparent);
    background: color-mix(in srgb, currentColor 11%, transparent);
    transform: translateY(-1px);
  }
  .chatgpttoolkit-btn:active {
    transform: translateY(0);
  }
  .chatgpttoolkit-btn:focus-visible,
  .chatgpttoolkit-markmap-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, currentColor 60%, transparent);
    outline-offset: 2px;
  }
  .chatgpttoolkit-markmap-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    margin: 0;
    padding: 0.2rem 0.5rem;
    border: 0;
    border-radius: 0.375rem;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 0.75rem;
    line-height: 1.25rem;
    cursor: pointer;
    user-select: none;
  }
  .chatgpttoolkit-markmap-btn:hover {
    background: color-mix(in srgb, currentColor 10%, transparent);
  }
  .chatgpttoolkit-markmap {
    overflow: hidden;
  }
  @media (prefers-reduced-motion: reduce) {
    .chatgpttoolkit-btn {
      transition: none;
    }
    .chatgpttoolkit-btn:hover {
      transform: none;
    }
  }
`;

const MINDMAP_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" viewBox="0 0 128 128" aria-hidden="true"><path fill="#F5E41C" stroke="#010100" stroke-width="2" d="M76.35 109.75C61.4 101.92 53.99 89.4 51.84 73.08c-10.98 0-21.78.02-32.59-.01-6.37-.02-10.02-2.86-10.14-7.79-.12-5.04 3.8-8.19 10.32-8.21 10.65-.03 21.3-.01 31.75-.01.38-.47.7-.68.74-.95 4.5-25.18 19.67-39.08 46.09-42.08 4.79-.54 9.62-.89 14.44-.97 5.2-.09 8.51 3.02 8.67 7.62.17 4.86-3.14 7.72-8.53 8.4-8.53 1.07-17.29 1.71-25.44 4.2-11.36 3.46-17.21 11.76-18.83 23.78h39.47c1.67 0 3.34-.08 5 .03 5.1.33 8.32 3.55 8.25 8.17-.07 4.6-3.33 7.74-8.53 7.78-12.83.09-25.65.03-38.48.04h-5.8c1.45 10.83 6.64 18.94 16.52 22.73 7.02 2.69 14.74 3.62 22.19 5.15 2.09.43 4.33.03 6.48.28 5.05.57 8.02 4 7.68 8.68-.31 4.4-3.5 7.19-8.52 7.22-12.45.07-24.53-1.79-36.23-7.37z"/></svg>';

export function initChatGPT(ctx: ContentContext) {
  const { state, debug } = ctx;

  // Initial buttons are only allowed on the ChatGPT home page (root path).
  // Every other page (projects, GPTs, scheduled, deep-research, library, ...) is excluded
  // because the injected bar interferes with the page's own controls.
  function isInitialButtonsAllowedPage() {
    const pathname = (location.pathname || '/').replace(/\/+$/, '') || '/';
    return pathname === '/';
  }

  function isElementVisible(el: HTMLElement | null) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;

    const rect = el.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) return true;
    return el.getClientRects().length > 0;
  }

  function isInsideConversation(el: Element) {
    return Boolean(el.closest(CONVERSATION_CONTENT_SELECTOR));
  }

  function getComposerForm() {
    for (const selector of COMPOSER_FORM_SELECTORS) {
      const forms = Array.from(document.querySelectorAll<HTMLFormElement>(selector)).filter(
        (form) => !isInsideConversation(form)
      );
      const match = forms.find((form) => isElementVisible(form)) || forms[0];
      if (match) return match;
    }
    return null;
  }

  function isStopButton(button: HTMLButtonElement) {
    if (button.hidden) return false;
    const label = (button.getAttribute('aria-label') || '').trim();
    if (!label) return false;

    const stopLabel = button.getAttribute('data-stop-label');
    if (stopLabel) return label === stopLabel;
    if (button.getAttribute('type') === 'submit') return false;
    return STOP_LABEL_PATTERN.test(label) && !NOT_STOP_LABEL_PATTERN.test(label);
  }

  function isGenerating() {
    if (document.querySelector('button[data-testid="stop-button"]')) return true;
    const form = getComposerForm();
    if (!form) return false;
    return Array.from(form.querySelectorAll<HTMLButtonElement>('button')).some(isStopButton);
  }

  function pickSendButton(buttons: HTMLButtonElement[]) {
    const candidates = buttons.filter((button) => !button.hidden && !isStopButton(button));
    return candidates.find((button) => isElementVisible(button) && !button.disabled) || candidates[0] || null;
  }

  function getSendButton() {
    const form = getComposerForm();
    if (form) {
      for (const selector of [...SEND_BUTTON_SELECTORS, 'button[type="submit"]']) {
        const button = pickSendButton(Array.from(form.querySelectorAll<HTMLButtonElement>(selector)));
        if (button) return button;
      }
    }

    for (const selector of SEND_BUTTON_SELECTORS) {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(selector)).filter(
        (button) => !isInsideConversation(button)
      );
      const button = pickSendButton(buttons);
      if (button) return button;
    }

    return null;
  }

  function isSendButtonEnabled(sendButton: HTMLButtonElement | null): sendButton is HTMLButtonElement {
    if (!sendButton) return false;
    if (sendButton.disabled) return false;
    if (sendButton.getAttribute('aria-disabled') === 'true') return false;
    return true;
  }

  function getComposerRoot(): ParentNode {
    return (
      getComposerForm() ||
      getSendButton()?.closest<HTMLElement>('form, main') ||
      document.querySelector<HTMLElement>('main') ||
      document
    );
  }

  function getPromptEditor() {
    const root = getComposerRoot();
    for (const selector of PROMPT_EDITOR_SELECTORS) {
      const candidates = Array.from(root.querySelectorAll<HTMLElement>(selector));
      const match = candidates.find(
        (el) => isElementVisible(el) && !el.closest('[aria-hidden="true"]') && !isInsideConversation(el)
      );
      if (match) return match;
    }
    return null;
  }

  function hasConversationMessages() {
    return Boolean(
      document.querySelector(
        '[data-turn-key], [data-content-search-unit-key], div[data-message-author-role="assistant"], div[data-message-author-role="user"]'
      )
    );
  }

  function isDarkTheme() {
    const root = document.documentElement;
    if (root.classList.contains('dark') || root.dataset.theme === 'dark') return true;
    if (root.classList.contains('light') || root.dataset.theme === 'light') return false;
    return window.getComputedStyle(root).colorScheme === 'dark';
  }

  function ensureButtonStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = BUTTON_STYLES;
    (document.head || document.documentElement).appendChild(styleEl);
  }

  function setChatGPTPromptEditor(editorDiv: HTMLElement | null, promptText: string) {
    if (!editorDiv) return;
    if (editorDiv instanceof HTMLTextAreaElement) {
      ctx.fillTextareaAndDispatchInput(editorDiv, promptText);
      editorDiv.focus();
      return;
    }
    ctx.fillContentEditableWithParagraphs(editorDiv, promptText);
    editorDiv.dispatchEvent(new Event('input', { bubbles: true }));
    editorDiv.focus();
  }

  function bindPromptButton(button: HTMLButtonElement, item: ReadyPrompt, label: 'initial' | 'follow-up') {
    const autoPasteEnabled = item.autoPaste === true;
    const autoSubmitEnabled = item.autoSubmit === true;
    let lastTriggerAt = 0;

    const trigger = (source: string) => {
      const now = Date.now();
      if (now - lastTriggerAt < 250) {
        if (debug) {
          console.log(`[ChatGPTToolkit][chatgpt] ${label} button trigger ignored`, {
            source,
            title: item.title,
            deltaMs: now - lastTriggerAt,
          });
        }
        return;
      }
      lastTriggerAt = now;

      if (debug) {
        console.log(`[ChatGPTToolkit][chatgpt] ${label} button trigger`, {
          source,
          title: item.title,
          autoPasteEnabled,
          autoSubmitEnabled,
          promptLength: item.prompt.length,
        });
      }

      if (!autoPasteEnabled) {
        fillPrompt(item.prompt, autoSubmitEnabled);
        return;
      }

      const editorText = extractPromptEditorText(getPromptEditor());
      void resolveAutoPastePrompt(item.prompt, editorText, debug, 'chatgpt').then((resolved) => {
        if (debug) {
          console.log(`[ChatGPTToolkit][chatgpt] ${label} button args resolved`, {
            title: item.title,
            argsSource: resolved.argsSource,
            argsLength: resolved.argsLength,
            nextPromptLength: resolved.prompt.length,
          });
        }
        fillPrompt(resolved.prompt, autoSubmitEnabled);
      });
    };

    // Trigger on pointerdown so the composer keeps its text selection and focus;
    // keyboard activation (detail === 0) still arrives as a click.
    button.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      trigger('pointerdown');
    });

    button.addEventListener('click', (event) => {
      if (event.detail !== 0) return;
      trigger('click');
    });
  }

  function createPromptButton(item: ReadyPrompt, label: 'initial' | 'follow-up') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chatgpttoolkit-btn';
    button.textContent = item.title;
    if (item.altText) button.title = String(item.altText);
    bindPromptButton(button, item, label);
    return button;
  }

  function describeElement(el: Element | null) {
    if (!el) return 'null';
    const htmlEl = el as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const id = htmlEl.id ? `#${htmlEl.id}` : '';
    const className = htmlEl.className
      ? `.${String(htmlEl.className).trim().split(/\s+/).slice(0, 2).join('.')}`
      : '';
    return `${tag}${id}${className}`;
  }

  function logEditorState(editorDiv: HTMLElement, label: string) {
    if (!debug) return;
    const text = (
      editorDiv instanceof HTMLTextAreaElement ? editorDiv.value : editorDiv.textContent || ''
    ).replace(/\s+/g, ' ').trim();
    console.log(`[ChatGPTToolkit][chatgpt] ${label}`, {
      activeElement: describeElement(document.activeElement),
      textLength: text.length,
      textPreview: text.slice(0, 120),
    });
  }

  function placeCaretAtEnd(editorDiv: HTMLElement) {
    if (editorDiv instanceof HTMLTextAreaElement) {
      editorDiv.selectionStart = editorDiv.selectionEnd = editorDiv.value.length;
      return;
    }

    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(editorDiv);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function guessKeyCode(key: string) {
    if (key.length === 1) {
      const lower = key.toLowerCase();
      if (lower >= 'a' && lower <= 'z') {
        return `Key${lower.toUpperCase()}`;
      }
      if (key === '/') return 'Slash';
      if (key === ' ') return 'Space';
    }
    return key;
  }

  function dispatchKeyEvent(editorDiv: HTMLElement, type: 'keydown' | 'keypress' | 'keyup', key: string) {
    const charCode = key.length === 1 ? key.charCodeAt(0) : undefined;
    const eventInit: KeyboardEventInit = {
      key,
      code: guessKeyCode(key),
      keyCode: charCode,
      which: charCode,
      bubbles: true,
      cancelable: true,
    };
    const event = new KeyboardEvent(type, eventInit);
    const dispatched = editorDiv.dispatchEvent(event);
    if (debug) {
      console.log(`[ChatGPTToolkit][chatgpt] ${type} "${key}" dispatched=${dispatched}`);
    }
    return dispatched;
  }

  function dispatchInputEvent(editorDiv: HTMLElement, data: string) {
    try {
      const event = new InputEvent('input', {
        bubbles: true,
        data,
        inputType: 'insertText',
      });
      const dispatched = editorDiv.dispatchEvent(event);
      if (debug) console.log('[ChatGPTToolkit][chatgpt] input event dispatched', { data, dispatched });
      return dispatched;
    } catch {
      const dispatched = editorDiv.dispatchEvent(new Event('input', { bubbles: true }));
      if (debug) console.log('[ChatGPTToolkit][chatgpt] input event fallback dispatched', { data, dispatched });
      return dispatched;
    }
  }

  function insertTextAtCursor(editorDiv: HTMLElement, text: string) {
    editorDiv.focus();
    try {
      const inserted = document.execCommand('insertText', false, text);
      if (debug) console.log('[ChatGPTToolkit][chatgpt] execCommand insertText', { text, inserted });
      return inserted;
    } catch {
      if (debug) console.log('[ChatGPTToolkit][chatgpt] execCommand insertText failed', { text });
      return false;
    }
  }

  async function typePromptCommand(editorDiv: HTMLElement, text: string, delayMs: number) {
    if (window.location.href.startsWith('https://chatgpt.com/images')) {
      if (debug) {
        console.log('[ChatGPTToolkit][chatgpt] skip typing prompt command on images page', { text });
      }
      return;
    }

    editorDiv.focus();
    placeCaretAtEnd(editorDiv);

    if (debug) {
      console.log('[ChatGPTToolkit][chatgpt] typing command', { text, delayMs });
    }

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      dispatchKeyEvent(editorDiv, 'keydown', char);
      dispatchKeyEvent(editorDiv, 'keypress', char);
      const inserted = insertTextAtCursor(editorDiv, char);
      if (!inserted) {
        if (editorDiv instanceof HTMLTextAreaElement) {
          editorDiv.value += char;
        } else {
          editorDiv.textContent = (editorDiv.textContent || '') + char;
        }
        editorDiv.dispatchEvent(new Event('input', { bubbles: true }));
      }
      dispatchInputEvent(editorDiv, char);
      dispatchKeyEvent(editorDiv, 'keyup', char);
      logEditorState(editorDiv, `after char ${i + 1}`);
      await ctx.delay(delayMs);
    }
    if (debug) console.log('[ChatGPTToolkit][chatgpt] typing command complete');
  }

  function pressTabKey(editorDiv: HTMLElement) {
    const eventInit: KeyboardEventInit = {
      key: 'Tab',
      code: 'Tab',
      keyCode: 9,
      which: 9,
      bubbles: true,
      cancelable: true,
    };
    const downDispatched = editorDiv.dispatchEvent(new KeyboardEvent('keydown', eventInit));
    const upDispatched = editorDiv.dispatchEvent(new KeyboardEvent('keyup', eventInit));
    if (debug) {
      console.log('[ChatGPTToolkit][chatgpt] tab key dispatched', {
        downDispatched,
        upDispatched,
      });
    }
  }

  async function selectImageTool(editorDiv: HTMLElement) {
    if (debug) console.log('[ChatGPTToolkit][chatgpt] selectImageTool start');
    logEditorState(editorDiv, 'before selectImageTool');
    setChatGPTPromptEditor(editorDiv, '');
    logEditorState(editorDiv, 'after clear');
    placeCaretAtEnd(editorDiv);
    await typePromptCommand(editorDiv, '/image', 60);
    logEditorState(editorDiv, 'after typing /image');
    pressTabKey(editorDiv);
    if (debug) console.log('[ChatGPTToolkit][chatgpt] waiting after tab');
    await ctx.delay(500);
    logEditorState(editorDiv, 'after tab wait');
  }

  const AutoFillFromURI = async (textarea: HTMLElement | null) => {
    ctx.refreshParamsFromHash();

    if (!textarea) return;
    if (!state.prompt && !state.tool) return;

    if (debug) {
      console.log('[ChatGPTToolkit][chatgpt] AutoFillFromURI start', {
        tool: state.tool,
        promptLength: state.prompt.length,
      });
    }

    if (state.tool === 'image') {
      await selectImageTool(textarea);
    }

    if (state.prompt) {
      logEditorState(textarea, 'before prompt fill');
      setChatGPTPromptEditor(textarea, state.prompt);
      logEditorState(textarea, 'after prompt fill');
    }

    history.replaceState({}, document.title, window.location.pathname + window.location.search);
    if (debug) console.log('[ChatGPTToolkit][chatgpt] AutoFillFromURI done');
  };

  const StartMonitoringResponse = async () => {
    const localeDefaultFollowUps = getLocaleDefaultFollowUpPrompts(chrome.i18n?.getUILanguage());
    let followUpPrompts: ReadyPrompt[] = localeDefaultFollowUps;
    let initialPrompts: ReadyPrompt[] = [];

    const customPrompts = await loadCustomPrompts();
    if (Array.isArray(customPrompts)) {
      followUpPrompts = selectReadyPrompts(customPrompts, false);
      initialPrompts = selectReadyPrompts(customPrompts, true);
    }

    let renderedInitialSignature = '';
    let renderedFollowUpSignature = '';
    let followUpAnchor: Element | null = null;
    let shiftedInitialHeading: HTMLElement | null = null;

    function setInitialButtonsHeadingShift(headingTarget: HTMLElement | null) {
      if (shiftedInitialHeading && shiftedInitialHeading !== headingTarget) {
        shiftedInitialHeading.style.removeProperty('transform');
        shiftedInitialHeading.removeAttribute(HEADING_SHIFT_ATTR);
      }

      shiftedInitialHeading = headingTarget;
      if (!headingTarget) return;

      const transform = `translateY(-${HEADING_SHIFT_PX}px)`;
      if (headingTarget.style.getPropertyValue('transform') !== transform) {
        headingTarget.style.setProperty('transform', transform);
      }
      if (headingTarget.getAttribute(HEADING_SHIFT_ATTR) !== 'true') {
        headingTarget.setAttribute(HEADING_SHIFT_ATTR, 'true');
      }
    }

    function findHeadingCandidates(scope: ParentNode, selector: string, anchor: HTMLElement, bar: HTMLElement) {
      const anchorRect = anchor.getBoundingClientRect();
      const pageCenter = window.innerWidth / 2;
      return Array.from(scope.querySelectorAll<HTMLElement>(selector))
        .filter((item) => {
          if (item === bar || item.contains(bar) || bar.contains(item)) return false;
          if (anchor.contains(item) || item.contains(anchor)) return false;

          const text = (item.textContent || '').replace(/\s+/g, ' ').trim();
          if (text.length < 2 || text.length > 80) return false;

          const rect = item.getBoundingClientRect();
          if (rect.bottom > anchorRect.top) return false;
          if (rect.top < 80) return false;
          if (!isElementVisible(item)) return false;

          const fontSize = Number.parseFloat(window.getComputedStyle(item).fontSize || '0');
          return Number.isFinite(fontSize) && fontSize >= 20;
        })
        .map((item) => {
          const rect = item.getBoundingClientRect();
          return {
            item,
            centerDistance: Math.abs(rect.left + rect.width / 2 - pageCenter),
            verticalDistance: anchorRect.top - rect.bottom,
            area: rect.width * rect.height,
          };
        })
        .sort((a, b) => {
          if (Math.abs(a.verticalDistance - b.verticalDistance) > 8) {
            return a.verticalDistance - b.verticalDistance;
          }
          if (Math.abs(a.centerDistance - b.centerDistance) > 8) {
            return a.centerDistance - b.centerDistance;
          }
          // Prefer the wrapper, so every copy of a duplicated heading moves together.
          return b.area - a.area;
        });
    }

    function getInitialButtonsHeadingTarget(anchor: HTMLElement, bar: HTMLElement) {
      // Only scan the part of the page that holds the home heading, not the whole sidebar.
      let scope: HTMLElement | null = anchor.parentElement;
      while (scope && scope !== document.body && !scope.querySelector('h1, h2')) {
        scope = scope.parentElement;
      }
      const root: ParentNode = scope || document;
      const headings = findHeadingCandidates(root, 'h1, h2', anchor, bar);
      if (headings.length === 0) {
        return findHeadingCandidates(root, 'h1, h2, div, span', anchor, bar)[0]?.item || null;
      }

      // Climb to the largest wrapper that still sits above the composer with the same heading.
      const heading = headings[0].item;
      const wrapped = findHeadingCandidates(root, 'div', anchor, bar).find(
        (candidate) => candidate.item.contains(heading) && candidate.verticalDistance <= headings[0].verticalDistance + 8
      );
      return wrapped?.item || heading;
    }

    function removeInitialButtons() {
      document.getElementById(INITIAL_BAR_ID)?.remove();
      renderedInitialSignature = '';
      setInitialButtonsHeadingShift(null);
    }

    function rebuildInitialButtons() {
      if (
        !isInitialButtonsAllowedPage() ||
        initialPrompts.length === 0 ||
        hasConversationMessages() ||
        isGenerating()
      ) {
        removeInitialButtons();
        return;
      }

      const editor = getPromptEditor();
      const form = getComposerForm() || editor?.closest<HTMLFormElement>('form') || null;
      if (!editor || !form) {
        removeInitialButtons();
        return;
      }

      const signature = getReadyPromptsSignature(initialPrompts);
      let bar = document.getElementById(INITIAL_BAR_ID);
      const isUpToDate = bar?.parentElement === form && signature === renderedInitialSignature;

      if (!isUpToDate) {
        ensureButtonStyles();
        if (!bar) {
          bar = document.createElement('div');
          bar.id = INITIAL_BAR_ID;
        }
        bar.replaceChildren(...initialPrompts.map((item) => createPromptButton(item, 'initial')));

        if (window.getComputedStyle(form).position === 'static') {
          form.style.setProperty('position', 'relative');
        }
        if (bar.parentElement !== form) form.appendChild(bar);
        renderedInitialSignature = signature;
      }

      if (!isUpToDate || !shiftedInitialHeading?.isConnected) {
        setInitialButtonsHeadingShift(getInitialButtonsHeadingTarget(form, bar!));
      }
    }

    function getLegacyAssistantBlocks() {
      for (const selector of [
        'article[data-testid^="conversation-turn-"][data-turn="assistant"]',
        'article[data-turn="assistant"]',
        'div[data-message-author-role="assistant"]',
      ]) {
        const blocks = Array.from(document.querySelectorAll<HTMLElement>(selector));
        if (blocks.length > 0) return blocks;
      }
      return [];
    }

    /**
     * Walk up from the assistant message to the container that also holds its action bar
     * (copy / rate / regenerate). The action bar only renders once the reply is complete,
     * so a missing bar means the reply is still streaming.
     */
    function findActionBarColumn(unit: HTMLElement, boundary: Element | null) {
      let column: HTMLElement | null = null;
      let current: HTMLElement = unit;
      for (let depth = 0; depth < 12 && current.parentElement && current !== boundary; depth += 1) {
        const parent = current.parentElement;
        for (let sibling = current.nextElementSibling; sibling; sibling = sibling.nextElementSibling) {
          if (sibling.id !== FOLLOW_UP_AREA_ID && sibling.querySelector('button')) {
            column = parent;
            break;
          }
        }
        current = parent;
      }
      return column;
    }

    function getFollowUpMount(): { anchor: Element; mount: (area: HTMLElement) => void } | null {
      const units = document.querySelectorAll<HTMLElement>(ASSISTANT_UNIT_SELECTOR);
      if (units.length > 0) {
        const unit = units[units.length - 1];
        const column = findActionBarColumn(unit, unit.closest('[data-turn-key]'));
        if (!column) return null;
        return { anchor: unit, mount: (area) => column.appendChild(area) };
      }

      const blocks = getLegacyAssistantBlocks();
      const lastBlock = blocks[blocks.length - 1];
      if (!lastBlock) return null;
      return {
        anchor: lastBlock,
        mount: (area) => {
          area.classList.add('chatgpttoolkit-legacy-area', 'md:max-w-2xl', 'lg:max-w-2xl', 'xl:max-w-3xl');
          lastBlock.after(area);
        },
      };
    }

    function removeFollowUpButtons() {
      document.querySelectorAll(`#${FOLLOW_UP_AREA_ID}`).forEach((item) => item.remove());
      followUpAnchor = null;
      renderedFollowUpSignature = '';
    }

    function rebuildFollowUpButtons() {
      if (followUpPrompts.length === 0 || isGenerating() || !getPromptEditor()) {
        removeFollowUpButtons();
        return;
      }

      const target = getFollowUpMount();
      if (!target) {
        removeFollowUpButtons();
        return;
      }

      const signature = getReadyPromptsSignature(followUpPrompts);
      const existing = document.getElementById(FOLLOW_UP_AREA_ID);
      if (existing && followUpAnchor === target.anchor && renderedFollowUpSignature === signature) {
        addMarkmapButtons();
        return;
      }

      removeFollowUpButtons();
      ensureButtonStyles();

      const area = document.createElement('div');
      area.id = FOLLOW_UP_AREA_ID;
      area.className = 'custom-buttons-area';
      area.append(...followUpPrompts.map((item) => createPromptButton(item, 'follow-up')));
      target.mount(area);

      followUpAnchor = target.anchor;
      renderedFollowUpSignature = signature;
      addMarkmapButtons();
    }

    let rebuildTimer: ReturnType<typeof setTimeout> | undefined;

    const observer = new MutationObserver(() => {
      if (location.pathname.startsWith('/gpts/editor')) return;
      scheduleRebuild();
    });

    function observe() {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        // Octane toggles the send/stop button in place and hides controls with `hidden`.
        attributeFilter: ['aria-label', 'hidden'],
      });
    }

    function rebuildAll() {
      observer.disconnect();
      try {
        rebuildInitialButtons();
        rebuildFollowUpButtons();
      } finally {
        observe();
      }
    }

    // Throttle instead of debounce: streaming replies mutate the DOM continuously, and the
    // buttons still have to disappear as soon as a reply starts.
    function scheduleRebuild() {
      if (rebuildTimer !== undefined) return;
      rebuildTimer = setTimeout(() => {
        rebuildTimer = undefined;
        rebuildAll();
      }, REBUILD_THROTTLE_MS);
    }

    if (chrome?.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return;
        const change = changes?.[CUSTOM_PROMPTS_KEY];
        if (!change) return;

        const nextPrompts = Array.isArray(change.newValue) ? (change.newValue as PromptItem[]) : null;
        followUpPrompts = nextPrompts ? selectReadyPrompts(nextPrompts, false) : localeDefaultFollowUps;
        initialPrompts = nextPrompts ? selectReadyPrompts(nextPrompts, true) : [];

        removeInitialButtons();
        removeFollowUpButtons();
        rebuildAll();
      });
    }

    rebuildAll();
  };

  setTimeout(() => {
    void StartMonitoringResponse();
  }, 1000);

  function maybePasteImageIntoChatGPT() {
    const textarea = getPromptEditor();
    if (!textarea) return Promise.resolve();

    state.pastingImage = true;
    if (debug) console.log('[ChatGPTToolkit][chatgpt] pasting clipboard image');

    return ctx
      .delay(300)
      .then(() => ctx.fetchClipboardImageAndSimulatePaste(textarea))
      .then(() => {
        if (debug) console.log('[ChatGPTToolkit][chatgpt] clipboard image pasted');
        state.pasteImage = false;
        state.pastingImage = false;
      });
  }

  function maybeAutoSubmitChatGPT() {
    const sendButton = getSendButton();
    if (!isSendButtonEnabled(sendButton)) return;
    if (debug) console.log('[ChatGPTToolkit][chatgpt] auto submit from URL');
    sendButton.click();
    state.autoSubmit = false;
  }

  // Handles `#pasteImage=1` / `#autoSubmit=1` after the URL prompt is filled. The loop stops
  // once both are done (or after a minute, e.g. when the send button never becomes enabled).
  function startUrlAutomationLoop() {
    if (!state.autoSubmit && !state.pasteImage) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if ((!state.autoSubmit && !state.pasteImage) || Date.now() - startedAt > 60_000) {
        clearInterval(timer);
        return;
      }
      if (state.pastingImage) return;
      if (state.pasteImage) {
        void maybePasteImageIntoChatGPT();
        return;
      }
      maybeAutoSubmitChatGPT();
    }, 60);
  }

  let autoFillInProgress = false;
  const checkForTextareaInput = setInterval(async () => {
    const textarea = getPromptEditor();
    if (textarea && !autoFillInProgress) {
      autoFillInProgress = true;
      clearInterval(checkForTextareaInput);
      await AutoFillFromURI(textarea);
      startUrlAutomationLoop();
    }
  }, 60);

  function autoSubmitWhenReady() {
    if (debug) console.log('[ChatGPTToolkit][chatgpt] autoSubmitWhenReady start');
    ctx.startRetryInterval({
      intervalMs: 80,
      retries: 25,
      tick: () => {
        const sendButton = getSendButton();
        if (debug) {
          console.log('[ChatGPTToolkit][chatgpt] autoSubmitWhenReady tick', {
            hasSendButton: Boolean(sendButton),
            enabled: isSendButtonEnabled(sendButton),
          });
        }
        if (!isSendButtonEnabled(sendButton)) return false;
        if (debug) console.log('[ChatGPTToolkit][chatgpt] autoSubmitWhenReady click send');
        sendButton.click();
        return true;
      },
    });
  }

  function normalizeEditorText(text: string) {
    return text.replace(/\s+/g, ' ').trim();
  }

  let promptFillRunId = 0;

  function fillPrompt(prompt: string, autoSubmit = true) {
    const runId = ++promptFillRunId;
    const expected = normalizeEditorText(prompt);
    let autoSubmitScheduled = false;
    if (debug) {
      console.log('[ChatGPTToolkit][chatgpt] fillPrompt start', {
        runId,
        autoSubmit,
        promptLength: prompt.length,
        expectedLength: expected.length,
      });
    }

    ctx.startRetryInterval({
      intervalMs: 80,
      retries: 15,
      tick: () => {
        if (runId !== promptFillRunId) return true;

        const div = getPromptEditor();
        if (debug && !div) {
          console.log('[ChatGPTToolkit][chatgpt] fillPrompt tick: textarea missing', { runId });
        }
        if (!div) return false;

        const current = normalizeEditorText(extractPromptEditorText(div));
        const hasPrompt = expected.length > 0 ? current.includes(expected) : current.length > 0;
        if (debug) {
          console.log('[ChatGPTToolkit][chatgpt] fillPrompt tick', {
            runId,
            currentLength: current.length,
            expectedLength: expected.length,
            hasPrompt,
          });
        }

        if (hasPrompt) {
          div.focus();
          placeCaretAtEnd(div);
          if (autoSubmit && !autoSubmitScheduled) {
            autoSubmitScheduled = true;
            autoSubmitWhenReady();
          }
          return true;
        }

        setChatGPTPromptEditor(div, prompt);
        placeCaretAtEnd(div);
        if (debug) {
          console.log('[ChatGPTToolkit][chatgpt] fillPrompt wrote prompt', {
            runId,
            promptLength: prompt.length,
          });
        }
        return false;
      },
    });
  }

  function findEditMessageButton(userMessage: HTMLElement) {
    const buttons = Array.from(userMessage.querySelectorAll<HTMLButtonElement>('button'));
    const labelled = buttons.find((button) =>
      EDIT_LABEL_PATTERN.test(button.getAttribute('aria-label') || button.title || '')
    );
    if (labelled) return labelled;
    // The older React app rendered the edit button first.
    return userMessage.matches('div[data-message-author-role="user"]') ? buttons[0] || null : null;
  }

  function focusMessageEditor(scope: HTMLElement) {
    ctx.startRetryInterval({
      intervalMs: 50,
      retries: 20,
      tick: () => {
        const editor = Array.from(
          scope.querySelectorAll<HTMLElement>('textarea, [contenteditable="true"]')
        ).find((el) => isElementVisible(el));
        if (!editor) return false;
        editor.focus();
        placeCaretAtEnd(editor);
        return true;
      },
    });
  }

  // Double-click a sent message to edit it.
  document.body.addEventListener('dblclick', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest('input, textarea, [contenteditable="true"], button, a')) return;

    const userMessage = target.closest<HTMLElement>(USER_MESSAGE_SELECTOR);
    if (!userMessage) return;

    const editButton = findEditMessageButton(userMessage);
    if (!editButton) return;

    editButton.click();
    focusMessageEditor(userMessage.closest<HTMLElement>('[data-turn-key]') || userMessage);
  });

  function addMarkmapButtons() {
    // 2026 app: `[data-markdown-copy="code-block"]` holds a header (language label + actions)
    // followed by the code.
    document
      .querySelectorAll<HTMLElement>(`[data-markdown-copy="code-block"]:not([${MARKMAP_SCANNED_ATTR}])`)
      .forEach((block) => {
        block.setAttribute(MARKMAP_SCANNED_ATTR, '');
        const header = block.querySelector<HTMLElement>(':scope > [data-markdown-copy="exclude"]');
        const codeEl = block.querySelector<HTMLElement>('code');
        const content = codeEl?.parentElement;
        if (!header || !codeEl || !content || content === block || header.contains(content)) return;

        const isMarkdown = Array.from(header.children).some((el) =>
          /^(markdown|md)$/i.test((el.textContent || '').trim())
        );
        if (!isMarkdown) return;

        const actions = header.querySelector('button')?.closest('span')?.parentElement || header;
        attachMarkmapToggle({ actions, content, codeEl, scrollTarget: block });
      });

    // Older React app: a "markdown" label, then the toolbar, then the code block.
    getLegacyMarkdownLabels().forEach((mdLabel) => {
      const codeBlock = mdLabel.nextElementSibling?.nextElementSibling;
      if (!(codeBlock instanceof HTMLElement)) return;
      const codeEl = codeBlock.querySelector<HTMLElement>('code');
      const actions = mdLabel.nextElementSibling?.querySelector('button')?.parentElement?.parentElement;
      if (!codeEl || !actions) return;
      attachMarkmapToggle({ actions, content: codeBlock, codeEl, scrollTarget: mdLabel });
    });
  }

  function getLegacyMarkdownLabels() {
    const labels: HTMLElement[] = [];
    document
      .querySelectorAll<HTMLElement>('article[data-turn="assistant"], div[data-message-author-role="assistant"]')
      .forEach((block) => {
        block.querySelectorAll<HTMLElement>('div').forEach((div) => {
          if (div.childElementCount === 0 && (div.textContent || '').trim().toLowerCase() === 'markdown') {
            labels.push(div);
          }
        });
      });
    return labels;
  }

  function attachMarkmapToggle({
    actions,
    content,
    codeEl,
    scrollTarget,
  }: {
    actions: HTMLElement;
    content: HTMLElement;
    codeEl: HTMLElement;
    scrollTarget: HTMLElement;
  }) {
    if (actions.querySelector('button[aria-label="Mindmap"]')) return;

    ensureButtonStyles();
    const mindmapBtn = document.createElement('button');
    mindmapBtn.type = 'button';
    mindmapBtn.className = 'chatgpttoolkit-markmap-btn';
    mindmapBtn.setAttribute('aria-label', 'Mindmap');
    mindmapBtn.setAttribute('aria-pressed', 'false');
    mindmapBtn.innerHTML = MINDMAP_ICON_SVG;
    const label = document.createElement('span');
    label.textContent = chrome?.i18n?.getMessage?.('content_mindmap_button') || '心智圖';
    mindmapBtn.appendChild(label);
    actions.prepend(mindmapBtn);

    let mm: MarkmapInstanceHandle | null = null;
    let wrapper: HTMLElement | null = null;

    const onFullscreenChange = () => {
      setTimeout(() => {
        scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
        mm?.fit();
      }, 60);
    };

    const close = () => {
      mm?.destroy();
      mm = null;
      wrapper?.remove();
      wrapper = null;
      content.style.removeProperty('display');
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      mindmapBtn.setAttribute('aria-pressed', 'false');
    };

    mindmapBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });

      if (wrapper) {
        close();
        return;
      }

      const markmap = window.markmap;
      if (!markmap) return;

      const viewportHeight = document.documentElement.clientHeight;
      const height = Math.max(240, Math.min((viewportHeight * 3) / 5, content.clientHeight || viewportHeight));
      const width = content.clientWidth || scrollTarget.clientWidth;

      const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgEl.style.width = `${width}px`;
      svgEl.style.height = `${Math.round(height / 10) * 10}px`;
      svgEl.addEventListener('dblclick', async () => {
        try {
          if (svgEl.requestFullscreen) {
            await svgEl.requestFullscreen();
          } else if (svgEl.webkitRequestFullscreen) {
            await svgEl.webkitRequestFullscreen();
          }
        } catch (error) {
          if (debug) console.error('[ChatGPTToolkit][chatgpt] fullscreen failed', error);
        }
      });

      wrapper = document.createElement('div');
      wrapper.className = 'chatgpttoolkit-markmap';
      wrapper.appendChild(svgEl);
      content.style.setProperty('display', 'none');
      content.after(wrapper);

      document.documentElement.classList.toggle('markmap-dark', isDarkTheme());
      const { root } = new markmap.Transformer().transform(codeEl.textContent || '');
      mm = markmap.Markmap.create(svgEl, markmap.deriveOptions({ autoFit: true, duration: 300 }), root);
      document.addEventListener('fullscreenchange', onFullscreenChange);
      mindmapBtn.setAttribute('aria-pressed', 'true');
    });
  }
}
