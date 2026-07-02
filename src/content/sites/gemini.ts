import type { ContentContext } from '../context';
import { extractPromptEditorText } from '../editorText';

interface PromptItem {
  enabled?: boolean;
  initial?: boolean;
  svgIcon?: string;
  title?: string;
  altText?: string;
  prompt?: string;
  autoPaste?: boolean;
  autoSubmit?: boolean;
}

interface ReadyPrompt extends PromptItem {
  title: string;
  prompt: string;
}

interface InitialButtonsMountTarget {
  container: HTMLElement;
  beforeNode?: HTMLElement | null;
}

export function initGemini(ctx: ContentContext) {
  if (location.hostname !== 'gemini.google.com') return false;

  const { state, debug } = ctx;
  const CUSTOM_PROMPTS_KEY = 'chatgpttoolkit.customPrompts';
  const CLIPBOARD_ARGS_PLACEHOLDER = '{{args}}';
  const GEMINI_EDITOR_SELECTORS = [
    'chat-window .textarea',
    'input-container rich-textarea .ql-editor',
    'rich-textarea .ql-editor',
    'input-container [contenteditable="true"][role="textbox"]',
    'chat-window [contenteditable="true"][role="textbox"]',
  ] as const;
  const GEMINI_SEND_BUTTON_SELECTORS = [
    'chat-window button.send-button',
    'button.send-button',
    'chat-window button[aria-label*="Send"]',
    'chat-window button[aria-label*="送出"]',
    'chat-window button[aria-label*="傳送"]',
    'button[aria-label*="Send"]',
    'button[aria-label*="送出"]',
    'button[aria-label*="傳送"]',
    'button[data-test-id*="send"]',
    'button[data-testid*="send"]',
  ] as const;
  const GEMINI_COMPOSER_ROOT_SELECTOR =
    'form, input-container, rich-textarea, .input-area, .chat-input, .composer, chat-window';

  let promptFillRunId = 0;

  function getPromptEditor() {
    for (const selector of GEMINI_EDITOR_SELECTORS) {
      const editors = Array.from(document.querySelectorAll<HTMLElement>(selector));
      const visibleEditor = editors.find((item) => isElementVisible(item));
      if (visibleEditor) return visibleEditor;
      if (editors[0]) return editors[0];
    }

    return null;
  }

  function setGeminiPromptEditor(editorDiv: HTMLElement | null, promptText: string) {
    if (!editorDiv) return;
    ctx.fillContentEditableWithParagraphs(editorDiv, promptText);
    editorDiv.dispatchEvent(new Event('input', { bubbles: true }));
    editorDiv.focus();
  }

  function readClipboardTextSafely() {
    if (!navigator.clipboard?.readText) return Promise.resolve('');
    return navigator.clipboard.readText().catch((error) => {
      if (debug) console.warn('[ChatGPTToolkit][gemini] clipboard read failed', error);
      return '';
    });
  }

  function getPromptEditorText() {
    return extractPromptEditorText(getPromptEditor());
  }

  function isSendButtonEnabled(button: HTMLButtonElement | null): button is HTMLButtonElement {
    if (!button) return false;
    if (button.disabled) return false;
    if (button.getAttribute('aria-disabled') === 'true') return false;
    return true;
  }

  function getSendButton() {
    for (const selector of GEMINI_SEND_BUTTON_SELECTORS) {
      const button = document.querySelector<HTMLButtonElement>(selector);
      if (button) return button;
    }

    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
    return buttons.find(isLikelySendButton) || null;
  }

  function isLikelySendButton(button: HTMLButtonElement) {
    const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
    const testId = (
      button.getAttribute('data-test-id') ||
      button.getAttribute('data-testid') ||
      ''
    ).toLowerCase();
    const textContent = (button.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const icon = button.querySelector<HTMLElement>('mat-icon, [data-mat-icon-name], [fonticon]');
    const iconName = (
      icon?.getAttribute('fonticon') ||
      icon?.getAttribute('data-mat-icon-name') ||
      icon?.textContent ||
      ''
    ).toLowerCase();

    const sendTokens = ['send', 'submit', '送出', '傳送', '提交'];
    return sendTokens.some((token) =>
      ariaLabel.includes(token) ||
      testId.includes(token) ||
      textContent === token ||
      iconName.includes(token)
    );
  }

  function findComposerRoot(element: HTMLElement | null) {
    if (!element) return null;

    return (
      element.closest<HTMLElement>(GEMINI_COMPOSER_ROOT_SELECTOR) || element.parentElement
    );
  }

  function isSendButtonStopState(button: HTMLButtonElement | null) {
    if (!button) return false;
    const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
    const icon = button.querySelector<HTMLElement>('mat-icon');
    const iconName = (
      icon?.getAttribute('fonticon') ||
      icon?.getAttribute('data-mat-icon-name') ||
      icon?.textContent ||
      ''
    ).toLowerCase();
    return (
      ariaLabel.includes('stop') ||
      ariaLabel.includes('停止') ||
      ariaLabel.includes('中止') ||
      ariaLabel.includes('取消') ||
      iconName.includes('stop') ||
      iconName.includes('close') ||
      iconName.includes('cancel')
    );
  }

  function isElementVisible(element: HTMLElement | null) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function autoSubmitWhenReady() {
    ctx.startRetryInterval({
      intervalMs: 120,
      retries: 20,
      tick: () => {
        const button = getSendButton();
        if (!isSendButtonEnabled(button)) return false;
        if (isSendButtonStopState(button)) return false;
        if (state.pasteImage && !isImageUploadComplete()) return false;
        button.focus();
        button.click();
        return true;
      },
    });
  }

  function normalizeEditorText(text: string) {
    return text.replace(/\s+/g, ' ').trim();
  }

  function fillPrompt(prompt: string, autoSubmit = true) {
    const runId = ++promptFillRunId;
    const expected = normalizeEditorText(prompt);
    let autoSubmitScheduled = false;

    ctx.startRetryInterval({
      intervalMs: 80,
      retries: 15,
      tick: () => {
        if (runId !== promptFillRunId) return true;

        const editorDiv = getPromptEditor();
        if (!editorDiv) return false;

        const current = normalizeEditorText(extractPromptEditorText(editorDiv));
        const hasPrompt = expected.length > 0 ? current.includes(expected) : current.length > 0;

        if (hasPrompt) {
          if (autoSubmit && !autoSubmitScheduled) {
            autoSubmitScheduled = true;
            autoSubmitWhenReady();
          }
          return true;
        }

        setGeminiPromptEditor(editorDiv, prompt);
        if (autoSubmit && !autoSubmitScheduled) {
          autoSubmitScheduled = true;
          autoSubmitWhenReady();
        }
        return false;
      },
    });
  }

  function bindPromptButton(
    button: HTMLButtonElement,
    item: ReadyPrompt,
    autoPasteEnabled: boolean,
    autoSubmitEnabled: boolean,
    label: 'initial' | 'follow-up'
  ) {
    let lastTriggerAt = 0;

    const trigger = (source: string) => {
      const now = Date.now();
      if (now - lastTriggerAt < 250) {
        if (debug) {
          console.log(`[ChatGPTToolkit][gemini] ${label} button trigger ignored`, {
            source,
            title: item.title,
            deltaMs: now - lastTriggerAt,
          });
        }
        return;
      }
      lastTriggerAt = now;

      if (debug) {
        console.log(`[ChatGPTToolkit][gemini] ${label} button trigger`, {
          source,
          title: item.title,
          autoPasteEnabled,
          autoSubmitEnabled,
          promptLength: item.prompt?.length || 0,
        });
      }

      if (autoPasteEnabled) {
        const editorText = getPromptEditorText().trim();
        const resolveArgsText = editorText
          ? Promise.resolve(editorText)
          : readClipboardTextSafely().then((text) => text.trim());
        resolveArgsText.then((trimmed) => {
          const hasArgsPlaceholder = item.prompt.includes(CLIPBOARD_ARGS_PLACEHOLDER);
          const nextPrompt = hasArgsPlaceholder
            ? item.prompt.split(CLIPBOARD_ARGS_PLACEHOLDER).join(trimmed)
            : trimmed
              ? item.prompt + trimmed
              : item.prompt;
          if (debug) {
            console.log(`[ChatGPTToolkit][gemini] ${label} button args resolved`, {
              title: item.title,
              argsSource: editorText ? 'editor' : 'clipboard',
              trimmedLength: trimmed.length,
              hasArgsPlaceholder,
              nextPromptLength: nextPrompt.length,
            });
          }
          fillPrompt(nextPrompt, autoSubmitEnabled);
        });
      } else {
        fillPrompt(item.prompt, autoSubmitEnabled);
      }
    };

    button.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      trigger('pointerdown');
    });

    button.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      event.stopPropagation();
    });

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      trigger('click');
    });

    button.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      trigger(`keydown:${event.key}`);
    });
  }

  function getDefaultReviewPrompt(): PromptItem {
    return {
      enabled: true,
      initial: true,
      svgIcon: '💬',
      title: '評論',
      altText: '評論剪貼簿內容並提出改進建議',
      prompt: '請評論以下內容，指出優缺點並提供改進建議：\n\n',
      autoPaste: true,
      autoSubmit: true,
    };
  }

  function ensurePromptExists(prompts: PromptItem[], promptToEnsure?: PromptItem | null) {
    if (!Array.isArray(prompts)) return { prompts, changed: false };
    if (!promptToEnsure || !promptToEnsure.title) return { prompts, changed: false };

    const title = String(promptToEnsure.title).trim();
    const exists = prompts.some((p) => {
      if (!p) return false;
      const isInitial = Object.prototype.hasOwnProperty.call(p, 'initial') ? p.initial === true : false;
      return isInitial === true && String(p.title || '').trim() === title;
    });

    if (exists) return { prompts, changed: false };
    return { prompts: [...prompts, { ...promptToEnsure }], changed: true };
  }

  function safeParseJsonArray(str?: string | null): PromptItem[] | null {
    if (!str) return null;
    try {
      const parsed = JSON.parse(str);
      return Array.isArray(parsed) ? (parsed as PromptItem[]) : null;
    } catch {
      return null;
    }
  }

  function chromeStorageGet(key: string) {
    try {
      if (!chrome?.storage?.local) return Promise.resolve(undefined);
      return new Promise<unknown>((resolve) =>
        chrome.storage.local.get([key], (result) => resolve(result?.[key]))
      );
    } catch {
      return Promise.resolve(undefined);
    }
  }

  function chromeStorageSet(key: string, value: unknown) {
    try {
      if (!chrome?.storage?.local) return Promise.resolve(false);
      return new Promise<boolean>((resolve) =>
        chrome.storage.local.set({ [key]: value }, () => resolve(true))
      );
    } catch {
      return Promise.resolve(false);
    }
  }

  async function loadCustomPromptsFromExtensionStorageWithMigration() {
    const stored = await chromeStorageGet(CUSTOM_PROMPTS_KEY);
    if (Array.isArray(stored)) {
      const migrated = ensurePromptExists(stored as PromptItem[], getDefaultReviewPrompt());
      if (migrated.changed) await chromeStorageSet(CUSTOM_PROMPTS_KEY, migrated.prompts);
      return migrated.prompts;
    }

    const legacy = safeParseJsonArray(localStorage.getItem(CUSTOM_PROMPTS_KEY));
    if (legacy) {
      const migrated = ensurePromptExists(legacy, getDefaultReviewPrompt());
      await chromeStorageSet(CUSTOM_PROMPTS_KEY, migrated.prompts);
      return migrated.prompts;
    }

    return null;
  }

  function buildInitialButtonsFromPrompts(prompts?: PromptItem[] | null) {
    const results: ReadyPrompt[] = [];
    (prompts || []).forEach((item) => {
      const hasEnabled = Object.prototype.hasOwnProperty.call(item, 'enabled');
      const isItemEnabled = !hasEnabled || item.enabled === true;
      const isItemInitial = Object.prototype.hasOwnProperty.call(item, 'initial')
        ? item.initial === true
        : false;

      if (isItemEnabled && isItemInitial && !!item.title && !!item.prompt) {
        results.push(item as ReadyPrompt);
      }
    });
    return results;
  }

  void (async () => {
    let initialManualSubmitText: ReadyPrompt[] = [];
    let followUpManualSubmitText: ReadyPrompt[] = [];
    let localeDefaultManualSubmitText: ReadyPrompt[] = [];
    let lastResponse: Element | undefined;
    let initialButtonsSignature = '';
    let shiftedInitialHeading: HTMLElement | null = null;

    const currentLocale = chrome.i18n?.getUILanguage();
    if (currentLocale) {
      if (currentLocale === 'zh-TW') {
        localeDefaultManualSubmitText.push({ title: '舉例說明', prompt: '請舉例說明' });
        localeDefaultManualSubmitText.push({ title: '提供細節', prompt: '請提供更多細節說明' });
        localeDefaultManualSubmitText.push({
          title: '翻譯成繁中',
          prompt: '請將上述回應內容翻譯成臺灣常用的正體中文',
        });
        localeDefaultManualSubmitText.push({
          title: '翻譯成英文',
          prompt: 'Please translate the above response into English.',
        });
      } else if (currentLocale === 'ja') {
        localeDefaultManualSubmitText.push({ title: '例えば', prompt: '例を挙げて説明して' });
        localeDefaultManualSubmitText.push({ title: '詳細説明', prompt: 'もっと詳細に説明して' });
        localeDefaultManualSubmitText.push({
          title: '日本語に翻訳',
          prompt: '上述の返答内容を日本語に翻訳して',
        });
        localeDefaultManualSubmitText.push({
          title: '英語に翻訳',
          prompt: 'Please translate the above response into English.',
        });
      } else {
        localeDefaultManualSubmitText.push({
          title: 'More Examples',
          prompt: 'Could you please provide me with more examples?',
        });
        localeDefaultManualSubmitText.push({
          title: 'More Details',
          prompt: 'Could you please provide me with more details?',
        });
        localeDefaultManualSubmitText.push({
          title: 'Translate to English',
          prompt: 'Please translate the above response into English.',
        });
      }
    }

    followUpManualSubmitText = [...localeDefaultManualSubmitText];

    function buildFollowUpButtonsFromPrompts(prompts?: PromptItem[] | null) {
      const results: ReadyPrompt[] = [];
      (prompts || []).forEach((item) => {
        const hasEnabled = Object.prototype.hasOwnProperty.call(item, 'enabled');
        const isItemEnabled = !hasEnabled || item.enabled === true;
        const isItemInitial = Object.prototype.hasOwnProperty.call(item, 'initial')
          ? item.initial === true
          : false;

        if (isItemEnabled && !isItemInitial && !!item.title && !!item.prompt) {
          results.push(item as ReadyPrompt);
        }
      });
      return results;
    }

    const customPrompts = await loadCustomPromptsFromExtensionStorageWithMigration();
    if (Array.isArray(customPrompts)) {
      initialManualSubmitText = buildInitialButtonsFromPrompts(customPrompts);
      followUpManualSubmitText = buildFollowUpButtonsFromPrompts(customPrompts);
    }

    let mutationObserverTimer: ReturnType<typeof setTimeout> | undefined;
    const obs = new MutationObserver((mutations) => {
      const hasRelevantMutation = mutations.some((mutation) => {
        const target = mutation.target;
        const element =
          target instanceof HTMLElement
            ? target
            : target.parentElement instanceof HTMLElement
              ? target.parentElement
              : null;

        if (!element) return true;
        if (element.closest('#custom-gemini-initial-buttons')) return false;
        if (element.closest('#custom-gemini-followup-buttons')) return false;
        if (element.getAttribute('data-chatgpttoolkit-gemini-heading-shift') === 'true') return false;

        const isOurButtonNode = (node: Node) =>
          node instanceof HTMLElement &&
          (node.id === 'custom-gemini-initial-buttons' || node.id === 'custom-gemini-followup-buttons');

        if (Array.from(mutation.addedNodes).some(isOurButtonNode)) return false;
        if (Array.from(mutation.removedNodes).some(isOurButtonNode)) return false;

        return true;
      });
      if (!hasRelevantMutation) return;

      clearTimeout(mutationObserverTimer);
      mutationObserverTimer = setTimeout(() => {
        rebuildInitialButtons();
        rebuildFollowUpButtons();
      }, 0);
    });

    function getInitialButtonsComposerAnchor() {
      const editor = getPromptEditor();
      const sendButton = getSendButton();
      const editorAnchor =
        document
          .querySelector<HTMLElement>(
            'input-container [contenteditable="true"][role="textbox"], rich-textarea [contenteditable="true"][role="textbox"]'
          )
          ?.closest<HTMLElement>('input-container') || null;

      const candidates = [
        editorAnchor,
        editor?.closest<HTMLElement>('input-container'),
        editor?.closest<HTMLElement>('form'),
        sendButton?.closest<HTMLElement>('input-container'),
        sendButton?.closest<HTMLElement>('form'),
        ...Array.from(document.querySelectorAll<HTMLElement>('chat-window input-container')),
        ...Array.from(document.querySelectorAll<HTMLElement>('input-container')),
      ];

      const uniq = Array.from(new Set(candidates.filter((item): item is HTMLElement => Boolean(item))));
      const visible = uniq.filter((item) => Boolean(item.parentElement) && isElementVisible(item));
      const preferred = visible.find((item) => item.contains(editor) || item.contains(sendButton as Node));
      if (preferred) return preferred;

      const byTop = [...visible].sort(
        (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top
      );
      return byTop[0] || uniq.find((item) => Boolean(item.parentElement)) || null;
    }

    function getInitialButtonsZeroStateMountTarget(): InitialButtonsMountTarget | null {
      const zeroStateBlock = document.querySelector<HTMLElement>('.zero-state-block-container');
      if (!zeroStateBlock) return null;

      const primaryMessage =
        zeroStateBlock.querySelector<HTMLElement>('assistant-messages-primary') ||
        zeroStateBlock.querySelector<HTMLElement>('.assistant-messages-primary-container');
      if (!primaryMessage) return null;

      let beforeNode = primaryMessage.nextElementSibling as HTMLElement | null;
      if (beforeNode && beforeNode.id === 'custom-gemini-initial-buttons') {
        beforeNode = beforeNode.nextElementSibling as HTMLElement | null;
      }

      return {
        container: zeroStateBlock,
        beforeNode,
      };
    }

    function getInitialButtonsMountTarget(): InitialButtonsMountTarget | null {
      if (getAssistantResponseBlocks().length > 0) return null;

      const zeroStateMountTarget = getInitialButtonsZeroStateMountTarget();
      if (zeroStateMountTarget) return zeroStateMountTarget;

      const composerAnchor = getInitialButtonsComposerAnchor();
      if (!composerAnchor || !composerAnchor.parentElement) return null;

      return {
        container: composerAnchor.parentElement,
        beforeNode: composerAnchor,
      };
    }

    function getInitialButtonsHeadingTarget(anchor: HTMLElement, bar: HTMLElement) {
      const anchorRect = anchor.getBoundingClientRect();
      const pageCenter = window.innerWidth / 2;
      const candidates = Array.from(document.querySelectorAll<HTMLElement>('h1, h2, div, span'))
        .filter((item) => {
          if (item === bar || item.contains(bar) || bar.contains(item)) return false;
          if (anchor.contains(item)) return false;
          if (!isElementVisible(item)) return false;

          const text = (item.textContent || '').replace(/\s+/g, ' ').trim();
          if (text.length < 2 || text.length > 80) return false;

          const rect = item.getBoundingClientRect();
          if (rect.bottom > anchorRect.top) return false;
          if (rect.top < 80) return false;

          const style = window.getComputedStyle(item);
          const fontSize = Number.parseFloat(style.fontSize || '0');
          if (!Number.isFinite(fontSize) || fontSize < 24) return false;

          return true;
        })
        .map((item) => {
          const rect = item.getBoundingClientRect();
          const centerDistance = Math.abs(rect.left + rect.width / 2 - pageCenter);
          const verticalDistance = anchorRect.top - rect.bottom;
          return { item, centerDistance, verticalDistance, area: rect.width * rect.height };
        })
        .sort((a, b) => {
          if (Math.abs(a.verticalDistance - b.verticalDistance) > 8) {
            return a.verticalDistance - b.verticalDistance;
          }
          if (Math.abs(a.centerDistance - b.centerDistance) > 8) {
            return a.centerDistance - b.centerDistance;
          }
          return b.area - a.area;
        });

      return candidates[0]?.item || null;
    }

    function setStylePropertyIfChanged(element: HTMLElement, property: string, value: string) {
      if (element.style.getPropertyValue(property) !== value) {
        element.style.setProperty(property, value);
      }
    }

    function removeStylePropertyIfPresent(element: HTMLElement, property: string) {
      if (element.style.getPropertyValue(property)) {
        element.style.removeProperty(property);
      }
    }

    function setInitialButtonsHeadingShift(headingTarget: HTMLElement | null, shiftPx: number) {
      if (shiftedInitialHeading && shiftedInitialHeading !== headingTarget) {
        shiftedInitialHeading.style.removeProperty('transform');
        shiftedInitialHeading.removeAttribute('data-chatgpttoolkit-gemini-heading-shift');
      }

      shiftedInitialHeading = headingTarget;
      if (!headingTarget) return;

      setStylePropertyIfChanged(headingTarget, 'transform', `translateY(-${shiftPx}px)`);
      if (headingTarget.getAttribute('data-chatgpttoolkit-gemini-heading-shift') !== 'true') {
        headingTarget.setAttribute('data-chatgpttoolkit-gemini-heading-shift', 'true');
      }
    }

    function resetInitialButtonsHeadingShift() {
      setInitialButtonsHeadingShift(null, 0);
    }

    function getReadyPromptsSignature(items: ReadyPrompt[]) {
      return JSON.stringify(
        items.map((item) => ({
          title: item.title,
          prompt: item.prompt,
          altText: item.altText || '',
          autoPaste: item.autoPaste === true,
          autoSubmit: item.autoSubmit === true,
        }))
      );
    }

    function rebuildInitialButtons() {
      const existing = document.getElementById('custom-gemini-initial-buttons');

      if (!Array.isArray(initialManualSubmitText) || initialManualSubmitText.length === 0) {
        existing?.remove();
        resetInitialButtonsHeadingShift();
        initialButtonsSignature = '';
        return;
      }

      const mountTarget = getInitialButtonsMountTarget();
      if (!mountTarget) {
        existing?.remove();
        resetInitialButtonsHeadingShift();
        initialButtonsSignature = '';
        return;
      }

      let bar = existing;
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'custom-gemini-initial-buttons';
      }

      const barEl = bar as HTMLDivElement;
      const nextSignature = getReadyPromptsSignature(initialManualSubmitText);
      const shouldRebuildButtons = nextSignature !== initialButtonsSignature;
      if (shouldRebuildButtons && barEl.style.visibility !== 'hidden') {
        barEl.style.visibility = 'hidden';
      }
      setStylePropertyIfChanged(barEl, 'display', 'flex');
      setStylePropertyIfChanged(barEl, 'flex-wrap', 'wrap');
      setStylePropertyIfChanged(barEl, 'gap', '0.5rem');
      setStylePropertyIfChanged(barEl, 'justify-content', 'center');
      setStylePropertyIfChanged(barEl, 'align-items', 'center');
      // 拉大「大字 -> 初始按鈕」距離，同時維持按鈕到輸入框的視覺比例。
      setStylePropertyIfChanged(barEl, 'margin', '0.9rem 0 0.9rem 0');
      setStylePropertyIfChanged(barEl, 'width', '100%');
      setStylePropertyIfChanged(barEl, 'max-width', '100%');
      setStylePropertyIfChanged(barEl, 'box-sizing', 'border-box');
      setStylePropertyIfChanged(barEl, 'pointer-events', 'auto');
      setStylePropertyIfChanged(barEl, 'position', 'relative');
      setStylePropertyIfChanged(barEl, 'z-index', '2');

      removeStylePropertyIfPresent(barEl, 'left');
      removeStylePropertyIfPresent(barEl, 'top');
      removeStylePropertyIfPresent(barEl, 'padding-left');

      const headingShiftPx = 28;
      const buttonShiftPx = 8;
      setStylePropertyIfChanged(barEl, 'transform', `translateY(-${buttonShiftPx}px)`);

      const { container, beforeNode } = mountTarget;
      if (beforeNode) {
        if (barEl.parentElement !== container || barEl.nextElementSibling !== beforeNode) {
          container.insertBefore(barEl, beforeNode);
        }
      } else if (barEl.parentElement !== container || barEl.nextElementSibling) {
        container.appendChild(barEl);
      }

      const anchorForHeading = beforeNode || container;
      const headingTarget = getInitialButtonsHeadingTarget(anchorForHeading, barEl);
      setInitialButtonsHeadingShift(headingTarget, headingShiftPx);

      if (!shouldRebuildButtons) {
        if (barEl.style.visibility !== 'visible') {
          barEl.style.visibility = 'visible';
        }
        return;
      }

      barEl.innerHTML = '';
      initialButtonsSignature = nextSignature;

      initialManualSubmitText.forEach((item) => {
        const autoPasteEnabled = item.autoPaste === true;
        const autoSubmitEnabled = item.autoSubmit === true;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.tabIndex = 0;
        btn.style.display = 'inline-flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.border = '1px solid #d1d5db';
        btn.style.borderRadius = '999px';
        btn.style.padding = '0.3rem 0.8rem';
        btn.style.margin = '0';
        btn.style.fontSize = '0.85rem';
        btn.style.background = 'transparent';
        btn.style.cursor = 'pointer';
        btn.style.lineHeight = '1.2';
        btn.style.whiteSpace = 'nowrap';
        btn.style.color = 'inherit';
        btn.style.pointerEvents = 'auto';
        btn.style.position = 'relative';
        btn.style.zIndex = '3';
        btn.textContent = item.title;
        if (item.altText) {
          btn.title = String(item.altText);
        }
        bindPromptButton(btn, item, autoPasteEnabled, autoSubmitEnabled, 'initial');

        barEl.append(btn);
      });

      requestAnimationFrame(() => {
        if (barEl.isConnected && barEl.style.visibility !== 'visible') {
          barEl.style.visibility = 'visible';
        }
      });
    }

    function getAssistantResponseBlocks() {
      const modelResponses = Array.from(document.querySelectorAll<HTMLElement>('model-response'));
      if (modelResponses.length > 0) return modelResponses;

      const responseContainers = Array.from(document.querySelectorAll<HTMLElement>('response-container'));
      if (responseContainers.length > 0) return responseContainers;

      return Array.from(document.querySelectorAll<HTMLElement>('.conversation-container'));
    }

    function rebuildFollowUpButtons() {
      const existing = document.getElementById('custom-gemini-followup-buttons');

      const zeroState = document.querySelector<HTMLElement>('modular-zero-state');
      if (zeroState) {
        existing?.remove();
        lastResponse = undefined;
        return;
      }

      const sendButton = getSendButton();
      if (sendButton && isSendButtonStopState(sendButton)) {
        existing?.remove();
        return;
      }

      if (!Array.isArray(followUpManualSubmitText) || followUpManualSubmitText.length === 0) {
        existing?.remove();
        lastResponse = undefined;
        return;
      }

      const responseBlocks = getAssistantResponseBlocks();
      if (responseBlocks.length === 0) {
        existing?.remove();
        lastResponse = undefined;
        return;
      }

      const latest = responseBlocks[responseBlocks.length - 1];
      if (lastResponse && lastResponse !== latest) {
        existing?.remove();
      }

      if (document.getElementById('custom-gemini-followup-buttons')) {
        return;
      }

      const bar = document.createElement('div');
      bar.id = 'custom-gemini-followup-buttons';
      bar.style.display = 'flex';
      bar.style.flexWrap = 'wrap';
      bar.style.gap = '0.5rem';
      bar.style.padding = '0.5rem 0 0.75rem 0';
      bar.style.pointerEvents = 'auto';

      followUpManualSubmitText.forEach((item) => {
        const autoPasteEnabled = item.autoPaste === true;
        const autoSubmitEnabled = item.autoSubmit === true;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.border = '1px solid #d1d5db';
        btn.style.borderRadius = '5px';
        btn.style.padding = '0.5rem 1rem';
        btn.style.cursor = 'pointer';
        btn.style.background = 'transparent';
        btn.style.color = 'inherit';
        btn.textContent = item.title;
        if (item.altText) {
          btn.title = String(item.altText);
        }
        bindPromptButton(btn, item, autoPasteEnabled, autoSubmitEnabled, 'follow-up');
        bar.append(btn);
      });

      latest.after(bar);
      lastResponse = latest;
    }

    if (chrome?.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return;
        const change = changes?.[CUSTOM_PROMPTS_KEY];
        if (!change) return;

        const nextInitial = Array.isArray(change.newValue)
          ? buildInitialButtonsFromPrompts(change.newValue as PromptItem[])
          : [];
        const nextFollowUp = Array.isArray(change.newValue)
          ? buildFollowUpButtonsFromPrompts(change.newValue as PromptItem[])
          : [...localeDefaultManualSubmitText];
        initialManualSubmitText = nextInitial;
        followUpManualSubmitText = nextFollowUp;

        document.querySelectorAll('#custom-gemini-initial-buttons')?.forEach((item) => item.remove());
        document.querySelectorAll('#custom-gemini-followup-buttons')?.forEach((item) => item.remove());
        rebuildInitialButtons();
        rebuildFollowUpButtons();
      });
    }

    rebuildInitialButtons();
    rebuildFollowUpButtons();
    obs.observe(document.body, {
      childList: true,
      subtree: true,
    });
  })();

  ctx.refreshParamsFromHash();
  const hasParams = Boolean(state.prompt || state.tool || state.pasteImage || state.autoSubmit);
  if (!hasParams) return true;

  let toolImageClicked = false;
  let promptFilled = false;
  let pastingGeminiImage = false;
  let geminiImagePasteAttempted = false;
  let submitted = false;

  function getComposerRoot() {
    const sendButtonRoot = findComposerRoot(getSendButton());
    if (sendButtonRoot) return sendButtonRoot;

    const editorRoot = findComposerRoot(getPromptEditor());
    if (editorRoot) return editorRoot;

    return document.querySelector<HTMLElement>('chat-window, input-container, rich-textarea');
  }

  function hasUploadInProgress(root: HTMLElement) {
    const previewRoot = root.querySelector<HTMLElement>('.uploader-file-preview-container') || root;
    const progressSelector = [
      'mat-progress-bar',
      'mat-progress-spinner',
      '[role="progressbar"]',
      '[aria-busy="true"]',
      '.uploading',
      '.loading',
      '.progress',
    ].join(',');
    return Boolean(previewRoot.querySelector(progressSelector));
  }

  function hasImageAttachment(root: HTMLElement) {
    const previewSelector = [
      '.file-preview-container',
      '[data-test-id*="file"]',
      '[data-test-id*="attachment"]',
      '[data-test-id*="upload"]',
      'img[src^="blob:"]',
      'img[src^="data:"]',
    ].join(',');
    return Boolean(root.querySelector(previewSelector));
  }

  function isImageUploadComplete() {
    if (!state.pasteImage) return true;
    if (pastingGeminiImage || !geminiImagePasteAttempted) return false;

    const root = getComposerRoot();
    if (!root) return false;

    if (!hasImageAttachment(root)) return false;
    if (hasUploadInProgress(root)) return false;

    return true;
  }

  const tryClickImageToolButton = () => {
    if (toolImageClicked) return;
    if (state.tool !== 'image') return;

    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
    for (const button of buttons) {
      const textContent = (button.textContent || '').replace(/\s+/g, ' ').trim();
      if (!textContent) continue;

      const isMatch =
        textContent.includes('生成圖片') ||
        textContent.toLowerCase().includes('create image');

      if (!isMatch) continue;
      if (button.disabled) continue;

      toolImageClicked = true;
      button.focus();
      button.click();
      return;
    }
  };

  ctx.startRetryInterval({
    intervalMs: 500,
    retries: state.pasteImage ? 120 : 30,
    tick: async () => {
      tryClickImageToolButton();

      const textarea = getPromptEditor();
      if (textarea && state.prompt && !promptFilled) {
        setGeminiPromptEditor(textarea, state.prompt);
        promptFilled = true;
      }

      if (textarea && state.pasteImage && !pastingGeminiImage && !geminiImagePasteAttempted) {
        pastingGeminiImage = true;
        geminiImagePasteAttempted = true;
        if (debug) console.log('Gemini: 貼上圖片中');
        await ctx.delay(300);
        await ctx.fetchClipboardImageAndSimulatePaste(textarea);
        if (debug) console.log('Gemini: 貼上圖片完成');
        pastingGeminiImage = false;
      }

      const button = getSendButton();
      const uploadReady = isImageUploadComplete();
      const canSubmit =
        isSendButtonEnabled(button) &&
        !isSendButtonStopState(button) &&
        promptFilled &&
        state.autoSubmit &&
        !submitted &&
        !pastingGeminiImage &&
        uploadReady &&
        (state.tool !== 'image' || toolImageClicked);

      if (canSubmit) {
        submitted = true;
        button.focus();
        setTimeout(() => {
          button.click();
        }, 500);
      }

      const done =
        (!state.prompt || promptFilled) &&
        (!state.pasteImage || isImageUploadComplete()) &&
        (!state.autoSubmit || submitted) &&
        (state.tool !== 'image' || toolImageClicked);

      if (done) {
        ctx.clearHash();
      }

      return done;
    },
  });

  return true;
}
