import type { ContentContext } from '../context';

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

export function initGemini(ctx: ContentContext) {
  if (location.hostname !== 'gemini.google.com') return false;

  const { state, debug } = ctx;
  const CUSTOM_PROMPTS_KEY = 'chatgpttoolkit.customPrompts';
  const CLIPBOARD_ARGS_PLACEHOLDER = '{{args}}';

  let promptFillRunId = 0;

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

  function isSendButtonEnabled(button: HTMLButtonElement | null): button is HTMLButtonElement {
    if (!button) return false;
    if (button.disabled) return false;
    if (button.getAttribute('aria-disabled') === 'true') return false;
    return true;
  }

  function autoSubmitWhenReady() {
    ctx.startRetryInterval({
      intervalMs: 120,
      retries: 20,
      tick: () => {
        const button = document.querySelector<HTMLButtonElement>('chat-window button.send-button');
        if (!isSendButtonEnabled(button)) return false;
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

        const editorDiv = document.querySelector<HTMLElement>('chat-window .textarea');
        if (!editorDiv) return false;

        const current = normalizeEditorText(editorDiv.textContent || '');
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
        readClipboardTextSafely().then((text) => {
          const trimmed = text.trim();
          const hasArgsPlaceholder = item.prompt.includes(CLIPBOARD_ARGS_PLACEHOLDER);
          const nextPrompt = hasArgsPlaceholder
            ? item.prompt.split(CLIPBOARD_ARGS_PLACEHOLDER).join(trimmed)
            : trimmed
              ? item.prompt + trimmed
              : item.prompt;
          if (debug) {
            console.log(`[ChatGPTToolkit][gemini] ${label} button clipboard resolved`, {
              title: item.title,
              clipboardLength: text.length,
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
      trigger('pointerdown');
    });

    button.addEventListener('click', (event) => {
      if (event.detail !== 0) return;
      trigger('click');
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
    const obs = new MutationObserver(() => {
      clearTimeout(mutationObserverTimer);
      mutationObserverTimer = setTimeout(() => {
        rebuildInitialButtons();
        rebuildFollowUpButtons();
      }, 0);
    });

    function rebuildInitialButtons() {
      const existing = document.getElementById('custom-gemini-initial-buttons');

      const zeroState = document.querySelector<HTMLElement>('modular-zero-state');
      if (!zeroState) {
        existing?.remove();
        return;
      }

      if (!Array.isArray(initialManualSubmitText) || initialManualSubmitText.length === 0) {
        existing?.remove();
        return;
      }

      const bottomSection =
        zeroState.querySelector<HTMLElement>('.bottom-section-container') ||
        zeroState.querySelector<HTMLElement>('.modular-zero-state-container');
      if (!bottomSection) {
        existing?.remove();
        return;
      }

      const zeroStateBlock =
        bottomSection.querySelector<HTMLElement>('.zero-state-block-container') || bottomSection;

      let bar = existing;
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'custom-gemini-initial-buttons';
      } else {
        bar.innerHTML = '';
      }

      const barEl = bar as HTMLDivElement;
      barEl.style.display = 'flex';
      barEl.style.flexWrap = 'wrap';
      barEl.style.gap = '0.5rem';
      barEl.style.justifyContent = 'center';
      barEl.style.alignItems = 'center';
      barEl.style.margin = '0 0 0.75rem 0';
      barEl.style.pointerEvents = 'auto';

      const intentBlock = zeroStateBlock.querySelector<HTMLElement>('intent-chips-block');
      if (intentBlock) {
        if (barEl.parentElement !== zeroStateBlock) {
          zeroStateBlock.insertBefore(barEl, intentBlock);
        }
      } else if (barEl.parentElement !== zeroStateBlock) {
        zeroStateBlock.prepend(barEl);
      }

      initialManualSubmitText.forEach((item) => {
        const autoPasteEnabled = item.autoPaste === true;
        const autoSubmitEnabled = item.autoSubmit === true;

        const btn = document.createElement('button');
        btn.type = 'button';
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
        btn.textContent = item.title;
        if (item.altText) {
          btn.title = String(item.altText);
        }
        bindPromptButton(btn, item, autoPasteEnabled, autoSubmitEnabled, 'initial');

        barEl.append(btn);
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

      const sendButton = document.querySelector<HTMLButtonElement>('chat-window button.send-button');
      if (!sendButton) {
        existing?.remove();
        return;
      }

      const ariaLabel = (sendButton.getAttribute('aria-label') || '').toLowerCase();
      const icon = sendButton.querySelector<HTMLElement>('mat-icon');
      const iconName = (
        icon?.getAttribute('fonticon') ||
        icon?.getAttribute('data-mat-icon-name') ||
        icon?.textContent ||
        ''
      ).toLowerCase();
      const isStopState =
        ariaLabel.includes('stop') ||
        ariaLabel.includes('停止') ||
        ariaLabel.includes('中止') ||
        ariaLabel.includes('取消') ||
        iconName.includes('stop') ||
        iconName.includes('close') ||
        iconName.includes('cancel');

      if (isStopState) {
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
      attributes: true,
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
    retries: 30,
    tick: async () => {
      tryClickImageToolButton();

      const textarea = document.querySelector<HTMLElement>('chat-window .textarea');
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

      const button = document.querySelector<HTMLButtonElement>('chat-window button.send-button');
      const canSubmit =
        isSendButtonEnabled(button) &&
        promptFilled &&
        state.autoSubmit &&
        !submitted &&
        !pastingGeminiImage &&
        (!state.pasteImage || geminiImagePasteAttempted) &&
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
        (!state.pasteImage || geminiImagePasteAttempted) &&
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
