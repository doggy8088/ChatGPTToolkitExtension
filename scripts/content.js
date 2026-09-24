(() => {
  // src/content/context.ts
  function createContentContext() {
    const debug = true;
    const contentUtils = window.ChatGPTToolkitContentUtils;
    if (!contentUtils) {
      console.error("[ChatGPTToolkit] Missing ChatGPTToolkitContentUtils; check manifest.json script order.");
      return null;
    }
    const state = {
      prompt: "",
      autoSubmit: false,
      pasteImage: false,
      tool: "",
      pastingImage: false
    };
    function fillContentEditableWithParagraphs(target, text) {
      if (!target)
        return;
      const lines = (text || "").split(`
`);
      target.innerHTML = "";
      lines.forEach((line) => {
        const paragraph = document.createElement("p");
        paragraph.innerText = line;
        target.appendChild(paragraph);
      });
    }
    function fillTextareaAndDispatchInput(textarea, text) {
      if (!textarea)
        return;
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      if (valueSetter) {
        valueSetter.call(textarea, text);
      } else {
        textarea.value = text;
      }
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }
    function startRetryInterval({ intervalMs = 500, retries = 10, tick }) {
      let remaining = retries;
      const ti = window.setInterval(async () => {
        try {
          const shouldStop = await tick();
          if (shouldStop) {
            clearInterval(ti);
            return;
          }
        } catch {}
        remaining--;
        if (remaining <= 0) {
          clearInterval(ti);
        }
      }, intervalMs);
      return ti;
    }
    function delay(ms) {
      return new Promise((resolve) => {
        setTimeout(resolve, ms);
      });
    }
    async function fetchClipboardImageAndSimulatePaste(targetElement) {
      if (!targetElement)
        return false;
      targetElement.focus();
      try {
        if (debug)
          console.log("從剪貼簿抓取圖片");
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          for (const type of item.types) {
            if (type.startsWith("image/")) {
              const blob = await item.getType(type);
              const file = new File([blob], "clipboard-image.png", { type });
              const dataTransfer = new DataTransfer;
              dataTransfer.items.add(file);
              const pasteEvent = new ClipboardEvent("paste", {
                bubbles: true,
                cancelable: true,
                clipboardData: dataTransfer
              });
              if (debug)
                console.log("觸發貼上事件", pasteEvent);
              targetElement.dispatchEvent(pasteEvent);
              if (debug)
                console.log("模擬貼上圖片成功");
              return true;
            }
          }
        }
        if (debug)
          console.log("剪貼簿中沒有圖片");
        return false;
      } catch (error) {
        console.error("抓取剪貼簿圖片失敗:", error);
        return false;
      }
    }
    function refreshParamsFromHash() {
      const hash = location.hash.substring(1);
      if (!hash)
        return null;
      if (debug)
        console.log("hash: ", hash);
      const parsed = contentUtils.parseToolkitHash(hash, location.search);
      state.prompt = parsed.prompt || "";
      state.autoSubmit = parsed.autoSubmit;
      state.pasteImage = parsed.pasteImage;
      state.tool = parsed.tool || "";
      if (debug)
        console.log("prompt: ", state.prompt);
      if (debug)
        console.log("autoSubmit: ", state.autoSubmit);
      if (debug)
        console.log("pasteImage: ", state.pasteImage);
      if (debug)
        console.log("tool: ", state.tool);
      if (!state.prompt && !state.tool) {
        return null;
      }
      return state;
    }
    function clearHash() {
      if (history.replaceState) {
        history.replaceState(null, document.title, window.location.pathname + window.location.search);
      } else {
        window.location.hash = "";
      }
    }
    return {
      debug,
      state,
      refreshParamsFromHash,
      clearHash,
      fillContentEditableWithParagraphs,
      fillTextareaAndDispatchInput,
      startRetryInterval,
      delay,
      fetchClipboardImageAndSimulatePaste
    };
  }

  // src/content/sites/claude.ts
  function initClaude(ctx) {
    if (location.hostname !== "claude.ai")
      return false;
    const params = ctx.refreshParamsFromHash();
    if (!params?.prompt)
      return true;
    ctx.startRetryInterval({
      intervalMs: 500,
      retries: 10,
      tick: () => {
        const textarea = document.querySelector("div[contenteditable]");
        if (!textarea)
          return false;
        ctx.fillContentEditableWithParagraphs(textarea, params.prompt);
        const button = document.querySelector("button");
        if (!button)
          return false;
        if (params.autoSubmit) {
          button.focus();
          setTimeout(() => {
            button.click();
          }, 500);
        }
        return true;
      }
    });
    return true;
  }

  // src/content/editorText.ts
  function extractPromptEditorText(editor) {
    if (!editor)
      return "";
    if (editor instanceof HTMLTextAreaElement)
      return editor.value;
    const paragraphs = Array.from(editor.querySelectorAll("p"));
    if (paragraphs.length) {
      return paragraphs.map((paragraph) => extractTextPreservingBreaks(paragraph)).join(`
`);
    }
    return editor.innerText || extractTextPreservingBreaks(editor) || editor.textContent || "";
  }
  function extractTextPreservingBreaks(element) {
    const parts = [];
    function visit(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.textContent || "");
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE)
        return;
      if (node.tagName === "BR") {
        parts.push(`
`);
        return;
      }
      node.childNodes.forEach(visit);
    }
    visit(element);
    return parts.join("");
  }

  // src/shared/promptMigrations.ts
  var PROMPT_MIGRATIONS_KEY = "chatgpttoolkit.promptMigrations";
  function getDefaultReviewPrompt() {
    return {
      enabled: true,
      initial: true,
      svgIcon: "\uD83D\uDCAC",
      title: "評論",
      altText: "評論剪貼簿內容並提出改進建議",
      prompt: `請評論以下內容，指出優缺點並提供改進建議：

`,
      autoPaste: true,
      autoSubmit: true
    };
  }
  function migrateAddMissingPrompts(prompts) {
    const review = getDefaultReviewPrompt();
    const reviewTitle = String(review.title).trim();
    const hasReview = prompts.some((p) => Boolean(p?.initial) && String(p?.title || "").trim() === reviewTitle);
    if (hasReview)
      return { prompts, changed: false };
    return { prompts: [...prompts, { ...review }], changed: true };
  }
  var PROMPT_MIGRATIONS = [{ id: "add-review-prompt", run: migrateAddMissingPrompts }];
  var ALL_PROMPT_MIGRATION_IDS = PROMPT_MIGRATIONS.map((migration) => migration.id);
  function applyPendingPromptMigrations(prompts, storedAppliedIds) {
    const applied = new Set(Array.isArray(storedAppliedIds) ? storedAppliedIds.filter((id) => typeof id === "string") : []);
    let current = prompts;
    let changed = false;
    let appliedChanged = !Array.isArray(storedAppliedIds) || applied.size !== storedAppliedIds.length;
    for (const migration of PROMPT_MIGRATIONS) {
      if (applied.has(migration.id))
        continue;
      const result = migration.run(current);
      current = result.prompts;
      changed = changed || result.changed;
      applied.add(migration.id);
      appliedChanged = true;
    }
    return { prompts: current, changed, appliedIds: Array.from(applied), appliedChanged };
  }

  // src/content/prompts.ts
  var CUSTOM_PROMPTS_KEY = "chatgpttoolkit.customPrompts";
  var ARGS_PLACEHOLDER = "{{args}}";
  function safeParseJsonArray(str) {
    if (!str)
      return null;
    try {
      const parsed = JSON.parse(str);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  function chromeStorageGet(keys) {
    try {
      if (!chrome?.storage?.local)
        return Promise.resolve({});
      return new Promise((resolve) => chrome.storage.local.get(keys, (result) => resolve(result || {})));
    } catch {
      return Promise.resolve({});
    }
  }
  function chromeStorageSet(items) {
    try {
      if (!chrome?.storage?.local)
        return Promise.resolve(false);
      return new Promise((resolve) => chrome.storage.local.set(items, () => resolve(true)));
    } catch {
      return Promise.resolve(false);
    }
  }
  async function loadCustomPrompts() {
    const items = await chromeStorageGet([CUSTOM_PROMPTS_KEY, PROMPT_MIGRATIONS_KEY]);
    const stored = items[CUSTOM_PROMPTS_KEY];
    const legacy = Array.isArray(stored) ? null : safeParseJsonArray(localStorage.getItem(CUSTOM_PROMPTS_KEY));
    const source = Array.isArray(stored) ? stored : legacy;
    if (!source)
      return null;
    const migrated = applyPendingPromptMigrations(source, items[PROMPT_MIGRATIONS_KEY]);
    const updates = {};
    if (migrated.changed || legacy)
      updates[CUSTOM_PROMPTS_KEY] = migrated.prompts;
    if (migrated.appliedChanged)
      updates[PROMPT_MIGRATIONS_KEY] = migrated.appliedIds;
    if (Object.keys(updates).length > 0)
      await chromeStorageSet(updates);
    return migrated.prompts;
  }
  function selectReadyPrompts(prompts, initial) {
    return (prompts || []).filter((item) => {
      if (!item || typeof item !== "object")
        return false;
      const isEnabled = !Object.prototype.hasOwnProperty.call(item, "enabled") || item.enabled === true;
      const isInitial = Object.prototype.hasOwnProperty.call(item, "initial") && item.initial === true;
      return isEnabled && isInitial === initial && !!item.title && !!item.prompt;
    });
  }
  function getReadyPromptsSignature(items) {
    return JSON.stringify(items.map((item) => [item.title, item.prompt, item.altText || "", item.autoPaste === true, item.autoSubmit === true]));
  }
  function getLocaleDefaultFollowUpPrompts(locale) {
    if (!locale)
      return [];
    if (locale === "zh-TW") {
      return [
        { title: "舉例說明", prompt: "請舉例說明" },
        { title: "提供細節", prompt: "請提供更多細節說明" },
        { title: "翻譯成繁中", prompt: "請將上述回應內容翻譯成臺灣常用的正體中文" },
        { title: "翻譯成英文", prompt: "Please translate the above response into English." }
      ];
    }
    if (locale === "ja") {
      return [
        { title: "例えば", prompt: "例を挙げて説明して" },
        { title: "詳細説明", prompt: "もっと詳細に説明して" },
        { title: "日本語に翻訳", prompt: "上述の返答内容を日本語に翻訳して" },
        { title: "英語に翻訳", prompt: "Please translate the above response into English." }
      ];
    }
    return [
      { title: "More Examples", prompt: "Could you please provide me with more examples?" },
      { title: "More Details", prompt: "Could you please provide me with more details?" },
      { title: "Translate to English", prompt: "Please translate the above response into English." }
    ];
  }
  function applyPromptArgs(template, argsText) {
    if (template.includes(ARGS_PLACEHOLDER)) {
      return template.split(ARGS_PLACEHOLDER).join(argsText);
    }
    return argsText ? template + argsText : template;
  }
  function readClipboardTextSafely(debug, site) {
    if (!navigator.clipboard?.readText)
      return Promise.resolve("");
    return navigator.clipboard.readText().catch((error) => {
      if (debug)
        console.warn(`[ChatGPTToolkit][${site}] clipboard read failed`, error);
      return "";
    });
  }
  async function resolveAutoPastePrompt(template, editorText, debug, site) {
    const trimmedEditorText = editorText.trim();
    const argsText = trimmedEditorText || (await readClipboardTextSafely(debug, site)).trim();
    return {
      prompt: applyPromptArgs(template, argsText),
      argsSource: trimmedEditorText ? "editor" : "clipboard",
      argsLength: argsText.length
    };
  }

  // src/content/sites/gemini.ts
  function initGemini(ctx) {
    if (location.hostname !== "gemini.google.com")
      return false;
    const { state, debug } = ctx;
    const GEMINI_EDITOR_SELECTORS = [
      "chat-window .textarea",
      "input-container rich-textarea .ql-editor",
      "rich-textarea .ql-editor",
      'input-container [contenteditable="true"][role="textbox"]',
      'chat-window [contenteditable="true"][role="textbox"]'
    ];
    const GEMINI_SEND_BUTTON_SELECTORS = [
      "chat-window button.send-button",
      "button.send-button",
      'chat-window button[aria-label*="Send"]',
      'chat-window button[aria-label*="送出"]',
      'chat-window button[aria-label*="傳送"]',
      'button[aria-label*="Send"]',
      'button[aria-label*="送出"]',
      'button[aria-label*="傳送"]',
      'button[data-test-id*="send"]',
      'button[data-testid*="send"]'
    ];
    const GEMINI_COMPOSER_ROOT_SELECTOR = "form, input-container, rich-textarea, .input-area, .chat-input, .composer, chat-window";
    let promptFillRunId = 0;
    function getPromptEditor() {
      for (const selector of GEMINI_EDITOR_SELECTORS) {
        const editors = Array.from(document.querySelectorAll(selector));
        const visibleEditor = editors.find((item) => isElementVisible(item));
        if (visibleEditor)
          return visibleEditor;
        if (editors[0])
          return editors[0];
      }
      return null;
    }
    function setGeminiPromptEditor(editorDiv, promptText) {
      if (!editorDiv)
        return;
      ctx.fillContentEditableWithParagraphs(editorDiv, promptText);
      editorDiv.dispatchEvent(new Event("input", { bubbles: true }));
      editorDiv.focus();
    }
    function getPromptEditorText() {
      return extractPromptEditorText(getPromptEditor());
    }
    function isSendButtonEnabled(button) {
      if (!button)
        return false;
      if (button.disabled)
        return false;
      if (button.getAttribute("aria-disabled") === "true")
        return false;
      return true;
    }
    function getSendButton() {
      for (const selector of GEMINI_SEND_BUTTON_SELECTORS) {
        const button = document.querySelector(selector);
        if (button)
          return button;
      }
      const buttons = Array.from(document.querySelectorAll("button"));
      return buttons.find(isLikelySendButton) || null;
    }
    function isLikelySendButton(button) {
      const ariaLabel = (button.getAttribute("aria-label") || "").toLowerCase();
      const testId = (button.getAttribute("data-test-id") || button.getAttribute("data-testid") || "").toLowerCase();
      const textContent = (button.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      const icon = button.querySelector("mat-icon, [data-mat-icon-name], [fonticon]");
      const iconName = (icon?.getAttribute("fonticon") || icon?.getAttribute("data-mat-icon-name") || icon?.textContent || "").toLowerCase();
      const sendTokens = ["send", "submit", "送出", "傳送", "提交"];
      return sendTokens.some((token) => ariaLabel.includes(token) || testId.includes(token) || textContent === token || iconName.includes(token));
    }
    function findComposerRoot(element) {
      if (!element)
        return null;
      return element.closest(GEMINI_COMPOSER_ROOT_SELECTOR) || element.parentElement;
    }
    function isSendButtonStopState(button) {
      if (!button)
        return false;
      const ariaLabel = (button.getAttribute("aria-label") || "").toLowerCase();
      const icon = button.querySelector("mat-icon");
      const iconName = (icon?.getAttribute("fonticon") || icon?.getAttribute("data-mat-icon-name") || icon?.textContent || "").toLowerCase();
      return ariaLabel.includes("stop") || ariaLabel.includes("停止") || ariaLabel.includes("中止") || ariaLabel.includes("取消") || iconName.includes("stop") || iconName.includes("close") || iconName.includes("cancel");
    }
    function isElementVisible(element) {
      if (!element)
        return false;
      const style = window.getComputedStyle(element);
      if (style.display === "none")
        return false;
      if (style.visibility === "hidden")
        return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }
    function autoSubmitWhenReady() {
      ctx.startRetryInterval({
        intervalMs: 120,
        retries: 20,
        tick: () => {
          const button = getSendButton();
          if (!isSendButtonEnabled(button))
            return false;
          if (isSendButtonStopState(button))
            return false;
          if (state.pasteImage && !isImageUploadComplete())
            return false;
          button.focus();
          button.click();
          return true;
        }
      });
    }
    function normalizeEditorText(text) {
      return text.replace(/\s+/g, " ").trim();
    }
    function fillPrompt(prompt, autoSubmit = true) {
      const runId = ++promptFillRunId;
      const expected = normalizeEditorText(prompt);
      let autoSubmitScheduled = false;
      ctx.startRetryInterval({
        intervalMs: 80,
        retries: 15,
        tick: () => {
          if (runId !== promptFillRunId)
            return true;
          const editorDiv = getPromptEditor();
          if (!editorDiv)
            return false;
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
        }
      });
    }
    function bindPromptButton(button, item, autoPasteEnabled, autoSubmitEnabled, label) {
      let lastTriggerAt = 0;
      const trigger = (source) => {
        const now = Date.now();
        if (now - lastTriggerAt < 250) {
          if (debug) {
            console.log(`[ChatGPTToolkit][gemini] ${label} button trigger ignored`, {
              source,
              title: item.title,
              deltaMs: now - lastTriggerAt
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
            promptLength: item.prompt?.length || 0
          });
        }
        if (autoPasteEnabled) {
          resolveAutoPastePrompt(item.prompt, getPromptEditorText(), debug, "gemini").then((resolved) => {
            if (debug) {
              console.log(`[ChatGPTToolkit][gemini] ${label} button args resolved`, {
                title: item.title,
                argsSource: resolved.argsSource,
                argsLength: resolved.argsLength,
                nextPromptLength: resolved.prompt.length
              });
            }
            fillPrompt(resolved.prompt, autoSubmitEnabled);
          });
        } else {
          fillPrompt(item.prompt, autoSubmitEnabled);
        }
      };
      button.addEventListener("pointerdown", (event) => {
        if (event.button !== 0)
          return;
        event.stopPropagation();
        trigger("pointerdown");
      });
      button.addEventListener("mousedown", (event) => {
        if (event.button !== 0)
          return;
        event.stopPropagation();
      });
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        trigger("click");
      });
      button.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ")
          return;
        event.preventDefault();
        event.stopPropagation();
        trigger(`keydown:${event.key}`);
      });
    }
    (async () => {
      let initialManualSubmitText = [];
      let followUpManualSubmitText = [];
      const localeDefaultManualSubmitText = getLocaleDefaultFollowUpPrompts(chrome.i18n?.getUILanguage());
      let lastResponse;
      let initialButtonsSignature = "";
      let shiftedInitialHeading = null;
      followUpManualSubmitText = [...localeDefaultManualSubmitText];
      const customPrompts = await loadCustomPrompts();
      if (Array.isArray(customPrompts)) {
        initialManualSubmitText = selectReadyPrompts(customPrompts, true);
        followUpManualSubmitText = selectReadyPrompts(customPrompts, false);
      }
      let mutationObserverTimer;
      const obs = new MutationObserver((mutations) => {
        const hasRelevantMutation = mutations.some((mutation) => {
          const target = mutation.target;
          const element = target instanceof HTMLElement ? target : target.parentElement instanceof HTMLElement ? target.parentElement : null;
          if (!element)
            return true;
          if (element.closest("#custom-gemini-initial-buttons"))
            return false;
          if (element.closest("#custom-gemini-followup-buttons"))
            return false;
          if (element.getAttribute("data-chatgpttoolkit-gemini-heading-shift") === "true")
            return false;
          const isOurButtonNode = (node) => node instanceof HTMLElement && (node.id === "custom-gemini-initial-buttons" || node.id === "custom-gemini-followup-buttons");
          if (Array.from(mutation.addedNodes).some(isOurButtonNode))
            return false;
          if (Array.from(mutation.removedNodes).some(isOurButtonNode))
            return false;
          return true;
        });
        if (!hasRelevantMutation)
          return;
        clearTimeout(mutationObserverTimer);
        mutationObserverTimer = setTimeout(() => {
          rebuildInitialButtons();
          rebuildFollowUpButtons();
        }, 0);
      });
      function getInitialButtonsComposerAnchor() {
        const editor = getPromptEditor();
        const sendButton = getSendButton();
        const editorAnchor = document.querySelector('input-container [contenteditable="true"][role="textbox"], rich-textarea [contenteditable="true"][role="textbox"]')?.closest("input-container") || null;
        const candidates = [
          editorAnchor,
          editor?.closest("input-container"),
          editor?.closest("form"),
          sendButton?.closest("input-container"),
          sendButton?.closest("form"),
          ...Array.from(document.querySelectorAll("chat-window input-container")),
          ...Array.from(document.querySelectorAll("input-container"))
        ];
        const uniq = Array.from(new Set(candidates.filter((item) => Boolean(item))));
        const visible = uniq.filter((item) => Boolean(item.parentElement) && isElementVisible(item));
        const preferred = visible.find((item) => item.contains(editor) || item.contains(sendButton));
        if (preferred)
          return preferred;
        const byTop = [...visible].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
        return byTop[0] || uniq.find((item) => Boolean(item.parentElement)) || null;
      }
      function getInitialButtonsZeroStateMountTarget() {
        const zeroStateBlock = document.querySelector(".zero-state-block-container");
        if (!zeroStateBlock)
          return null;
        const primaryMessage = zeroStateBlock.querySelector("assistant-messages-primary") || zeroStateBlock.querySelector(".assistant-messages-primary-container");
        if (!primaryMessage)
          return null;
        let beforeNode = primaryMessage.nextElementSibling;
        if (beforeNode && beforeNode.id === "custom-gemini-initial-buttons") {
          beforeNode = beforeNode.nextElementSibling;
        }
        return {
          container: zeroStateBlock,
          beforeNode
        };
      }
      function getInitialButtonsMountTarget() {
        if (getAssistantResponseBlocks().length > 0)
          return null;
        const zeroStateMountTarget = getInitialButtonsZeroStateMountTarget();
        if (zeroStateMountTarget)
          return zeroStateMountTarget;
        const composerAnchor = getInitialButtonsComposerAnchor();
        if (!composerAnchor || !composerAnchor.parentElement)
          return null;
        return {
          container: composerAnchor.parentElement,
          beforeNode: composerAnchor
        };
      }
      function getInitialButtonsHeadingTarget(anchor, bar) {
        const anchorRect = anchor.getBoundingClientRect();
        const pageCenter = window.innerWidth / 2;
        const candidates = Array.from(document.querySelectorAll("h1, h2, div, span")).filter((item) => {
          if (item === bar || item.contains(bar) || bar.contains(item))
            return false;
          if (anchor.contains(item))
            return false;
          if (!isElementVisible(item))
            return false;
          const text = (item.textContent || "").replace(/\s+/g, " ").trim();
          if (text.length < 2 || text.length > 80)
            return false;
          const rect = item.getBoundingClientRect();
          if (rect.bottom > anchorRect.top)
            return false;
          if (rect.top < 80)
            return false;
          const style = window.getComputedStyle(item);
          const fontSize = Number.parseFloat(style.fontSize || "0");
          if (!Number.isFinite(fontSize) || fontSize < 24)
            return false;
          return true;
        }).map((item) => {
          const rect = item.getBoundingClientRect();
          const centerDistance = Math.abs(rect.left + rect.width / 2 - pageCenter);
          const verticalDistance = anchorRect.top - rect.bottom;
          return { item, centerDistance, verticalDistance, area: rect.width * rect.height };
        }).sort((a, b) => {
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
      function setStylePropertyIfChanged(element, property, value) {
        if (element.style.getPropertyValue(property) !== value) {
          element.style.setProperty(property, value);
        }
      }
      function removeStylePropertyIfPresent(element, property) {
        if (element.style.getPropertyValue(property)) {
          element.style.removeProperty(property);
        }
      }
      function setInitialButtonsHeadingShift(headingTarget, shiftPx) {
        if (shiftedInitialHeading && shiftedInitialHeading !== headingTarget) {
          shiftedInitialHeading.style.removeProperty("transform");
          shiftedInitialHeading.removeAttribute("data-chatgpttoolkit-gemini-heading-shift");
        }
        shiftedInitialHeading = headingTarget;
        if (!headingTarget)
          return;
        setStylePropertyIfChanged(headingTarget, "transform", `translateY(-${shiftPx}px)`);
        if (headingTarget.getAttribute("data-chatgpttoolkit-gemini-heading-shift") !== "true") {
          headingTarget.setAttribute("data-chatgpttoolkit-gemini-heading-shift", "true");
        }
      }
      function resetInitialButtonsHeadingShift() {
        setInitialButtonsHeadingShift(null, 0);
      }
      function rebuildInitialButtons() {
        const existing = document.getElementById("custom-gemini-initial-buttons");
        if (!Array.isArray(initialManualSubmitText) || initialManualSubmitText.length === 0) {
          existing?.remove();
          resetInitialButtonsHeadingShift();
          initialButtonsSignature = "";
          return;
        }
        const mountTarget = getInitialButtonsMountTarget();
        if (!mountTarget) {
          existing?.remove();
          resetInitialButtonsHeadingShift();
          initialButtonsSignature = "";
          return;
        }
        let bar = existing;
        if (!bar) {
          bar = document.createElement("div");
          bar.id = "custom-gemini-initial-buttons";
        }
        const barEl = bar;
        const nextSignature = getReadyPromptsSignature(initialManualSubmitText);
        const shouldRebuildButtons = !existing || nextSignature !== initialButtonsSignature;
        if (shouldRebuildButtons && barEl.style.visibility !== "hidden") {
          barEl.style.visibility = "hidden";
        }
        setStylePropertyIfChanged(barEl, "display", "flex");
        setStylePropertyIfChanged(barEl, "flex-wrap", "wrap");
        setStylePropertyIfChanged(barEl, "gap", "0.5rem");
        setStylePropertyIfChanged(barEl, "justify-content", "center");
        setStylePropertyIfChanged(barEl, "align-items", "center");
        setStylePropertyIfChanged(barEl, "margin", "0.9rem 0 0.9rem 0");
        setStylePropertyIfChanged(barEl, "width", "100%");
        setStylePropertyIfChanged(barEl, "max-width", "100%");
        setStylePropertyIfChanged(barEl, "box-sizing", "border-box");
        setStylePropertyIfChanged(barEl, "pointer-events", "auto");
        setStylePropertyIfChanged(barEl, "position", "relative");
        setStylePropertyIfChanged(barEl, "z-index", "2");
        removeStylePropertyIfPresent(barEl, "left");
        removeStylePropertyIfPresent(barEl, "top");
        removeStylePropertyIfPresent(barEl, "padding-left");
        const headingShiftPx = 28;
        const buttonShiftPx = 8;
        setStylePropertyIfChanged(barEl, "transform", `translateY(-${buttonShiftPx}px)`);
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
          if (barEl.style.visibility !== "visible") {
            barEl.style.visibility = "visible";
          }
          return;
        }
        barEl.innerHTML = "";
        initialButtonsSignature = nextSignature;
        initialManualSubmitText.forEach((item) => {
          const autoPasteEnabled = item.autoPaste === true;
          const autoSubmitEnabled = item.autoSubmit === true;
          const btn = document.createElement("button");
          btn.type = "button";
          btn.tabIndex = 0;
          btn.style.display = "inline-flex";
          btn.style.alignItems = "center";
          btn.style.justifyContent = "center";
          btn.style.border = "1px solid #d1d5db";
          btn.style.borderRadius = "999px";
          btn.style.padding = "0.3rem 0.8rem";
          btn.style.margin = "0";
          btn.style.fontSize = "0.85rem";
          btn.style.background = "transparent";
          btn.style.cursor = "pointer";
          btn.style.lineHeight = "1.2";
          btn.style.whiteSpace = "nowrap";
          btn.style.color = "inherit";
          btn.style.pointerEvents = "auto";
          btn.style.position = "relative";
          btn.style.zIndex = "3";
          btn.textContent = item.title;
          if (item.altText) {
            btn.title = String(item.altText);
          }
          bindPromptButton(btn, item, autoPasteEnabled, autoSubmitEnabled, "initial");
          barEl.append(btn);
        });
        requestAnimationFrame(() => {
          if (barEl.isConnected && barEl.style.visibility !== "visible") {
            barEl.style.visibility = "visible";
          }
        });
      }
      function getAssistantResponseBlocks() {
        const modelResponses = Array.from(document.querySelectorAll("model-response"));
        if (modelResponses.length > 0)
          return modelResponses;
        const responseContainers = Array.from(document.querySelectorAll("response-container"));
        if (responseContainers.length > 0)
          return responseContainers;
        return Array.from(document.querySelectorAll(".conversation-container"));
      }
      function rebuildFollowUpButtons() {
        const existing = document.getElementById("custom-gemini-followup-buttons");
        const zeroState = document.querySelector("modular-zero-state");
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
        if (document.getElementById("custom-gemini-followup-buttons")) {
          return;
        }
        const bar = document.createElement("div");
        bar.id = "custom-gemini-followup-buttons";
        bar.style.display = "flex";
        bar.style.flexWrap = "wrap";
        bar.style.gap = "0.5rem";
        bar.style.padding = "0.5rem 0 0.75rem 0";
        bar.style.pointerEvents = "auto";
        followUpManualSubmitText.forEach((item) => {
          const autoPasteEnabled = item.autoPaste === true;
          const autoSubmitEnabled = item.autoSubmit === true;
          const btn = document.createElement("button");
          btn.type = "button";
          btn.style.border = "1px solid #d1d5db";
          btn.style.borderRadius = "5px";
          btn.style.padding = "0.5rem 1rem";
          btn.style.cursor = "pointer";
          btn.style.background = "transparent";
          btn.style.color = "inherit";
          btn.textContent = item.title;
          if (item.altText) {
            btn.title = String(item.altText);
          }
          bindPromptButton(btn, item, autoPasteEnabled, autoSubmitEnabled, "follow-up");
          bar.append(btn);
        });
        latest.after(bar);
        lastResponse = latest;
      }
      if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
          if (areaName !== "local")
            return;
          const change = changes?.[CUSTOM_PROMPTS_KEY];
          if (!change)
            return;
          const nextPrompts = Array.isArray(change.newValue) ? change.newValue : null;
          const nextInitial = nextPrompts ? selectReadyPrompts(nextPrompts, true) : [];
          const nextFollowUp = nextPrompts ? selectReadyPrompts(nextPrompts, false) : [...localeDefaultManualSubmitText];
          initialManualSubmitText = nextInitial;
          followUpManualSubmitText = nextFollowUp;
          document.querySelectorAll("#custom-gemini-initial-buttons")?.forEach((item) => item.remove());
          document.querySelectorAll("#custom-gemini-followup-buttons")?.forEach((item) => item.remove());
          rebuildInitialButtons();
          rebuildFollowUpButtons();
        });
      }
      rebuildInitialButtons();
      rebuildFollowUpButtons();
      obs.observe(document.body, {
        childList: true,
        subtree: true
      });
    })();
    ctx.refreshParamsFromHash();
    const hasParams = Boolean(state.prompt || state.tool || state.pasteImage || state.autoSubmit);
    if (!hasParams)
      return true;
    let toolImageClicked = false;
    let promptFilled = false;
    let pastingGeminiImage = false;
    let geminiImagePasteAttempted = false;
    let submitted = false;
    function getComposerRoot() {
      const sendButtonRoot = findComposerRoot(getSendButton());
      if (sendButtonRoot)
        return sendButtonRoot;
      const editorRoot = findComposerRoot(getPromptEditor());
      if (editorRoot)
        return editorRoot;
      return document.querySelector("chat-window, input-container, rich-textarea");
    }
    function hasUploadInProgress(root) {
      const previewRoot = root.querySelector(".uploader-file-preview-container") || root;
      const progressSelector = [
        "mat-progress-bar",
        "mat-progress-spinner",
        '[role="progressbar"]',
        '[aria-busy="true"]',
        ".uploading",
        ".loading",
        ".progress"
      ].join(",");
      return Boolean(previewRoot.querySelector(progressSelector));
    }
    function hasImageAttachment(root) {
      const previewSelector = [
        ".file-preview-container",
        '[data-test-id*="file"]',
        '[data-test-id*="attachment"]',
        '[data-test-id*="upload"]',
        'img[src^="blob:"]',
        'img[src^="data:"]'
      ].join(",");
      return Boolean(root.querySelector(previewSelector));
    }
    function isImageUploadComplete() {
      if (!state.pasteImage)
        return true;
      if (pastingGeminiImage || !geminiImagePasteAttempted)
        return false;
      const root = getComposerRoot();
      if (!root)
        return false;
      if (!hasImageAttachment(root))
        return false;
      if (hasUploadInProgress(root))
        return false;
      return true;
    }
    const tryClickImageToolButton = () => {
      if (toolImageClicked)
        return;
      if (state.tool !== "image")
        return;
      const buttons = Array.from(document.querySelectorAll("button"));
      for (const button of buttons) {
        const textContent = (button.textContent || "").replace(/\s+/g, " ").trim();
        if (!textContent)
          continue;
        const isMatch = textContent.includes("生成圖片") || textContent.toLowerCase().includes("create image");
        if (!isMatch)
          continue;
        if (button.disabled)
          continue;
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
          if (debug)
            console.log("Gemini: 貼上圖片中");
          await ctx.delay(300);
          await ctx.fetchClipboardImageAndSimulatePaste(textarea);
          if (debug)
            console.log("Gemini: 貼上圖片完成");
          pastingGeminiImage = false;
        }
        const button = getSendButton();
        const uploadReady = isImageUploadComplete();
        const canSubmit = isSendButtonEnabled(button) && !isSendButtonStopState(button) && promptFilled && state.autoSubmit && !submitted && !pastingGeminiImage && uploadReady && (state.tool !== "image" || toolImageClicked);
        if (canSubmit) {
          submitted = true;
          button.focus();
          setTimeout(() => {
            button.click();
          }, 500);
        }
        const done = (!state.prompt || promptFilled) && (!state.pasteImage || isImageUploadComplete()) && (!state.autoSubmit || submitted) && (state.tool !== "image" || toolImageClicked);
        if (done) {
          ctx.clearHash();
        }
        return done;
      }
    });
    return true;
  }

  // src/content/sites/groq.ts
  function initGroq(ctx) {
    if (location.hostname !== "groq.com")
      return false;
    const params = ctx.refreshParamsFromHash();
    if (!params?.prompt)
      return true;
    ctx.startRetryInterval({
      intervalMs: 500,
      retries: 10,
      tick: () => {
        const textarea = document.getElementById("chat");
        if (!textarea)
          return false;
        ctx.fillTextareaAndDispatchInput(textarea, params.prompt);
        if (params.autoSubmit) {
          setTimeout(() => {
            const btn = textarea.parentElement?.querySelector("button");
            btn?.click();
          }, 2000);
        }
        return true;
      }
    });
    return true;
  }

  // src/content/sites/perplexity.ts
  function initPerplexity(ctx) {
    if (location.hostname !== "www.perplexity.ai")
      return false;
    const params = ctx.refreshParamsFromHash();
    if (!params?.prompt)
      return true;
    ctx.startRetryInterval({
      intervalMs: 500,
      retries: 10,
      tick: () => {
        const textarea = document.querySelector("textarea[autofocus]");
        if (!textarea)
          return false;
        ctx.fillTextareaAndDispatchInput(textarea, params.prompt);
        if (params.autoSubmit) {
          setTimeout(() => {
            const buttons = textarea.parentElement?.querySelectorAll("button");
            const submitButton = buttons?.[buttons.length - 1];
            submitButton?.click();
          }, 500);
        }
        return true;
      }
    });
    return true;
  }

  // src/content/sites/phind.ts
  function initPhind(ctx) {
    if (location.hostname !== "www.phind.com")
      return false;
    const params = ctx.refreshParamsFromHash();
    if (!params?.prompt)
      return true;
    ctx.startRetryInterval({
      intervalMs: 500,
      retries: 10,
      tick: () => {
        const textarea = document.querySelector('textarea[name="q"]');
        if (!textarea)
          return false;
        ctx.fillTextareaAndDispatchInput(textarea, params.prompt);
        if (params.autoSubmit) {
          textarea.form?.submit();
        }
        return true;
      }
    });
    return true;
  }

  // src/content/sites/chatgpt.ts
  var COMPOSER_FORM_SELECTORS = [
    "form[data-chatgpt-composer]",
    'form[data-type="unified-composer"]',
    "form[data-mobile-composer]"
  ];
  var PROMPT_EDITOR_SELECTORS = [
    "#prompt-textarea",
    '[data-composer-markdown][contenteditable="true"]',
    'textarea[name="prompt"]',
    '[contenteditable="true"][role="textbox"]',
    'textarea[data-testid*="prompt"]',
    "textarea[placeholder]",
    "textarea",
    '[contenteditable="true"][data-virtualkeyboard="true"]',
    '[contenteditable="true"]'
  ];
  var SEND_BUTTON_SELECTORS = [
    'button[data-testid="composer-send-button"]',
    'button[data-testid="send-button"]',
    'button[data-testid*="send-button"]',
    "button[data-composer-submit]",
    'button[aria-label*="Submit"]',
    'button[aria-label*="Send"]',
    'button[aria-label*="傳送"]',
    'button[aria-label*="送出"]',
    'button[aria-label*="送信"]'
  ];
  var CONVERSATION_CONTENT_SELECTOR = "[data-turn-key], [data-content-search-unit-key], article[data-turn], [data-message-author-role]";
  var ASSISTANT_UNIT_SELECTOR = '[data-content-search-unit-key$=":assistant"], [data-chatgpt-search-unit-key$=":assistant"]';
  var USER_MESSAGE_SELECTOR = '[data-content-search-unit-key$=":user"], [data-chatgpt-search-unit-key$=":user"], div[data-message-author-role="user"]';
  var STOP_LABEL_PATTERN = /stop|停止|中止|중지/i;
  var NOT_STOP_LABEL_PATTERN = /dictat|voice|record|聽寫|語音|音声|録音|음성/i;
  var EDIT_LABEL_PATTERN = /edit|編輯|编辑|編集|修改|편집/i;
  var INITIAL_BAR_ID = "custom-chatgpt-initial-buttons";
  var FOLLOW_UP_AREA_ID = "custom-chatgpt-magic-box-buttons";
  var STYLE_ID = "custom-chatgpt-button-styles";
  var HEADING_SHIFT_ATTR = "data-chatgpttoolkit-chatgpt-heading-shift";
  var MARKMAP_SCANNED_ATTR = "data-chatgpttoolkit-markmap";
  var REBUILD_THROTTLE_MS = 150;
  var HEADING_SHIFT_PX = 48;
  var BUTTON_STYLES = `
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
  var MINDMAP_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="12" viewBox="0 0 128 128" aria-hidden="true"><path fill="#F5E41C" stroke="#010100" stroke-width="2" d="M76.35 109.75C61.4 101.92 53.99 89.4 51.84 73.08c-10.98 0-21.78.02-32.59-.01-6.37-.02-10.02-2.86-10.14-7.79-.12-5.04 3.8-8.19 10.32-8.21 10.65-.03 21.3-.01 31.75-.01.38-.47.7-.68.74-.95 4.5-25.18 19.67-39.08 46.09-42.08 4.79-.54 9.62-.89 14.44-.97 5.2-.09 8.51 3.02 8.67 7.62.17 4.86-3.14 7.72-8.53 8.4-8.53 1.07-17.29 1.71-25.44 4.2-11.36 3.46-17.21 11.76-18.83 23.78h39.47c1.67 0 3.34-.08 5 .03 5.1.33 8.32 3.55 8.25 8.17-.07 4.6-3.33 7.74-8.53 7.78-12.83.09-25.65.03-38.48.04h-5.8c1.45 10.83 6.64 18.94 16.52 22.73 7.02 2.69 14.74 3.62 22.19 5.15 2.09.43 4.33.03 6.48.28 5.05.57 8.02 4 7.68 8.68-.31 4.4-3.5 7.19-8.52 7.22-12.45.07-24.53-1.79-36.23-7.37z"/></svg>';
  function initChatGPT(ctx) {
    const { state, debug } = ctx;
    function isInitialButtonsAllowedPage() {
      const pathname = (location.pathname || "/").replace(/\/+$/, "") || "/";
      return pathname === "/";
    }
    function isElementVisible(el) {
      if (!el)
        return false;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden")
        return false;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0)
        return true;
      return el.getClientRects().length > 0;
    }
    function isInsideConversation(el) {
      return Boolean(el.closest(CONVERSATION_CONTENT_SELECTOR));
    }
    function getComposerForm() {
      for (const selector of COMPOSER_FORM_SELECTORS) {
        const forms = Array.from(document.querySelectorAll(selector)).filter((form) => !isInsideConversation(form));
        const match = forms.find((form) => isElementVisible(form)) || forms[0];
        if (match)
          return match;
      }
      return null;
    }
    function isStopButton(button) {
      if (button.hidden)
        return false;
      const label = (button.getAttribute("aria-label") || "").trim();
      if (!label)
        return false;
      const stopLabel = button.getAttribute("data-stop-label");
      if (stopLabel)
        return label === stopLabel;
      if (button.getAttribute("type") === "submit")
        return false;
      return STOP_LABEL_PATTERN.test(label) && !NOT_STOP_LABEL_PATTERN.test(label);
    }
    function isGenerating() {
      if (document.querySelector('button[data-testid="stop-button"]'))
        return true;
      const form = getComposerForm();
      if (!form)
        return false;
      return Array.from(form.querySelectorAll("button")).some(isStopButton);
    }
    function pickSendButton(buttons) {
      const candidates = buttons.filter((button) => !button.hidden && !isStopButton(button));
      return candidates.find((button) => isElementVisible(button) && !button.disabled) || candidates[0] || null;
    }
    function getSendButton() {
      const form = getComposerForm();
      if (form) {
        for (const selector of [...SEND_BUTTON_SELECTORS, 'button[type="submit"]']) {
          const button = pickSendButton(Array.from(form.querySelectorAll(selector)));
          if (button)
            return button;
        }
      }
      for (const selector of SEND_BUTTON_SELECTORS) {
        const buttons = Array.from(document.querySelectorAll(selector)).filter((button2) => !isInsideConversation(button2));
        const button = pickSendButton(buttons);
        if (button)
          return button;
      }
      return null;
    }
    function isSendButtonEnabled(sendButton) {
      if (!sendButton)
        return false;
      if (sendButton.disabled)
        return false;
      if (sendButton.getAttribute("aria-disabled") === "true")
        return false;
      return true;
    }
    function getComposerRoot() {
      return getComposerForm() || getSendButton()?.closest("form, main") || document.querySelector("main") || document;
    }
    function getPromptEditor() {
      const root = getComposerRoot();
      for (const selector of PROMPT_EDITOR_SELECTORS) {
        const candidates = Array.from(root.querySelectorAll(selector));
        const match = candidates.find((el) => isElementVisible(el) && !el.closest('[aria-hidden="true"]') && !isInsideConversation(el));
        if (match)
          return match;
      }
      return null;
    }
    function hasConversationMessages() {
      return Boolean(document.querySelector('[data-turn-key], [data-content-search-unit-key], div[data-message-author-role="assistant"], div[data-message-author-role="user"]'));
    }
    function isDarkTheme() {
      const root = document.documentElement;
      if (root.classList.contains("dark") || root.dataset.theme === "dark")
        return true;
      if (root.classList.contains("light") || root.dataset.theme === "light")
        return false;
      return window.getComputedStyle(root).colorScheme === "dark";
    }
    function ensureButtonStyles() {
      if (document.getElementById(STYLE_ID))
        return;
      const styleEl = document.createElement("style");
      styleEl.id = STYLE_ID;
      styleEl.textContent = BUTTON_STYLES;
      (document.head || document.documentElement).appendChild(styleEl);
    }
    function setChatGPTPromptEditor(editorDiv, promptText) {
      if (!editorDiv)
        return;
      if (editorDiv instanceof HTMLTextAreaElement) {
        ctx.fillTextareaAndDispatchInput(editorDiv, promptText);
        editorDiv.focus();
        return;
      }
      ctx.fillContentEditableWithParagraphs(editorDiv, promptText);
      editorDiv.dispatchEvent(new Event("input", { bubbles: true }));
      editorDiv.focus();
    }
    function bindPromptButton(button, item, label) {
      const autoPasteEnabled = item.autoPaste === true;
      const autoSubmitEnabled = item.autoSubmit === true;
      let lastTriggerAt = 0;
      const trigger = (source) => {
        const now = Date.now();
        if (now - lastTriggerAt < 250) {
          if (debug) {
            console.log(`[ChatGPTToolkit][chatgpt] ${label} button trigger ignored`, {
              source,
              title: item.title,
              deltaMs: now - lastTriggerAt
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
            promptLength: item.prompt.length
          });
        }
        if (!autoPasteEnabled) {
          fillPrompt(item.prompt, autoSubmitEnabled);
          return;
        }
        const editorText = extractPromptEditorText(getPromptEditor());
        resolveAutoPastePrompt(item.prompt, editorText, debug, "chatgpt").then((resolved) => {
          if (debug) {
            console.log(`[ChatGPTToolkit][chatgpt] ${label} button args resolved`, {
              title: item.title,
              argsSource: resolved.argsSource,
              argsLength: resolved.argsLength,
              nextPromptLength: resolved.prompt.length
            });
          }
          fillPrompt(resolved.prompt, autoSubmitEnabled);
        });
      };
      button.addEventListener("pointerdown", (event) => {
        if (event.button !== 0)
          return;
        trigger("pointerdown");
      });
      button.addEventListener("click", (event) => {
        if (event.detail !== 0)
          return;
        trigger("click");
      });
    }
    function createPromptButton(item, label) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chatgpttoolkit-btn";
      button.textContent = item.title;
      if (item.altText)
        button.title = String(item.altText);
      bindPromptButton(button, item, label);
      return button;
    }
    function describeElement(el) {
      if (!el)
        return "null";
      const htmlEl = el;
      const tag = el.tagName.toLowerCase();
      const id = htmlEl.id ? `#${htmlEl.id}` : "";
      const className = htmlEl.className ? `.${String(htmlEl.className).trim().split(/\s+/).slice(0, 2).join(".")}` : "";
      return `${tag}${id}${className}`;
    }
    function logEditorState(editorDiv, label) {
      if (!debug)
        return;
      const text = (editorDiv instanceof HTMLTextAreaElement ? editorDiv.value : editorDiv.textContent || "").replace(/\s+/g, " ").trim();
      console.log(`[ChatGPTToolkit][chatgpt] ${label}`, {
        activeElement: describeElement(document.activeElement),
        textLength: text.length,
        textPreview: text.slice(0, 120)
      });
    }
    function placeCaretAtEnd(editorDiv) {
      if (editorDiv instanceof HTMLTextAreaElement) {
        editorDiv.selectionStart = editorDiv.selectionEnd = editorDiv.value.length;
        return;
      }
      const selection = window.getSelection();
      if (!selection)
        return;
      const range = document.createRange();
      range.selectNodeContents(editorDiv);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    function guessKeyCode(key) {
      if (key.length === 1) {
        const lower = key.toLowerCase();
        if (lower >= "a" && lower <= "z") {
          return `Key${lower.toUpperCase()}`;
        }
        if (key === "/")
          return "Slash";
        if (key === " ")
          return "Space";
      }
      return key;
    }
    function dispatchKeyEvent(editorDiv, type, key) {
      const charCode = key.length === 1 ? key.charCodeAt(0) : undefined;
      const eventInit = {
        key,
        code: guessKeyCode(key),
        keyCode: charCode,
        which: charCode,
        bubbles: true,
        cancelable: true
      };
      const event = new KeyboardEvent(type, eventInit);
      const dispatched = editorDiv.dispatchEvent(event);
      if (debug) {
        console.log(`[ChatGPTToolkit][chatgpt] ${type} "${key}" dispatched=${dispatched}`);
      }
      return dispatched;
    }
    function dispatchInputEvent(editorDiv, data) {
      try {
        const event = new InputEvent("input", {
          bubbles: true,
          data,
          inputType: "insertText"
        });
        const dispatched = editorDiv.dispatchEvent(event);
        if (debug)
          console.log("[ChatGPTToolkit][chatgpt] input event dispatched", { data, dispatched });
        return dispatched;
      } catch {
        const dispatched = editorDiv.dispatchEvent(new Event("input", { bubbles: true }));
        if (debug)
          console.log("[ChatGPTToolkit][chatgpt] input event fallback dispatched", { data, dispatched });
        return dispatched;
      }
    }
    function insertTextAtCursor(editorDiv, text) {
      editorDiv.focus();
      try {
        const inserted = document.execCommand("insertText", false, text);
        if (debug)
          console.log("[ChatGPTToolkit][chatgpt] execCommand insertText", { text, inserted });
        return inserted;
      } catch {
        if (debug)
          console.log("[ChatGPTToolkit][chatgpt] execCommand insertText failed", { text });
        return false;
      }
    }
    async function typePromptCommand(editorDiv, text, delayMs) {
      if (window.location.href.startsWith("https://chatgpt.com/images")) {
        if (debug) {
          console.log("[ChatGPTToolkit][chatgpt] skip typing prompt command on images page", { text });
        }
        return;
      }
      editorDiv.focus();
      placeCaretAtEnd(editorDiv);
      if (debug) {
        console.log("[ChatGPTToolkit][chatgpt] typing command", { text, delayMs });
      }
      for (let i = 0;i < text.length; i += 1) {
        const char = text[i];
        dispatchKeyEvent(editorDiv, "keydown", char);
        dispatchKeyEvent(editorDiv, "keypress", char);
        const inserted = insertTextAtCursor(editorDiv, char);
        if (!inserted) {
          if (editorDiv instanceof HTMLTextAreaElement) {
            editorDiv.value += char;
          } else {
            editorDiv.textContent = (editorDiv.textContent || "") + char;
          }
          editorDiv.dispatchEvent(new Event("input", { bubbles: true }));
        }
        dispatchInputEvent(editorDiv, char);
        dispatchKeyEvent(editorDiv, "keyup", char);
        logEditorState(editorDiv, `after char ${i + 1}`);
        await ctx.delay(delayMs);
      }
      if (debug)
        console.log("[ChatGPTToolkit][chatgpt] typing command complete");
    }
    function pressTabKey(editorDiv) {
      const eventInit = {
        key: "Tab",
        code: "Tab",
        keyCode: 9,
        which: 9,
        bubbles: true,
        cancelable: true
      };
      const downDispatched = editorDiv.dispatchEvent(new KeyboardEvent("keydown", eventInit));
      const upDispatched = editorDiv.dispatchEvent(new KeyboardEvent("keyup", eventInit));
      if (debug) {
        console.log("[ChatGPTToolkit][chatgpt] tab key dispatched", {
          downDispatched,
          upDispatched
        });
      }
    }
    async function selectImageTool(editorDiv) {
      if (debug)
        console.log("[ChatGPTToolkit][chatgpt] selectImageTool start");
      logEditorState(editorDiv, "before selectImageTool");
      setChatGPTPromptEditor(editorDiv, "");
      logEditorState(editorDiv, "after clear");
      placeCaretAtEnd(editorDiv);
      await typePromptCommand(editorDiv, "/image", 60);
      logEditorState(editorDiv, "after typing /image");
      pressTabKey(editorDiv);
      if (debug)
        console.log("[ChatGPTToolkit][chatgpt] waiting after tab");
      await ctx.delay(500);
      logEditorState(editorDiv, "after tab wait");
    }
    const AutoFillFromURI = async (textarea) => {
      ctx.refreshParamsFromHash();
      if (!textarea)
        return;
      if (!state.prompt && !state.tool)
        return;
      if (debug) {
        console.log("[ChatGPTToolkit][chatgpt] AutoFillFromURI start", {
          tool: state.tool,
          promptLength: state.prompt.length
        });
      }
      if (state.tool === "image") {
        await selectImageTool(textarea);
      }
      if (state.prompt) {
        logEditorState(textarea, "before prompt fill");
        setChatGPTPromptEditor(textarea, state.prompt);
        logEditorState(textarea, "after prompt fill");
      }
      history.replaceState({}, document.title, window.location.pathname + window.location.search);
      if (debug)
        console.log("[ChatGPTToolkit][chatgpt] AutoFillFromURI done");
    };
    const StartMonitoringResponse = async () => {
      const localeDefaultFollowUps = getLocaleDefaultFollowUpPrompts(chrome.i18n?.getUILanguage());
      let followUpPrompts = localeDefaultFollowUps;
      let initialPrompts = [];
      const customPrompts = await loadCustomPrompts();
      if (Array.isArray(customPrompts)) {
        followUpPrompts = selectReadyPrompts(customPrompts, false);
        initialPrompts = selectReadyPrompts(customPrompts, true);
      }
      let renderedInitialSignature = "";
      let renderedFollowUpSignature = "";
      let followUpAnchor = null;
      let shiftedInitialHeading = null;
      function setInitialButtonsHeadingShift(headingTarget) {
        if (shiftedInitialHeading && shiftedInitialHeading !== headingTarget) {
          shiftedInitialHeading.style.removeProperty("transform");
          shiftedInitialHeading.removeAttribute(HEADING_SHIFT_ATTR);
        }
        shiftedInitialHeading = headingTarget;
        if (!headingTarget)
          return;
        const transform = `translateY(-${HEADING_SHIFT_PX}px)`;
        if (headingTarget.style.getPropertyValue("transform") !== transform) {
          headingTarget.style.setProperty("transform", transform);
        }
        if (headingTarget.getAttribute(HEADING_SHIFT_ATTR) !== "true") {
          headingTarget.setAttribute(HEADING_SHIFT_ATTR, "true");
        }
      }
      function findHeadingCandidates(scope, selector, anchor, bar) {
        const anchorRect = anchor.getBoundingClientRect();
        const pageCenter = window.innerWidth / 2;
        return Array.from(scope.querySelectorAll(selector)).filter((item) => {
          if (item === bar || item.contains(bar) || bar.contains(item))
            return false;
          if (anchor.contains(item) || item.contains(anchor))
            return false;
          const text = (item.textContent || "").replace(/\s+/g, " ").trim();
          if (text.length < 2 || text.length > 80)
            return false;
          const rect = item.getBoundingClientRect();
          if (rect.bottom > anchorRect.top)
            return false;
          if (rect.top < 80)
            return false;
          if (!isElementVisible(item))
            return false;
          const fontSize = Number.parseFloat(window.getComputedStyle(item).fontSize || "0");
          return Number.isFinite(fontSize) && fontSize >= 20;
        }).map((item) => {
          const rect = item.getBoundingClientRect();
          return {
            item,
            centerDistance: Math.abs(rect.left + rect.width / 2 - pageCenter),
            verticalDistance: anchorRect.top - rect.bottom,
            area: rect.width * rect.height
          };
        }).sort((a, b) => {
          if (Math.abs(a.verticalDistance - b.verticalDistance) > 8) {
            return a.verticalDistance - b.verticalDistance;
          }
          if (Math.abs(a.centerDistance - b.centerDistance) > 8) {
            return a.centerDistance - b.centerDistance;
          }
          return b.area - a.area;
        });
      }
      function getInitialButtonsHeadingTarget(anchor, bar) {
        let scope = anchor.parentElement;
        while (scope && scope !== document.body && !scope.querySelector("h1, h2")) {
          scope = scope.parentElement;
        }
        const root = scope || document;
        const headings = findHeadingCandidates(root, "h1, h2", anchor, bar);
        if (headings.length === 0) {
          return findHeadingCandidates(root, "h1, h2, div, span", anchor, bar)[0]?.item || null;
        }
        const heading = headings[0].item;
        const wrapped = findHeadingCandidates(root, "div", anchor, bar).find((candidate) => candidate.item.contains(heading) && candidate.verticalDistance <= headings[0].verticalDistance + 8);
        return wrapped?.item || heading;
      }
      function removeInitialButtons() {
        document.getElementById(INITIAL_BAR_ID)?.remove();
        renderedInitialSignature = "";
        setInitialButtonsHeadingShift(null);
      }
      function rebuildInitialButtons() {
        if (!isInitialButtonsAllowedPage() || initialPrompts.length === 0 || hasConversationMessages() || isGenerating()) {
          removeInitialButtons();
          return;
        }
        const editor = getPromptEditor();
        const form = getComposerForm() || editor?.closest("form") || null;
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
            bar = document.createElement("div");
            bar.id = INITIAL_BAR_ID;
          }
          bar.replaceChildren(...initialPrompts.map((item) => createPromptButton(item, "initial")));
          if (window.getComputedStyle(form).position === "static") {
            form.style.setProperty("position", "relative");
          }
          if (bar.parentElement !== form)
            form.appendChild(bar);
          renderedInitialSignature = signature;
        }
        if (!isUpToDate || !shiftedInitialHeading?.isConnected) {
          setInitialButtonsHeadingShift(getInitialButtonsHeadingTarget(form, bar));
        }
      }
      function getLegacyAssistantBlocks() {
        for (const selector of [
          'article[data-testid^="conversation-turn-"][data-turn="assistant"]',
          'article[data-turn="assistant"]',
          'div[data-message-author-role="assistant"]'
        ]) {
          const blocks = Array.from(document.querySelectorAll(selector));
          if (blocks.length > 0)
            return blocks;
        }
        return [];
      }
      function findActionBarColumn(unit, boundary) {
        let column = null;
        let current = unit;
        for (let depth = 0;depth < 12 && current.parentElement && current !== boundary; depth += 1) {
          const parent = current.parentElement;
          for (let sibling = current.nextElementSibling;sibling; sibling = sibling.nextElementSibling) {
            if (sibling.id !== FOLLOW_UP_AREA_ID && sibling.querySelector("button")) {
              column = parent;
              break;
            }
          }
          current = parent;
        }
        return column;
      }
      function getFollowUpMount() {
        const units = document.querySelectorAll(ASSISTANT_UNIT_SELECTOR);
        if (units.length > 0) {
          const unit = units[units.length - 1];
          const column = findActionBarColumn(unit, unit.closest("[data-turn-key]"));
          if (!column)
            return null;
          return { anchor: unit, mount: (area) => column.appendChild(area) };
        }
        const blocks = getLegacyAssistantBlocks();
        const lastBlock = blocks[blocks.length - 1];
        if (!lastBlock)
          return null;
        return {
          anchor: lastBlock,
          mount: (area) => {
            area.classList.add("chatgpttoolkit-legacy-area", "md:max-w-2xl", "lg:max-w-2xl", "xl:max-w-3xl");
            lastBlock.after(area);
          }
        };
      }
      function removeFollowUpButtons() {
        document.querySelectorAll(`#${FOLLOW_UP_AREA_ID}`).forEach((item) => item.remove());
        followUpAnchor = null;
        renderedFollowUpSignature = "";
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
        const area = document.createElement("div");
        area.id = FOLLOW_UP_AREA_ID;
        area.className = "custom-buttons-area";
        area.append(...followUpPrompts.map((item) => createPromptButton(item, "follow-up")));
        target.mount(area);
        followUpAnchor = target.anchor;
        renderedFollowUpSignature = signature;
        addMarkmapButtons();
      }
      let rebuildTimer;
      const observer = new MutationObserver(() => {
        if (location.pathname.startsWith("/gpts/editor"))
          return;
        scheduleRebuild();
      });
      function observe() {
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["aria-label", "hidden"]
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
      function scheduleRebuild() {
        if (rebuildTimer !== undefined)
          return;
        rebuildTimer = setTimeout(() => {
          rebuildTimer = undefined;
          rebuildAll();
        }, REBUILD_THROTTLE_MS);
      }
      if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
          if (areaName !== "local")
            return;
          const change = changes?.[CUSTOM_PROMPTS_KEY];
          if (!change)
            return;
          const nextPrompts = Array.isArray(change.newValue) ? change.newValue : null;
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
      StartMonitoringResponse();
    }, 1000);
    function maybePasteImageIntoChatGPT() {
      const textarea = getPromptEditor();
      if (!textarea)
        return Promise.resolve();
      state.pastingImage = true;
      if (debug)
        console.log("[ChatGPTToolkit][chatgpt] pasting clipboard image");
      return ctx.delay(300).then(() => ctx.fetchClipboardImageAndSimulatePaste(textarea)).then(() => {
        if (debug)
          console.log("[ChatGPTToolkit][chatgpt] clipboard image pasted");
        state.pasteImage = false;
        state.pastingImage = false;
      });
    }
    function maybeAutoSubmitChatGPT() {
      const sendButton = getSendButton();
      if (!isSendButtonEnabled(sendButton))
        return;
      if (debug)
        console.log("[ChatGPTToolkit][chatgpt] auto submit from URL");
      sendButton.click();
      state.autoSubmit = false;
    }
    function startUrlAutomationLoop() {
      if (!state.autoSubmit && !state.pasteImage)
        return;
      const startedAt = Date.now();
      const timer = setInterval(() => {
        if (!state.autoSubmit && !state.pasteImage || Date.now() - startedAt > 60000) {
          clearInterval(timer);
          return;
        }
        if (state.pastingImage)
          return;
        if (state.pasteImage) {
          maybePasteImageIntoChatGPT();
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
      if (debug)
        console.log("[ChatGPTToolkit][chatgpt] autoSubmitWhenReady start");
      ctx.startRetryInterval({
        intervalMs: 80,
        retries: 25,
        tick: () => {
          const sendButton = getSendButton();
          if (debug) {
            console.log("[ChatGPTToolkit][chatgpt] autoSubmitWhenReady tick", {
              hasSendButton: Boolean(sendButton),
              enabled: isSendButtonEnabled(sendButton)
            });
          }
          if (!isSendButtonEnabled(sendButton))
            return false;
          if (debug)
            console.log("[ChatGPTToolkit][chatgpt] autoSubmitWhenReady click send");
          sendButton.click();
          return true;
        }
      });
    }
    function normalizeEditorText(text) {
      return text.replace(/\s+/g, " ").trim();
    }
    let promptFillRunId = 0;
    function fillPrompt(prompt, autoSubmit = true) {
      const runId = ++promptFillRunId;
      const expected = normalizeEditorText(prompt);
      let autoSubmitScheduled = false;
      if (debug) {
        console.log("[ChatGPTToolkit][chatgpt] fillPrompt start", {
          runId,
          autoSubmit,
          promptLength: prompt.length,
          expectedLength: expected.length
        });
      }
      ctx.startRetryInterval({
        intervalMs: 80,
        retries: 15,
        tick: () => {
          if (runId !== promptFillRunId)
            return true;
          const div = getPromptEditor();
          if (debug && !div) {
            console.log("[ChatGPTToolkit][chatgpt] fillPrompt tick: textarea missing", { runId });
          }
          if (!div)
            return false;
          const current = normalizeEditorText(extractPromptEditorText(div));
          const hasPrompt = expected.length > 0 ? current.includes(expected) : current.length > 0;
          if (debug) {
            console.log("[ChatGPTToolkit][chatgpt] fillPrompt tick", {
              runId,
              currentLength: current.length,
              expectedLength: expected.length,
              hasPrompt
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
            console.log("[ChatGPTToolkit][chatgpt] fillPrompt wrote prompt", {
              runId,
              promptLength: prompt.length
            });
          }
          return false;
        }
      });
    }
    function findEditMessageButton(userMessage) {
      const buttons = Array.from(userMessage.querySelectorAll("button"));
      const labelled = buttons.find((button) => EDIT_LABEL_PATTERN.test(button.getAttribute("aria-label") || button.title || ""));
      if (labelled)
        return labelled;
      return userMessage.matches('div[data-message-author-role="user"]') ? buttons[0] || null : null;
    }
    function focusMessageEditor(scope) {
      ctx.startRetryInterval({
        intervalMs: 50,
        retries: 20,
        tick: () => {
          const editor = Array.from(scope.querySelectorAll('textarea, [contenteditable="true"]')).find((el) => isElementVisible(el));
          if (!editor)
            return false;
          editor.focus();
          placeCaretAtEnd(editor);
          return true;
        }
      });
    }
    document.body.addEventListener("dblclick", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement))
        return;
      if (target.closest('input, textarea, [contenteditable="true"], button, a'))
        return;
      const userMessage = target.closest(USER_MESSAGE_SELECTOR);
      if (!userMessage)
        return;
      const editButton = findEditMessageButton(userMessage);
      if (!editButton)
        return;
      editButton.click();
      focusMessageEditor(userMessage.closest("[data-turn-key]") || userMessage);
    });
    function addMarkmapButtons() {
      document.querySelectorAll(`[data-markdown-copy="code-block"]:not([${MARKMAP_SCANNED_ATTR}])`).forEach((block) => {
        block.setAttribute(MARKMAP_SCANNED_ATTR, "");
        const header = block.querySelector(':scope > [data-markdown-copy="exclude"]');
        const codeEl = block.querySelector("code");
        const content = codeEl?.parentElement;
        if (!header || !codeEl || !content || content === block || header.contains(content))
          return;
        const isMarkdown = Array.from(header.children).some((el) => /^(markdown|md)$/i.test((el.textContent || "").trim()));
        if (!isMarkdown)
          return;
        const actions = header.querySelector("button")?.closest("span")?.parentElement || header;
        attachMarkmapToggle({ actions, content, codeEl, scrollTarget: block });
      });
      getLegacyMarkdownLabels().forEach((mdLabel) => {
        const codeBlock = mdLabel.nextElementSibling?.nextElementSibling;
        if (!(codeBlock instanceof HTMLElement))
          return;
        const codeEl = codeBlock.querySelector("code");
        const actions = mdLabel.nextElementSibling?.querySelector("button")?.parentElement?.parentElement;
        if (!codeEl || !actions)
          return;
        attachMarkmapToggle({ actions, content: codeBlock, codeEl, scrollTarget: mdLabel });
      });
    }
    function getLegacyMarkdownLabels() {
      const labels = [];
      document.querySelectorAll('article[data-turn="assistant"], div[data-message-author-role="assistant"]').forEach((block) => {
        block.querySelectorAll("div").forEach((div) => {
          if (div.childElementCount === 0 && (div.textContent || "").trim().toLowerCase() === "markdown") {
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
      scrollTarget
    }) {
      if (actions.querySelector('button[aria-label="Mindmap"]'))
        return;
      ensureButtonStyles();
      const mindmapBtn = document.createElement("button");
      mindmapBtn.type = "button";
      mindmapBtn.className = "chatgpttoolkit-markmap-btn";
      mindmapBtn.setAttribute("aria-label", "Mindmap");
      mindmapBtn.setAttribute("aria-pressed", "false");
      mindmapBtn.innerHTML = MINDMAP_ICON_SVG;
      const label = document.createElement("span");
      label.textContent = chrome?.i18n?.getMessage?.("content_mindmap_button") || "心智圖";
      mindmapBtn.appendChild(label);
      actions.prepend(mindmapBtn);
      let mm = null;
      let wrapper = null;
      const onFullscreenChange = () => {
        setTimeout(() => {
          scrollTarget.scrollIntoView({ behavior: "smooth", block: "start" });
          mm?.fit();
        }, 60);
      };
      const close = () => {
        mm?.destroy();
        mm = null;
        wrapper?.remove();
        wrapper = null;
        content.style.removeProperty("display");
        document.removeEventListener("fullscreenchange", onFullscreenChange);
        mindmapBtn.setAttribute("aria-pressed", "false");
      };
      mindmapBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        scrollTarget.scrollIntoView({ behavior: "smooth", block: "start" });
        if (wrapper) {
          close();
          return;
        }
        const markmap = window.markmap;
        if (!markmap)
          return;
        const viewportHeight = document.documentElement.clientHeight;
        const height = Math.max(240, Math.min(viewportHeight * 3 / 5, content.clientHeight || viewportHeight));
        const width = content.clientWidth || scrollTarget.clientWidth;
        const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgEl.style.width = `${width}px`;
        svgEl.style.height = `${Math.round(height / 10) * 10}px`;
        svgEl.addEventListener("dblclick", async () => {
          try {
            if (svgEl.requestFullscreen) {
              await svgEl.requestFullscreen();
            } else if (svgEl.webkitRequestFullscreen) {
              await svgEl.webkitRequestFullscreen();
            }
          } catch (error) {
            if (debug)
              console.error("[ChatGPTToolkit][chatgpt] fullscreen failed", error);
          }
        });
        wrapper = document.createElement("div");
        wrapper.className = "chatgpttoolkit-markmap";
        wrapper.appendChild(svgEl);
        content.style.setProperty("display", "none");
        content.after(wrapper);
        document.documentElement.classList.toggle("markmap-dark", isDarkTheme());
        const { root } = new markmap.Transformer().transform(codeEl.textContent || "");
        mm = markmap.Markmap.create(svgEl, markmap.deriveOptions({ autoFit: true, duration: 300 }), root);
        document.addEventListener("fullscreenchange", onFullscreenChange);
        mindmapBtn.setAttribute("aria-pressed", "true");
      });
    }
  }

  // src/content/index.ts
  function runContentScript() {
    const ctx = createContentContext();
    if (!ctx)
      return;
    if (initGemini(ctx))
      return;
    if (initClaude(ctx))
      return;
    if (initPhind(ctx))
      return;
    if (initPerplexity(ctx))
      return;
    if (initGroq(ctx))
      return;
    initChatGPT(ctx);
  }
  runContentScript();
})();

//# debugId=BEAD9039910AF1B764756E2164756E21
