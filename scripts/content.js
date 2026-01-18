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
      textarea.value = text;
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
              console.log("觸發貼上事件", pasteEvent);
              targetElement.dispatchEvent(pasteEvent);
              console.log("模擬貼上圖片成功");
              return true;
            }
          }
        }
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

  // src/content/sites/gemini.ts
  function initGemini(ctx) {
    if (location.hostname !== "gemini.google.com")
      return false;
    ctx.refreshParamsFromHash();
    const { state, debug } = ctx;
    if (!state.prompt && !state.tool)
      return true;
    let toolImageClicked = false;
    let promptFilled = false;
    let pastingGeminiImage = false;
    let geminiImagePasteAttempted = false;
    let submitted = false;
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
      retries: 30,
      tick: async () => {
        tryClickImageToolButton();
        const textarea = document.querySelector("chat-window .textarea");
        if (textarea && state.prompt && !promptFilled) {
          ctx.fillContentEditableWithParagraphs(textarea, state.prompt);
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
        const button = document.querySelector("chat-window button.send-button");
        const canSubmit = button && !button.disabled && promptFilled && state.autoSubmit && !submitted && !pastingGeminiImage && (!state.pasteImage || geminiImagePasteAttempted) && (state.tool !== "image" || toolImageClicked);
        if (canSubmit) {
          submitted = true;
          button.focus();
          setTimeout(() => {
            button.click();
          }, 500);
        }
        const done = (!state.prompt || promptFilled) && (!state.pasteImage || geminiImagePasteAttempted) && (!state.autoSubmit || submitted) && (state.tool !== "image" || toolImageClicked);
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
  function initChatGPT(ctx) {
    const { state, debug } = ctx;
    function setChatGPTPromptEditor(editorDiv, promptText) {
      if (!editorDiv)
        return;
      editorDiv.innerHTML = "<p>" + promptText + "</p>";
      editorDiv.dispatchEvent(new Event("input", { bubbles: true }));
      editorDiv.focus();
    }
    const AutoFillFromURI = async (textarea) => {
      ctx.refreshParamsFromHash();
      if (state.prompt && textarea) {
        setChatGPTPromptEditor(textarea, state.prompt);
        history.replaceState({}, document.title, window.location.pathname + window.location.search);
      }
    };
    const CUSTOM_PROMPTS_KEY = "chatgpttoolkit.customPrompts";
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
    function ensurePromptExists(prompts, promptToEnsure) {
      if (!Array.isArray(prompts))
        return { prompts, changed: false };
      if (!promptToEnsure || !promptToEnsure.title)
        return { prompts, changed: false };
      const title = String(promptToEnsure.title).trim();
      const exists = prompts.some((p) => {
        if (!p)
          return false;
        const isInitial = Object.prototype.hasOwnProperty.call(p, "initial") ? p.initial === true : false;
        return isInitial === true && String(p.title || "").trim() === title;
      });
      if (exists)
        return { prompts, changed: false };
      return { prompts: [...prompts, { ...promptToEnsure }], changed: true };
    }
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
    function chromeStorageGet(key) {
      try {
        if (!chrome?.storage?.local)
          return Promise.resolve(undefined);
        return new Promise((resolve) => chrome.storage.local.get([key], (result) => resolve(result?.[key])));
      } catch {
        return Promise.resolve(undefined);
      }
    }
    function chromeStorageSet(key, value) {
      try {
        if (!chrome?.storage?.local)
          return Promise.resolve(false);
        return new Promise((resolve) => chrome.storage.local.set({ [key]: value }, () => resolve(true)));
      } catch {
        return Promise.resolve(false);
      }
    }
    async function loadCustomPromptsFromExtensionStorageWithMigration() {
      const stored = await chromeStorageGet(CUSTOM_PROMPTS_KEY);
      if (Array.isArray(stored)) {
        const migrated = ensurePromptExists(stored, getDefaultReviewPrompt());
        if (migrated.changed)
          await chromeStorageSet(CUSTOM_PROMPTS_KEY, migrated.prompts);
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
    const StartMonitoringResponse = async () => {
      let defaultManualSubmitText = [];
      let localeDefaultManualSubmitText = [];
      let initialManualSubmitText = [];
      let lastBlock;
      const currentLocale = chrome.i18n?.getUILanguage();
      if (currentLocale) {
        if (currentLocale === "zh-TW") {
          defaultManualSubmitText.push({ title: "舉例說明", prompt: "請舉例說明" });
          defaultManualSubmitText.push({ title: "提供細節", prompt: "請提供更多細節說明" });
          defaultManualSubmitText.push({
            title: "翻譯成繁中",
            prompt: "請將上述回應內容翻譯成臺灣常用的正體中文"
          });
          defaultManualSubmitText.push({
            title: "翻譯成英文",
            prompt: "Please translate the above response into English."
          });
        } else if (currentLocale === "ja") {
          defaultManualSubmitText.push({ title: "例えば", prompt: "例を挙げて説明して" });
          defaultManualSubmitText.push({ title: "詳細説明", prompt: "もっと詳細に説明して" });
          defaultManualSubmitText.push({
            title: "日本語に翻訳",
            prompt: "上述の返答内容を日本語に翻訳して"
          });
          defaultManualSubmitText.push({
            title: "英語に翻訳",
            prompt: "Please translate the above response into English."
          });
        } else {
          defaultManualSubmitText.push({
            title: "More Examples",
            prompt: "Could you please provide me with more examples?"
          });
          defaultManualSubmitText.push({
            title: "More Details",
            prompt: "Could you please provide me with more details?"
          });
          defaultManualSubmitText.push({
            title: "Translate to English",
            prompt: "Please translate the above response into English."
          });
        }
      }
      localeDefaultManualSubmitText = [...defaultManualSubmitText];
      function buildFollowUpButtonsFromPrompts(prompts) {
        const results = [];
        (prompts || []).forEach((item) => {
          const hasEnabled = Object.prototype.hasOwnProperty.call(item, "enabled");
          const isItemEnabled = !hasEnabled || item.enabled === true;
          const isItemInitial = Object.prototype.hasOwnProperty.call(item, "initial") ? item.initial === true : false;
          if (isItemEnabled && !isItemInitial && !!item.title && !!item.prompt) {
            results.push(item);
          }
        });
        return results;
      }
      const customPrompts = await loadCustomPromptsFromExtensionStorageWithMigration();
      if (Array.isArray(customPrompts)) {
        defaultManualSubmitText = buildFollowUpButtonsFromPrompts(customPrompts);
        initialManualSubmitText = buildInitialButtonsFromPrompts(customPrompts);
      }
      let mutationObserverTimer;
      const obs = new MutationObserver(() => {
        if (location.pathname.startsWith("/gpts/editor")) {
          return;
        }
        clearTimeout(mutationObserverTimer);
        mutationObserverTimer = setTimeout(() => {
          stop();
          rebuild_initial_buttons();
          rebuild_buttons();
          const autoContinue = localStorage.getItem("chatgpttoolkit.featureToggle.autoContinue");
          if (autoContinue) {
            const btnContinue = Array.from(document.querySelectorAll("button")).filter((e) => e.innerText.trim() === "繼續生成" || e.innerText.trim() === "Continue generating" || e.innerText.trim() === "生成を続ける");
            if (btnContinue.length > 0) {
              btnContinue[0].click();
            }
          }
          start();
        }, 0);
      });
      function buildInitialButtonsFromPrompts(prompts) {
        const results = [];
        (prompts || []).forEach((item) => {
          const hasEnabled = Object.prototype.hasOwnProperty.call(item, "enabled");
          const isItemEnabled = !hasEnabled || item.enabled === true;
          const isItemInitial = Object.prototype.hasOwnProperty.call(item, "initial") ? item.initial === true : false;
          if (isItemEnabled && isItemInitial && !!item.title && !!item.prompt) {
            results.push(item);
          }
        });
        return results;
      }
      function rebuild_initial_buttons() {
        const existing = document.getElementById("custom-chatgpt-initial-buttons");
        const stopButton = document.querySelector('button[data-testid="stop-button"]');
        if (stopButton) {
          existing?.remove();
          return;
        }
        const promptTextarea = document.getElementById("prompt-textarea");
        if (!promptTextarea) {
          existing?.remove();
          return;
        }
        const hasAnyMessages = Boolean(document.querySelector('div[data-message-author-role="assistant"], div[data-message-author-role="user"]'));
        if (hasAnyMessages || !Array.isArray(initialManualSubmitText) || initialManualSubmitText.length === 0) {
          existing?.remove();
          return;
        }
        const form = promptTextarea.closest('form[data-type="unified-composer"]') || promptTextarea.closest("form");
        if (!form) {
          existing?.remove();
          return;
        }
        const composerGrid = form.querySelector('div[class*="bg-token-bg-primary"][class*="grid-template-areas"]') || form.querySelector('div[class*="grid-template-areas"]');
        if (!composerGrid) {
          existing?.remove();
          return;
        }
        let headerCandidates = [];
        try {
          headerCandidates = Array.from(composerGrid.querySelectorAll(':scope > div[class*="[grid-area:header]"], :scope > div[style*="grid-area: header"]'));
        } catch {
          headerCandidates = Array.from(composerGrid.querySelectorAll('div[class*="[grid-area:header]"], div[style*="grid-area: header"]'));
        }
        const headerContainer = headerCandidates.find((el) => el.id !== "custom-chatgpt-initial-buttons") || null;
        let bar = document.getElementById("custom-chatgpt-initial-buttons");
        if (!bar) {
          bar = document.createElement("div");
          bar.id = "custom-chatgpt-initial-buttons";
        } else {
          bar.innerHTML = "";
        }
        const barEl = bar;
        barEl.style.display = "flex";
        barEl.style.flexWrap = "wrap";
        barEl.style.gap = "0.5rem";
        barEl.style.alignItems = "flex-start";
        barEl.style.alignContent = "flex-start";
        barEl.style.padding = "0.25rem 0.75rem 0.5rem 0.75rem";
        barEl.style.pointerEvents = "auto";
        if (headerContainer && headerContainer !== barEl) {
          if (barEl.parentElement !== headerContainer)
            headerContainer.append(barEl);
          barEl.style.gridArea = "";
        } else {
          if (barEl.parentElement !== composerGrid)
            composerGrid.prepend(barEl);
          barEl.style.gridArea = "header";
        }
        try {
          const baseEl = barEl.parentElement || composerGrid;
          const baseRect = baseEl.getBoundingClientRect();
          const promptRect = promptTextarea.getBoundingClientRect();
          const left = Math.max(0, Math.round(promptRect.left - baseRect.left));
          if (Number.isFinite(left) && left > 0) {
            barEl.style.paddingLeft = `${left}px`;
            barEl.style.paddingRight = "0.75rem";
          }
        } catch {}
        initialManualSubmitText.forEach((item) => {
          const autoPasteEnabled = item.autoPaste === true;
          const autoSubmitEnabled = item.autoSubmit === true;
          const btn = document.createElement("button");
          btn.type = "button";
          btn.style.display = "inline-flex";
          btn.style.alignItems = "center";
          btn.style.justifyContent = "center";
          btn.style.alignSelf = "flex-start";
          btn.style.flex = "0 0 auto";
          btn.style.border = "1px solid #d1d5db";
          btn.style.borderRadius = "999px";
          btn.style.padding = "0.25rem 0.6rem";
          btn.style.margin = "0";
          btn.style.fontSize = "0.85rem";
          btn.style.background = "transparent";
          btn.style.cursor = "pointer";
          btn.style.lineHeight = "1.2";
          btn.style.whiteSpace = "nowrap";
          btn.textContent = item.title;
          btn.addEventListener("click", () => {
            if (autoPasteEnabled) {
              navigator.clipboard.readText().then((text) => {
                text = text.trim();
                if (!!text) {
                  fillPrompt(item.prompt + text, true);
                } else {
                  fillPrompt(item.prompt, autoSubmitEnabled);
                }
              });
            } else {
              fillPrompt(item.prompt, autoSubmitEnabled);
            }
          });
          barEl.append(btn);
        });
      }
      function rebuild_buttons() {
        const talkBlocks = Array.from(document.querySelectorAll('div[data-message-author-role="assistant"]'));
        let buttonsAreas = document.querySelectorAll("#custom-chatgpt-magic-box-buttons");
        const stopButton = document.querySelector('button[data-testid="stop-button"]');
        if (stopButton) {
          buttonsAreas?.forEach((item) => {
            item.remove();
          });
          return;
        }
        const promptTextarea = document.getElementById("prompt-textarea");
        if (!promptTextarea) {
          buttonsAreas?.forEach((item) => {
            item.remove();
          });
          return;
        }
        if (lastBlock !== talkBlocks[talkBlocks.length - 1]) {
          buttonsAreas?.forEach((item) => {
            item.remove();
          });
        }
        buttonsAreas = document.querySelectorAll("#custom-chatgpt-magic-box-buttons");
        if (buttonsAreas.length > 0) {
          return;
        }
        if (!talkBlocks || talkBlocks.length === 0) {
          buttonsAreas?.forEach((item) => {
            item.remove();
          });
          return;
        }
        const buttonsArea = document.createElement("div");
        buttonsArea.id = "custom-chatgpt-magic-box-buttons";
        buttonsArea.classList.value = "custom-buttons-area text-base m-auto md:max-w-2xl lg:max-w-2xl xl:max-w-3xl p-4 md:py-6 flex lg:px-0";
        buttonsArea.style.overflowY = "auto";
        buttonsArea.style.display = "flex";
        buttonsArea.style.flexWrap = "wrap";
        buttonsArea.style.paddingTop = "0.75rem";
        buttonsArea.style.paddingLeft = "calc(30px + 0.75rem)";
        defaultManualSubmitText.forEach((item) => {
          const autoPasteEnabled = item.autoPaste === true;
          const autoSubmitEnabled = item.autoSubmit === true;
          const customButton = document.createElement("button");
          customButton.style.border = "1px solid #d1d5db";
          customButton.style.borderRadius = "5px";
          customButton.style.padding = "0.5rem 1rem";
          customButton.style.margin = "0.5rem";
          customButton.title = String(item.altText);
          customButton.innerText = item.title;
          customButton.addEventListener("click", () => {
            if (autoPasteEnabled) {
              navigator.clipboard.readText().then((text) => {
                text = text.trim();
                if (!!text) {
                  fillPrompt(item.prompt + text, true);
                } else {
                  fillPrompt(item.prompt, autoSubmitEnabled);
                }
              });
            } else {
              fillPrompt(item.prompt, autoSubmitEnabled);
            }
          });
          buttonsArea.append(customButton);
        });
        if (talkBlocks.length > 0) {
          lastBlock = talkBlocks[talkBlocks.length - 1];
          lastBlock.after(buttonsArea);
        }
        const mdLabels = Array.from(document.querySelectorAll("div")).filter((el) => (el.textContent || "").trim().toLowerCase() === "markdown");
        mdLabels.forEach((mdLabel) => {
          add_markmap_button(mdLabel);
        });
      }
      const start = () => {
        obs.observe(document.body, {
          childList: true,
          attributes: true,
          subtree: true
        });
      };
      const stop = () => {
        obs.disconnect();
      };
      if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
          if (areaName !== "local")
            return;
          const change = changes?.[CUSTOM_PROMPTS_KEY];
          if (!change)
            return;
          const nextFollowUp = Array.isArray(change.newValue) ? buildFollowUpButtonsFromPrompts(change.newValue) : [...localeDefaultManualSubmitText];
          const nextInitial = Array.isArray(change.newValue) ? buildInitialButtonsFromPrompts(change.newValue) : [];
          defaultManualSubmitText = nextFollowUp;
          initialManualSubmitText = nextInitial;
          document.querySelectorAll("#custom-chatgpt-magic-box-buttons")?.forEach((item) => item.remove());
          document.querySelectorAll("#custom-chatgpt-initial-buttons")?.forEach((item) => item.remove());
          rebuild_initial_buttons();
          rebuild_buttons();
        });
      }
      rebuild_initial_buttons();
      rebuild_buttons();
      start();
    };
    setTimeout(() => {
      StartMonitoringResponse();
    }, 1000);
    const checkForTextareaInput = setInterval(async () => {
      const textarea = document.getElementById("prompt-textarea");
      if (textarea) {
        await AutoFillFromURI(textarea);
        clearInterval(checkForTextareaInput);
      }
    }, 60);
    async function maybePasteImageIntoChatGPT() {
      if (!state.pasteImage || state.pastingImage)
        return;
      const textarea = document.getElementById("prompt-textarea");
      if (!textarea)
        return;
      state.pastingImage = true;
      if (debug)
        console.log("貼上圖片中");
      await ctx.delay(300);
      await ctx.fetchClipboardImageAndSimulatePaste(textarea);
      if (debug)
        console.log("貼上圖片完成");
      state.pasteImage = false;
      state.pastingImage = false;
    }
    function maybeAutoSubmitChatGPT() {
      if (!state.autoSubmit || state.pasteImage)
        return;
      const sendButton = document.querySelector('button[data-testid*="send-button"]');
      if (sendButton && !sendButton.disabled) {
        if (debug)
          console.log("自動提交按鈕被點擊");
        sendButton.click();
        state.autoSubmit = false;
      }
    }
    setInterval(async () => {
      await maybePasteImageIntoChatGPT();
      maybeAutoSubmitChatGPT();
    }, 60);
    function fillPrompt(prompt, autoSubmit = true) {
      const div = document.getElementById("prompt-textarea");
      if (div) {
        setChatGPTPromptEditor(div, prompt);
        const range = document.createRange();
        const sel = window.getSelection();
        range.setStart(div, 1);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        div.focus();
        setTimeout(() => {
          const sendButton = document.querySelector('button[data-testid*="send-button"]');
          if (sendButton && autoSubmit) {
            sendButton.click();
          }
        }, 50);
      }
    }
    document.body.addEventListener("dblclick", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement))
        return;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }
      const closestDIV = target.closest('div[data-message-author-role="user"]');
      if (closestDIV) {
        const btns = Array.from(closestDIV.querySelectorAll("button"));
        if (btns.length > 0) {
          const btn = btns[0];
          btn.click();
          setTimeout(() => {
            const txt = closestDIV.querySelector("textarea");
            if (txt) {
              txt.selectionStart = txt.selectionEnd = txt.value.length;
              txt.focus();
            }
          }, 0);
        }
      }
    });
    document.body.addEventListener("keyup", (event) => {
      if (event.ctrlKey && event.key === "Enter") {
        const target = event.target;
        if (!(target instanceof HTMLTextAreaElement))
          return;
        const container = target.parentElement?.parentElement;
        const sibling = container?.nextElementSibling;
        const sendButton = sibling?.querySelector("button.btn-primary");
        if (sendButton) {
          sendButton.click();
        }
      }
    });
    function add_markmap_button(mdLabel) {
      if (!mdLabel)
        return;
      const codeBlock = mdLabel.nextElementSibling?.nextElementSibling;
      if (debug)
        console.debug("Code block found:", codeBlock);
      if (!(codeBlock instanceof HTMLElement))
        return;
      const codeEl = codeBlock.querySelector("code");
      if (debug)
        console.debug("Code element found:", codeEl);
      if (!codeEl)
        return;
      const btn = mdLabel.nextElementSibling?.querySelector("button");
      if (debug)
        console.debug("Button found:", btn);
      const containerDiv = btn?.parentElement?.parentElement;
      if (!containerDiv)
        return;
      if (containerDiv.querySelector('button[aria-label="Mindmap"]'))
        return;
      if (debug)
        console.debug("Wrapper div found:", containerDiv);
      const spanHtml = '<span class="" data-state="closed"><button class="flex gap-1 items-center select-none px-4 py-1" aria-label="Mindmap"><svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="12" viewBox="0 0 128 128" enable-background="new 0 0 128 128" xml:space="preserve"><path fill="none" stroke="#010100" stroke-width="2" opacity="1.000000" d="M76.688866,109.921104 C88.050018,115.331482 100.131790,117.192719 112.584740,117.125877 C117.595360,117.098984 120.788620,114.305405 121.104477,109.904366 C121.439659,105.234016 118.474678,101.801880 113.419678,101.228683 C111.275566,100.985550 109.030663,101.381645 106.940926,100.953491 C99.494377,99.427811 91.778465,98.498268 84.753601,95.805984 C74.877594,92.020988 69.684692,83.908684 68.234291,73.078300 C70.384644,73.078300 72.207634,73.078644 74.030617,73.078247 C86.858322,73.075493 99.686478,73.133377 112.513527,73.040070 C117.709305,73.002274 120.970772,69.862900 121.039032,65.258537 C121.107437,60.644268 117.884323,57.419498 112.785179,57.093300 C111.125771,56.987152 109.454391,57.064369 107.788483,57.064228 C94.648399,57.063137 81.508308,57.063622 68.322067,57.063622 C69.945129,45.040371 75.792297,36.744892 87.154800,33.278618 C95.306870,30.791729 104.059700,30.155739 112.593239,29.080770 C117.983620,28.401745 121.287643,25.539717 121.122673,20.684353 C120.966324,16.082565 117.653831,12.969757 112.453003,13.059167 C107.634552,13.142003 102.803261,13.490462 98.013023,14.033926 C71.598251,17.030745 56.428867,30.937811 51.926388,56.118473 C51.879574,56.380272 51.563141,56.593864 51.183678,57.063988 C40.724709,57.063988 30.076698,57.042259 19.428833,57.072033 C12.907690,57.090271 8.991345,60.245888 9.110775,65.284119 C9.227548,70.210205 12.886068,73.054855 19.251369,73.070534 C30.057989,73.097160 40.864723,73.077866 51.840267,73.077866 C53.987484,89.401680 61.400532,101.920280 76.688866,109.921104 z"/><path fill="#F5E41C" opacity="1.000000" stroke="none" d="M76.354416,109.751411 C61.400532,101.920280 53.987484,89.401680 51.840267,73.077866 C40.864723,73.077866 30.057989,73.097160 19.251369,73.070534 C12.886068,73.054855 9.227548,70.210205 9.110775,65.284119 C8.991345,60.245888 12.907690,57.090271 19.428833,57.072033 C30.076698,57.042259 40.724709,57.063988 51.183678,57.063988 C51.563141,56.593864 51.879574,56.380272 51.926388,56.118473 C56.428867,30.937811 71.598251,17.030745 98.013023,14.033926 C102.803261,13.490462 107.634552,13.142003 112.453003,13.059167 C117.653831,12.969757 120.966324,16.082565 121.122673,20.684353 C121.287643,25.539717 117.983620,28.401745 112.593239,29.080770 C104.059700,30.155739 95.306870,30.791729 87.154800,33.278618 C75.792297,36.744892 69.945129,45.040371 68.322067,57.063622 C81.508308,57.063622 94.648399,57.063137 107.788483,57.064228 C109.454391,57.064369 111.125771,56.987152 112.785179,57.093300 C117.884323,57.419498 121.107437,60.644268 121.039032,65.258537 C120.970772,69.862900 117.709305,73.002274 112.513527,73.040070 C99.686478,73.133377 86.858322,73.075493 74.030617,73.078247 C72.207634,73.078644 70.384644,73.078300 68.234291,73.078300 C69.684692,83.908684 74.877594,92.020988 84.753601,95.805984 C91.778465,98.498268 99.494377,99.427811 106.940926,100.953491 C109.030663,101.381645 111.275566,100.985550 113.419678,101.228683 C118.474678,101.801880 121.439659,105.234016 121.104477,109.904366 C120.788620,114.305405 117.595360,117.098984 112.584740,117.125877 C100.131790,117.192719 88.050018,115.331482 76.354416,109.751411 z"/></svg>心智圖</button></span>';
      containerDiv.insertAdjacentHTML("afterbegin", spanHtml);
      if (debug)
        console.debug("Inserted Mindmap button HTML into wrapperDiv:", containerDiv);
      const mindmapBtn = containerDiv.querySelector('button[aria-label="Mindmap"]');
      if (debug)
        console.debug("Mindmap button found:", mindmapBtn);
      if (!mindmapBtn)
        return;
      let isActive = false;
      mindmapBtn.addEventListener("click", () => {
        if (debug)
          console.debug("Mindmap button clicked. Current active state:", isActive);
        mdLabel.scrollIntoView({ behavior: "smooth", block: "start" });
        let mm = null;
        if (!isActive) {
          let handleFullscreenChange = function() {
            setTimeout(() => {
              mdLabel.scrollIntoView({ behavior: "smooth", block: "start" });
              mm?.fit();
            }, 60);
          };
          if (debug)
            console.debug("Creating mindmap...");
          const svgHeight = Math.min(document.documentElement.clientHeight * 3 / 5, codeBlock.clientHeight || document.documentElement.clientHeight);
          const roundedSvgHeight = Math.round(svgHeight / 10) * 10;
          codeBlock.innerHTML = `<svg style="width: ${codeBlock.clientWidth}px; height: ${roundedSvgHeight}px"></svg>`;
          const svgEl = codeBlock.querySelector("svg");
          if (!svgEl)
            return;
          svgEl.addEventListener("dblclick", async () => {
            if (debug)
              console.debug("SVG element double-clicked. Requesting fullscreen...");
            try {
              if (svgEl.requestFullscreen) {
                await svgEl.requestFullscreen();
              } else if (svgEl.webkitRequestFullscreen) {
                await svgEl.webkitRequestFullscreen();
              } else if (svgEl.msRequestFullscreen) {
                await svgEl.msRequestFullscreen();
              }
            } catch (error) {
              if (debug)
                console.error("Error attempting to enter fullscreen mode:", error);
            }
          });
          document.addEventListener("fullscreenchange", handleFullscreenChange);
          const transformer = new window.markmap.Transformer;
          const { root } = transformer.transform(codeEl.textContent);
          const jsonOptions = {
            autoFit: true,
            duration: 300
          };
          const options = window.markmap.deriveOptions(jsonOptions);
          if (document.documentElement.classList.contains("dark")) {
            document.documentElement.classList.add("markmap-dark");
          }
          mm = window.markmap.Markmap.create(svgEl, options, root);
          isActive = true;
        } else {
          if (debug)
            console.debug("Resetting code block to original content...");
          const mmHandle = mm;
          mmHandle?.destroy();
          codeBlock.innerHTML = `<code>${codeEl.textContent}</code>`;
          isActive = false;
        }
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

//# debugId=E23E1906FDB3588864756E2164756E21
