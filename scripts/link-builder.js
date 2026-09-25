// src/options/utils/i18n.ts
var getMessage = (key, substitutions) => {
  if (typeof chrome !== "undefined" && chrome.i18n?.getMessage) {
    const message = chrome.i18n.getMessage(key, substitutions);
    return message || key;
  }
  return key;
};
var getMessagesLangTag = () => {
  const lang = getMessage("options_lang_tag");
  return lang && lang !== "options_lang_tag" ? lang : "";
};
var resolveI18nArgs = (rawArgs) => {
  if (!rawArgs)
    return;
  const parts = rawArgs.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0)
    return;
  return parts.map((part) => getMessage(part));
};
function applyPageI18n() {
  const lang = getMessagesLangTag();
  if (lang)
    document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (!key)
      return;
    element.textContent = getMessage(key, resolveI18nArgs(element.dataset.i18nArgs));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const key = element.dataset.i18nPlaceholder;
    if (!key)
      return;
    element.placeholder = getMessage(key, resolveI18nArgs(element.dataset.i18nArgs));
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    const key = element.dataset.i18nAriaLabel;
    if (!key)
      return;
    const label = getMessage(key, resolveI18nArgs(element.dataset.i18nArgs));
    element.setAttribute("aria-label", label);
    if (element.classList.contains("has-tooltip"))
      element.dataset.tooltip = label;
  });
  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    const key = element.dataset.i18nTitle;
    if (!key)
      return;
    element.title = getMessage(key, resolveI18nArgs(element.dataset.i18nArgs));
  });
}

// src/options/ui/icons.ts
var SVG_NS = "http://www.w3.org/2000/svg";
var iconHref = (name) => `#icon-${name}`;
function createIcon(name, className = "icon") {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", iconHref(name));
  svg.appendChild(use);
  return svg;
}

// src/options/ui/OptionsUIController.ts
var TOAST_LIMIT = 3;
var TOAST_DURATION_MS = { success: 2800, error: 5000 };
var TOAST_EXIT_MS = 250;
function onDialogBackdropClick(dialog, handler) {
  let pressedOnBackdrop = false;
  dialog.addEventListener("pointerdown", (event) => {
    pressedOnBackdrop = event.target === dialog;
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog && pressedOnBackdrop)
      handler();
    pressedOnBackdrop = false;
  });
}

class OptionsUIController {
  toastRegion;
  confirmDialog;
  confirmMessage;
  confirmOkBtn;
  confirmCancelBtn;
  settleConfirm = null;
  constructor(toastRegionId, confirmDialogId) {
    const confirmPart = (suffix) => confirmDialogId ? document.getElementById(`${confirmDialogId}${suffix}`) : null;
    this.toastRegion = document.getElementById(toastRegionId);
    this.confirmDialog = confirmPart("");
    this.confirmMessage = confirmPart("Message");
    this.confirmOkBtn = confirmPart("OkBtn");
    this.confirmCancelBtn = confirmPart("CancelBtn");
    this.bindConfirmDialog();
    document.querySelectorAll("dialog").forEach((dialog) => {
      dialog.addEventListener("close", () => this.relocateToasts());
    });
  }
  showStatus(message, type = "success") {
    this.relocateToasts();
    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    const text = document.createElement("span");
    text.className = "toast__text";
    text.textContent = message;
    toast.append(createIcon(type === "error" ? "alert-circle" : "check-circle", "icon toast__icon"), text);
    this.toastRegion.appendChild(toast);
    while (this.toastRegion.children.length > TOAST_LIMIT) {
      this.toastRegion.firstElementChild?.remove();
    }
    window.requestAnimationFrame(() => toast.classList.add("is-visible"));
    window.setTimeout(() => {
      toast.classList.remove("is-visible");
      window.setTimeout(() => toast.remove(), TOAST_EXIT_MS);
    }, TOAST_DURATION_MS[type]);
  }
  relocateToasts() {
    const openDialogs = Array.from(document.querySelectorAll("dialog[open]"));
    const host = openDialogs[openDialogs.length - 1] ?? document.body;
    if (this.toastRegion.parentElement !== host) {
      host.appendChild(this.toastRegion);
    }
  }
  confirm(options) {
    const dialog = this.confirmDialog;
    if (!dialog || !this.confirmMessage || !this.confirmOkBtn || !this.confirmCancelBtn || typeof dialog.showModal !== "function") {
      return Promise.resolve(window.confirm(options.message));
    }
    this.settleConfirm?.(false);
    this.confirmMessage.textContent = options.message;
    this.confirmOkBtn.textContent = options.confirmLabel;
    this.confirmOkBtn.className = `btn ${options.danger ? "btn--danger" : "btn--primary"}`;
    this.confirmCancelBtn.textContent = options.cancelLabel ?? getMessage("options_modal_cancel_button");
    dialog.classList.toggle("is-danger", Boolean(options.danger));
    dialog.returnValue = "";
    return new Promise((resolve) => {
      this.settleConfirm = (confirmed) => {
        this.settleConfirm = null;
        resolve(confirmed);
      };
      if (!dialog.open)
        dialog.showModal();
      this.relocateToasts();
      this.confirmCancelBtn?.focus();
    });
  }
  bindConfirmDialog() {
    const dialog = this.confirmDialog;
    if (!dialog)
      return;
    this.confirmOkBtn?.addEventListener("click", () => dialog.close("confirm"));
    this.confirmCancelBtn?.addEventListener("click", () => dialog.close("cancel"));
    onDialogBackdropClick(dialog, () => dialog.close("cancel"));
    dialog.addEventListener("close", () => {
      this.settleConfirm?.(dialog.returnValue === "confirm");
    });
  }
}

// src/options/utils/theme.ts
var THEME_STORAGE_KEY = "chatgpttoolkit.options.theme";
var THEME_PREFERENCES = ["system", "light", "dark"];
function parseThemePreference(value) {
  if (typeof value !== "string")
    return "system";
  const normalized = value.trim().toLowerCase();
  return THEME_PREFERENCES.includes(normalized) ? normalized : "system";
}
function getThemeAttribute(preference) {
  return preference === "system" ? null : preference;
}
function readThemePreference(storage) {
  if (!storage)
    return "system";
  try {
    return parseThemePreference(storage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}
function writeThemePreference(storage, preference) {
  if (!storage)
    return false;
  try {
    if (preference === "system") {
      storage.removeItem(THEME_STORAGE_KEY);
    } else {
      storage.setItem(THEME_STORAGE_KEY, preference);
    }
    return true;
  } catch {
    return false;
  }
}
function applyThemePreference(root, preference) {
  const attribute = getThemeAttribute(preference);
  if (attribute) {
    root.dataset.theme = attribute;
  } else {
    delete root.dataset.theme;
  }
}

// src/options/utils/helpers.ts
function getLocalStorage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

// src/options/ui/ThemeSwitcher.ts
class ThemeSwitcher {
  root;
  inputs;
  constructor(root = document.documentElement, inputName = "theme") {
    this.root = root;
    this.inputs = Array.from(document.querySelectorAll(`input[type="radio"][name="${inputName}"]`));
  }
  init() {
    this.apply(readThemePreference(getLocalStorage()));
    this.inputs.forEach((input) => {
      input.addEventListener("change", () => {
        if (!input.checked)
          return;
        const preference = parseThemePreference(input.value);
        writeThemePreference(getLocalStorage(), preference);
        this.apply(preference);
      });
    });
    window.addEventListener("storage", (event) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null)
        return;
      this.apply(readThemePreference(getLocalStorage()));
    });
  }
  apply(preference) {
    applyThemePreference(this.root, preference);
    this.inputs.forEach((input) => {
      input.checked = input.value === preference;
    });
  }
}

// src/options/utils/dom.ts
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className)
    node.className = className;
  if (text !== undefined)
    node.textContent = text;
  return node;
}
function byId(id) {
  const node = document.getElementById(id);
  if (!node)
    throw new Error(`${location.pathname} is missing #${id}`);
  return node;
}
function insertTextAtCaret(field, text) {
  field.focus();
  let inserted = false;
  try {
    inserted = document.execCommand("insertText", false, text);
  } catch {
    inserted = false;
  }
  if (!inserted) {
    const { selectionStart, selectionEnd } = field;
    field.setRangeText(text, selectionStart, selectionEnd, "end");
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }
}
var isApplePlatform = () => /Mac|iPhone|iPad|iPod/i.test(navigator.platform || "");
function shortcutKeys(key, options = {}) {
  const apple = isApplePlatform();
  return [apple ? "⌘" : "Ctrl", ...options.shift ? [apple ? "⇧" : "Shift"] : [], key];
}
function shortcutText(key, options = {}) {
  return shortcutKeys(key, options).join(isApplePlatform() ? "" : "+");
}
function shortcutKbds(key, options = {}) {
  return shortcutKeys(key, options).map((label) => element("kbd", undefined, label));
}

// src/linkBuilder/sites.ts
var NO_FEATURES = { pasteImage: false, imageTool: false };
var IMAGE_FEATURES = { pasteImage: true, imageTool: true };
var SITES = [
  {
    hosts: ["chatgpt.com", "chat.openai.com"],
    site: { name: "ChatGPT", features: IMAGE_FEATURES, providerId: "chatgpt" },
    pages: [{
      path: /^\/images(\/|$)/,
      site: { name: "ChatGPT Images", features: { pasteImage: true, imageTool: false }, providerId: "chatgpt-images", generatesImages: true }
    }]
  },
  { hosts: ["gemini.google.com"], site: { name: "Gemini", features: IMAGE_FEATURES, providerId: "gemini" } },
  { hosts: ["claude.ai"], site: { name: "Claude", features: NO_FEATURES, providerId: "claude" } },
  { hosts: ["groq.com"], site: { name: "Groq", features: NO_FEATURES, providerId: "groq" } },
  { hosts: ["www.perplexity.ai"], site: { name: "Perplexity", features: NO_FEATURES, providerId: "perplexity" } },
  { hosts: ["www.phind.com"], site: { name: "Phind", features: NO_FEATURES } }
];
var SUPPORTED_HOSTS = SITES.flatMap((entry) => entry.hosts);
function getSupportedSite(url) {
  if (url.protocol !== "https:")
    return null;
  const entry = SITES.find((item) => item.hosts.includes(url.hostname));
  if (!entry)
    return null;
  return entry.pages?.find((page) => page.path.test(url.pathname))?.site ?? entry.site;
}
var PROVIDERS = [
  { id: "chatgpt", name: "ChatGPT", url: "https://chatgpt.com/", icon: "message" },
  { id: "chatgpt-images", name: "ChatGPT Images", url: "https://chatgpt.com/images/", icon: "image" },
  { id: "claude", name: "Claude", url: "https://claude.ai/", icon: "asterisk" },
  { id: "gemini", name: "Gemini", url: "https://gemini.google.com/app", icon: "sparkle" },
  { id: "groq", name: "Groq", url: "https://groq.com/", icon: "zap" },
  { id: "perplexity", name: "Perplexity", url: "https://www.perplexity.ai/", icon: "compass" }
];
function isTargetChoice(value) {
  return value === "custom" || PROVIDERS.some((provider) => provider.id === value);
}
function findProvider(id) {
  return PROVIDERS.find((provider) => provider.id === id);
}
var withoutTrailingSlash = (url) => url.replace(/\/+$/, "");
function findProviderByUrl(url) {
  const normalized = withoutTrailingSlash(url);
  return PROVIDERS.find((provider) => withoutTrailingSlash(provider.url) === normalized);
}
function normalizeCustomUrl(input) {
  const trimmed = input.trim();
  if (!trimmed)
    return { ok: false, reason: "empty" };
  let url;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const isWebUrl = (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".");
  if (!isWebUrl || url.username || url.password) {
    return { ok: false, reason: "invalid" };
  }
  url.hash = "";
  return { ok: true, url: url.href };
}

// src/linkBuilder/promptLink.ts
var LINK_OPTIONS = ["autoSubmit", "pasteImage", "imageTool"];
var SEARCH_TERMS_PLACEHOLDER = "%s";
var MIN_BASE64_LENGTH = 64;
function encodeUrlComponentStrict(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}
function encodePromptParam(prompt, codec) {
  const base64 = codec.b64EncodeUnicode(prompt);
  const readable = encodeUrlComponentStrict(prompt);
  if (base64.length >= MIN_BASE64_LENGTH)
    return encodeUrlComponentStrict(base64);
  const decodedByContentScript = codec.flexiblePromptDetection(`prompt=${readable}`, "") ?? "";
  const mistakenForBase64 = codec.isBase64Unicode(decodedByContentScript);
  const keepsExactText = decodedByContentScript !== prompt && codec.isBase64Unicode(base64);
  return mistakenForBase64 || keepsExactText ? encodeUrlComponentStrict(base64) : readable;
}
function flagParams(options) {
  const flags = [`autoSubmit=${options.autoSubmit}`];
  if (options.pasteImage)
    flags.push("pasteImage=true");
  if (options.imageTool)
    flags.push("tool=image");
  return flags;
}
function buildPromptLink(baseUrl, params, codec) {
  return `${baseUrl}#${[...flagParams(params), `prompt=${encodePromptParam(params.prompt, codec)}`].join("&")}`;
}
function hasSearchTermsPlaceholder(prompt) {
  return prompt.includes(SEARCH_TERMS_PLACEHOLDER);
}
function getSiteSearchPrompt(prompt) {
  if (hasSearchTermsPlaceholder(prompt))
    return prompt;
  const trimmed = prompt.replace(/\s+$/, "");
  return trimmed ? `${trimmed}

${SEARCH_TERMS_PLACEHOLDER}` : SEARCH_TERMS_PLACEHOLDER;
}
function buildSiteSearchUrl(baseUrl, params) {
  const prompt = encodeUrlComponentStrict(getSiteSearchPrompt(params.prompt)).replace(/%25s/g, SEARCH_TERMS_PLACEHOLDER);
  return `${baseUrl}#${[...flagParams(params), `prompt=${prompt}`].join("&")}`;
}
function buildMarkdownLink(title, url) {
  const text = title.replace(/[\\[\]]/g, "\\$&");
  const href = url.replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/ /g, "%20");
  return `[${text}](${href})`;
}

// src/linkBuilder/state.ts
var DEFAULT_STATE = {
  target: "chatgpt",
  customUrl: "",
  title: "",
  prompt: "",
  autoSubmit: true,
  pasteImage: false,
  imageTool: false
};
var LINK_BUILDER_STORAGE_KEY = "chatgpttoolkit.linkBuilder";
function parseState(value) {
  const source = value && typeof value === "object" ? value : {};
  const state = { ...DEFAULT_STATE };
  if (isTargetChoice(source.target))
    state.target = source.target;
  ["customUrl", "title", "prompt"].forEach((key) => {
    if (typeof source[key] === "string")
      state[key] = source[key];
  });
  LINK_OPTIONS.forEach((key) => {
    if (typeof source[key] === "boolean")
      state[key] = source[key];
  });
  return state;
}
function readState(storage) {
  if (!storage)
    return { ...DEFAULT_STATE };
  try {
    const raw = storage.getItem(LINK_BUILDER_STORAGE_KEY);
    return parseState(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_STATE };
  }
}
function writeState(storage, state) {
  if (!storage)
    return false;
  try {
    storage.setItem(LINK_BUILDER_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
function resolveTarget(state) {
  const provider = state.target === "custom" ? undefined : findProvider(state.target);
  if (provider)
    return { baseUrl: provider.url, problem: null, name: provider.name };
  const custom = normalizeCustomUrl(state.customUrl);
  if (!custom.ok)
    return { baseUrl: null, problem: custom.reason, name: "" };
  return { baseUrl: custom.url, problem: null, name: "" };
}
function resolveLink(state, codec) {
  const target = resolveTarget(state);
  const url = target.baseUrl ? new URL(target.baseUrl) : null;
  const site = url ? getSupportedSite(url) : null;
  const unavailable = {};
  if (url && !site) {
    LINK_OPTIONS.forEach((key) => {
      unavailable[key] = "site-unsupported";
    });
  } else if (site) {
    if (!site.features.pasteImage)
      unavailable.pasteImage = "feature-unsupported";
    if (!site.features.imageTool)
      unavailable.imageTool = site.generatesImages ? "generates-images" : "feature-unsupported";
  }
  const params = {
    prompt: state.prompt,
    autoSubmit: state.autoSubmit && !unavailable.autoSubmit,
    pasteImage: state.pasteImage && !unavailable.pasteImage,
    imageTool: state.imageTool && !unavailable.imageTool
  };
  const siteName = target.name || site?.name || url?.hostname || "";
  const icon = (findProvider(state.target) ?? findProvider(site?.providerId))?.icon ?? "globe";
  const title = state.title.trim() || siteName;
  const ready = Boolean(target.baseUrl) && (state.prompt.trim().length > 0 || params.imageTool);
  const link = ready && target.baseUrl ? buildPromptLink(target.baseUrl, params, codec) : "";
  return {
    baseUrl: target.baseUrl,
    problem: target.problem,
    site,
    siteName,
    icon,
    unavailable,
    title,
    ready,
    url: link,
    markdown: link ? buildMarkdownLink(title, link) : "",
    siteSearchUrl: target.baseUrl ? buildSiteSearchUrl(target.baseUrl, params) : "",
    siteSearchName: target.baseUrl ? title : "",
    searchTermsInPrompt: hasSearchTermsPlaceholder(state.prompt)
  };
}

// src/linkBuilder/linkImport.ts
var BUILDER_KEYS = ["aiProvider", "baseurl", "subject", "prompt", "tool", "autoSubmit", "pasteImage"];
var SHARE_ONLY_KEYS = ["aiProvider", "baseurl", "subject"];
var MARKDOWN_LINK = /^\[((?:\\.|[^\\\]])*)\]\((\S+)\)$/;
function targetForUrl(url) {
  const provider = findProviderByUrl(url);
  return provider ? { target: provider.id, customUrl: "" } : { target: "custom", customUrl: url };
}
function targetFromBuilderParams(params) {
  const baseUrl = params.get("baseurl")?.trim();
  if (baseUrl)
    return targetForUrl(baseUrl);
  const provider = findProvider(params.get("aiProvider"));
  return provider ? { target: provider.id, customUrl: "" } : null;
}
function parseBuilderParams(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (!BUILDER_KEYS.some((key) => params.has(key)))
    return null;
  const fields = { ...targetFromBuilderParams(params) };
  if (params.has("subject"))
    fields.title = params.get("subject") ?? "";
  if (params.has("prompt"))
    fields.prompt = params.get("prompt") ?? "";
  if (params.has("tool"))
    fields.imageTool = params.get("tool") === "image";
  if (params.has("autoSubmit"))
    fields.autoSubmit = params.get("autoSubmit") !== "false";
  if (params.has("pasteImage"))
    fields.pasteImage = params.get("pasteImage") !== "false";
  return fields;
}
function parseToolkitHashSafely(hash, search, codec) {
  try {
    return codec.parseToolkitHash(hash, search);
  } catch {
    try {
      return codec.parseToolkitHash(hash.replace(/%s/g, "%25s"), search);
    } catch {
      return null;
    }
  }
}
function parseLinkUrl(input, codec) {
  let url;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  const hash = url.hash.replace(/^#/, "");
  if (!hash)
    return null;
  const beforePrompt = new URLSearchParams(hash.split(/(?:^|&)prompt=/)[0]);
  if (SHARE_ONLY_KEYS.some((key) => beforePrompt.has(key))) {
    return { ...DEFAULT_STATE, ...parseBuilderParams(hash) };
  }
  const parsed = parseToolkitHashSafely(hash, url.search, codec);
  if (!parsed || !parsed.prompt && parsed.tool !== "image")
    return null;
  url.hash = "";
  return {
    ...DEFAULT_STATE,
    ...targetForUrl(url.href),
    prompt: parsed.prompt ?? "",
    autoSubmit: parsed.autoSubmit,
    pasteImage: parsed.pasteImage,
    imageTool: parsed.tool === "image"
  };
}
function parseImportedLink(input, codec) {
  const text = input.trim();
  const markdown = MARKDOWN_LINK.exec(text);
  const imported = parseLinkUrl(markdown ? markdown[2] : text, codec);
  if (!imported || !markdown)
    return imported;
  const title = markdown[1].replace(/\\(.)/g, "$1");
  return title.trim() ? { ...imported, title } : imported;
}

// src/linkBuilder/templates.ts
var ZH_TW = [
  { name: "使用正體中文回應", prompt: "請以台灣常用的正體中文回應。" },
  {
    name: "翻譯成正體中文",
    prompt: "You are a professional translation AI proficient in Chinese and English language. Please help me translate content into Traditional Chinese with Taiwan culture."
  },
  {
    name: "總結長文內容",
    prompt: "Please help me summarize content and list the key points. Then translate all the content into Traditional Chinese. No explanations and additional information of the translations are required. Do not add pronunciation annotations."
  },
  { name: "擴寫文章", prompt: "請幫我擴寫以下文章內容，使其更加詳細、豐富，並保持原有的語氣和風格。" },
  { name: "改寫文章", prompt: "請幫我改寫以下文章，使用不同的表達方式，但保持原意不變。" },
  { name: "修正錯字與文法", prompt: "請幫我檢查並修正以下內容的錯字、標點符號和文法錯誤，並提供修正後的完整內容。" },
  { name: "改寫郵件（專業版）", prompt: "請幫我將以下內容改寫成專業且禮貌的商業郵件格式。" },
  { name: "縮減文字量", prompt: "請幫我將以下內容精簡，保留核心重點，減少不必要的描述。" },
  {
    name: "Code Review",
    prompt: "Please review the following code and provide feedback on code quality, potential bugs, performance issues, and best practices. Suggest improvements where necessary."
  },
  {
    name: "最佳化程式碼",
    prompt: "Please optimize the following code for better performance, readability, and maintainability. Explain the changes you make."
  },
  { name: "將 PRD 轉成 Spec", prompt: "請將以下產品需求文件（PRD）轉換為詳細的技術規格文件（Spec），包含系統架構、API 設計、資料模型等技術細節。" },
  { name: "整理會議記錄", prompt: "請幫我整理以下會議記錄，提取重點、決議事項、待辦事項，並以清晰的格式呈現。" },
  { name: "生成測試計畫", prompt: "請根據以下需求或功能描述，生成一份完整的測試計畫，包含測試範圍、測試案例、預期結果等。" },
  { name: "解析 PDF 並總結內容", prompt: "請幫我解析並總結這份文件的主要內容，提取關鍵資訊和重點摘要。" }
];
var EN = [
  { name: "Reply in English", prompt: "Please reply in English." },
  {
    name: "Translate into English",
    prompt: "You are a professional translator. Please translate the following content into natural, fluent English."
  },
  { name: "Summarize a long text", prompt: "Please summarize the following content and list the key points." },
  {
    name: "Expand a text",
    prompt: "Please expand the following text to make it more detailed and richer, while keeping the original tone and style."
  },
  { name: "Rewrite a text", prompt: "Please rewrite the following text using different wording while keeping the original meaning." },
  {
    name: "Fix typos and grammar",
    prompt: "Please check the following text for typos, punctuation and grammar mistakes, and provide the corrected full text."
  },
  { name: "Rewrite as a business email", prompt: "Please rewrite the following as a professional and polite business email." },
  { name: "Make it shorter", prompt: "Please condense the following text, keeping the key points and removing unnecessary details." },
  {
    name: "Code review",
    prompt: "Please review the following code and provide feedback on code quality, potential bugs, performance issues, and best practices. Suggest improvements where necessary."
  },
  {
    name: "Optimize code",
    prompt: "Please optimize the following code for better performance, readability, and maintainability. Explain the changes you make."
  },
  {
    name: "Turn a PRD into a spec",
    prompt: "Please convert the following product requirements document (PRD) into a detailed technical specification, including the system architecture, API design and data models."
  },
  {
    name: "Organize meeting notes",
    prompt: "Please organize the following meeting notes into key points, decisions and action items, in a clear format."
  },
  {
    name: "Create a test plan",
    prompt: "Based on the following requirements or feature description, please create a complete test plan, including the scope, test cases and expected results."
  },
  {
    name: "Summarize a PDF",
    prompt: "Please analyze and summarize the main content of this document, and extract the key information and highlights."
  }
];
var JA = [
  { name: "日本語で回答", prompt: "日本語で回答してください。" },
  { name: "日本語に翻訳", prompt: "あなたはプロの翻訳者です。以下の内容を自然で読みやすい日本語に翻訳してください。" },
  { name: "長文を要約", prompt: "以下の内容を要約し、要点を箇条書きでまとめてください。" },
  { name: "文章を膨らませる", prompt: "以下の文章を、元の語調とスタイルを保ったまま、より詳しく豊かな内容に書き広げてください。" },
  { name: "文章を書き換える", prompt: "以下の文章を、意味を変えずに別の表現で書き換えてください。" },
  { name: "誤字と文法を修正", prompt: "以下の内容の誤字、句読点、文法の誤りを確認して修正し、修正後の全文を示してください。" },
  { name: "ビジネスメールに書き換え", prompt: "以下の内容を、丁寧でプロフェッショナルなビジネスメールに書き換えてください。" },
  { name: "文章を短くする", prompt: "以下の内容を、要点を残して不要な説明を省き、簡潔にまとめてください。" },
  {
    name: "コードレビュー",
    prompt: "以下のコードをレビューし、コード品質、潜在的なバグ、パフォーマンスの問題、ベストプラクティスの観点からフィードバックしてください。必要に応じて改善案も示してください。"
  },
  { name: "コードを最適化", prompt: "以下のコードを、パフォーマンス・可読性・保守性の観点から最適化し、変更点を説明してください。" },
  {
    name: "PRD を仕様書に変換",
    prompt: "以下の製品要求仕様書（PRD）を、システム構成、API 設計、データモデルなどの技術的な詳細を含む技術仕様書に変換してください。"
  },
  { name: "議事録を整理", prompt: "以下の議事録を整理し、要点・決定事項・ToDo を分かりやすい形式でまとめてください。" },
  { name: "テスト計画を作成", prompt: "以下の要件または機能の説明をもとに、テスト範囲、テストケース、期待結果を含むテスト計画を作成してください。" },
  { name: "PDF を要約", prompt: "このドキュメントの主な内容を分析して要約し、重要な情報と要点を抽出してください。" }
];
function getPromptTemplates(langTag) {
  const lang = langTag.toLowerCase();
  if (lang.startsWith("zh"))
    return ZH_TW;
  if (lang.startsWith("ja"))
    return JA;
  return EN;
}

// src/linkBuilder/LinkBuilderController.ts
var SEARCH_ENGINE_SETTINGS_URL = "chrome://settings/searchEngines";
var COPIED_FEEDBACK_MS = 1600;
function providerDetail(provider) {
  const url = new URL(provider.url);
  const host = url.hostname.replace(/^www\./, "");
  const path = url.pathname.replace(/\/+$/, "");
  const sharesHost = PROVIDERS.some((other) => other !== provider && new URL(other.url).hostname === url.hostname);
  return sharesHost && path ? `${host}${path}` : host;
}
function renderUrl(url, withScheme) {
  const hashIndex = url.indexOf("#");
  const base = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : url.slice(hashIndex + 1);
  let parsed;
  try {
    parsed = new URL(base);
  } catch {
    return [document.createTextNode(url)];
  }
  const host = `${withScheme ? `${parsed.protocol}//` : ""}${parsed.host}`;
  const nodes = [element("span", "url-host", host)];
  const path = `${parsed.pathname}${parsed.search}`;
  if (path !== "/" || withScheme || hash)
    nodes.push(element("span", "url-path", path));
  if (!hash)
    return nodes;
  nodes.push(element("span", "url-punct", "#"));
  const segments = hash.split("&");
  for (let index = 0;index < segments.length; index++) {
    if (index > 0)
      nodes.push(element("span", "url-punct", "&"));
    const segment = segments[index];
    const separator = segment.indexOf("=");
    if (separator === -1) {
      nodes.push(element("span", "url-value", segment));
      continue;
    }
    const key = segment.slice(0, separator);
    nodes.push(element("span", "url-key", key), element("span", "url-punct", "="));
    if (key === "prompt") {
      nodes.push(element("span", "url-prompt", segments.slice(index).join("&").slice(separator + 1)));
      break;
    }
    nodes.push(element("span", "url-value", segment.slice(separator + 1)));
  }
  return nodes;
}

class LinkBuilderController {
  codec;
  state;
  view;
  templates = [];
  ui;
  copyTimers = new WeakMap;
  providerPicker;
  customUrlField;
  customUrlInput;
  customUrlMessage;
  promptInput;
  titleInput;
  optionInputs;
  omniboxUrl;
  bookmarkLink;
  bookmarkIcon;
  bookmarkTitle;
  resultNotice;
  resultNoticeText;
  openLinkBtn;
  openLinkLabel;
  urlOutput;
  markdownOutput;
  searchNameOutput;
  searchUrlOutput;
  searchTermsNote;
  liveAnnouncer;
  templatesDialog;
  importDialog;
  importInput;
  importError;
  constructor(codec) {
    this.codec = codec;
    this.state = readState(getLocalStorage());
    this.ui = new OptionsUIController("statusMessage");
  }
  init() {
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
  initializeDOM() {
    this.providerPicker = byId("providerPicker");
    this.customUrlField = byId("customUrlField");
    this.customUrlInput = byId("customUrl");
    this.customUrlMessage = byId("customUrlMessage");
    this.promptInput = byId("promptText");
    this.titleInput = byId("linkTitle");
    this.optionInputs = {
      autoSubmit: byId("autoSubmit"),
      pasteImage: byId("pasteImage"),
      imageTool: byId("imageTool")
    };
    this.omniboxUrl = byId("omniboxUrl");
    this.bookmarkLink = byId("bookmarkLink");
    this.bookmarkIcon = byId("bookmarkIcon");
    this.bookmarkTitle = byId("bookmarkTitle");
    this.resultNotice = byId("resultNotice");
    this.resultNoticeText = byId("resultNoticeText");
    this.openLinkBtn = byId("openLinkBtn");
    this.openLinkLabel = byId("openLinkLabel");
    this.urlOutput = byId("urlOutput");
    this.markdownOutput = byId("markdownOutput");
    this.searchNameOutput = byId("searchNameOutput");
    this.searchUrlOutput = byId("searchUrlOutput");
    this.searchTermsNote = byId("searchTermsNote");
    this.liveAnnouncer = byId("liveAnnouncer");
    this.templatesDialog = byId("templatesDialog");
    this.importDialog = byId("importDialog");
    this.importInput = byId("importInput");
    this.importError = byId("importError");
  }
  renderProviders() {
    const choices = [
      ...PROVIDERS.map((provider) => ({ id: provider.id, name: provider.name, detail: providerDetail(provider), icon: provider.icon })),
      { id: "custom", name: getMessage("link_builder_custom_name"), detail: getMessage("link_builder_custom_hint"), icon: "globe" }
    ];
    const tiles = choices.map((choice) => {
      const label = element("label", choice.id === "custom" ? "provider provider--custom" : "provider");
      const input = element("input", "provider__input");
      input.type = "radio";
      input.name = "target";
      input.value = choice.id;
      const icon = element("span", "provider__icon");
      icon.append(createIcon(choice.icon));
      const text = element("span", "provider__text");
      text.append(element("span", "provider__name", choice.name), element("span", "provider__detail", choice.detail));
      label.append(input, icon, text);
      return label;
    });
    this.providerPicker.append(...tiles);
  }
  renderTemplates() {
    const items = this.templates.map((template) => {
      const item = element("li");
      const button = element("button", "template");
      button.type = "button";
      button.append(element("span", "template__name", template.name), element("span", "template__prompt", template.prompt));
      button.addEventListener("click", () => this.applyTemplate(template));
      item.append(button);
      return item;
    });
    byId("templateList").replaceChildren(...items);
  }
  renderShortcutKeys() {
    const bookmarksBar = byId("bookmarksBarKeys");
    bookmarksBar.replaceChildren(element("span", undefined, getMessage("link_builder_bookmarks_bar_shortcut")), ...shortcutKbds("B", { shift: true }));
    this.openLinkBtn.title = shortcutText("Enter");
  }
  applyHashParams() {
    const fields = parseBuilderParams(location.hash);
    if (!fields)
      return;
    this.state = { ...this.state, ...fields };
    history.replaceState(null, document.title, location.pathname + location.search);
    writeState(getLocalStorage(), this.state);
  }
  attachEventListeners() {
    let pickedWithPointer = false;
    this.providerPicker.addEventListener("pointerdown", () => {
      pickedWithPointer = true;
    });
    this.providerPicker.addEventListener("keydown", () => {
      pickedWithPointer = false;
    });
    this.providerPicker.addEventListener("change", (event) => {
      const input = event.target;
      if (input.name === "target" && input.checked)
        this.selectTarget(input.value, pickedWithPointer);
    });
    this.customUrlInput.addEventListener("input", () => {
      this.state.customUrl = this.customUrlInput.value;
      this.update();
    });
    this.promptInput.addEventListener("input", () => {
      this.state.prompt = this.promptInput.value;
      this.update();
    });
    this.titleInput.addEventListener("input", () => {
      this.state.title = this.titleInput.value;
      this.update();
    });
    LINK_OPTIONS.forEach((key) => {
      this.optionInputs[key].addEventListener("change", () => {
        this.state[key] = this.optionInputs[key].checked;
        this.update();
      });
    });
    const insertButton = byId("insertSearchTermsBtn");
    insertButton.addEventListener("pointerdown", (event) => event.preventDefault());
    insertButton.addEventListener("click", () => {
      if (document.activeElement !== this.promptInput) {
        const end = this.promptInput.value.length;
        this.promptInput.setSelectionRange(end, end);
      }
      insertTextAtCaret(this.promptInput, "%s");
    });
    document.querySelectorAll(".copy-btn").forEach((button) => {
      button.addEventListener("click", () => void this.copy(button.dataset.copy, button));
    });
    this.openLinkBtn.addEventListener("click", (event) => {
      if (!this.view.ready)
        event.preventDefault();
    });
    this.bookmarkLink.addEventListener("click", (event) => {
      if (!this.view.ready)
        event.preventDefault();
    });
    this.bookmarkLink.addEventListener("dragstart", (event) => {
      if (!this.view.ready)
        event.preventDefault();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey) || event.isComposing)
        return;
      if (document.querySelector("dialog[open]") || !this.view.ready)
        return;
      event.preventDefault();
      window.open(this.view.url, "_blank", "noopener");
    });
    byId("openSearchSettingsBtn").addEventListener("click", () => void this.openSearchEngineSettings());
    byId("managePromptsBtn").addEventListener("click", () => void chrome.runtime.openOptionsPage());
    byId("openTemplatesBtn").addEventListener("click", () => this.openTemplatesDialog());
    byId("importLinkBtn").addEventListener("click", () => this.openImportDialog());
    [this.templatesDialog, this.importDialog].forEach((dialog) => {
      onDialogBackdropClick(dialog, () => dialog.close());
      dialog.querySelectorAll("[data-close-dialog]").forEach((button) => {
        button.addEventListener("click", () => dialog.close());
      });
    });
    byId("importForm").addEventListener("submit", (event) => {
      event.preventDefault();
      this.importLink();
    });
    this.importInput.addEventListener("input", () => this.setImportError(false));
    this.importDialog.addEventListener("close", () => {
      this.importInput.value = "";
      this.setImportError(false);
    });
  }
  selectTarget(target, focusUrl = false) {
    const previous = findProvider(this.state.target);
    this.state.target = target;
    if (target === "custom" && !this.state.customUrl.trim() && previous) {
      this.state.customUrl = previous.url;
      this.customUrlInput.value = previous.url;
    }
    this.update();
    if (target === "custom" && focusUrl) {
      this.customUrlInput.focus();
      const end = this.customUrlInput.value.length;
      this.customUrlInput.setSelectionRange(end, end);
    }
  }
  applyTemplate(template) {
    this.templatesDialog.close();
    this.promptInput.focus();
    this.promptInput.select();
    insertTextAtCaret(this.promptInput, template.prompt);
    const title = this.titleInput.value.trim();
    if (!title || this.templates.some((item) => item.name === title)) {
      this.titleInput.value = template.name;
      this.state.title = template.name;
      this.update();
    }
    this.ui.showStatus(getMessage("link_builder_template_applied", [template.name, shortcutText("Z")]), "success");
  }
  openTemplatesDialog() {
    if (this.templatesDialog.open)
      return;
    this.templatesDialog.showModal();
    this.templatesDialog.querySelector(".template")?.focus();
  }
  openImportDialog() {
    if (this.importDialog.open)
      return;
    this.importDialog.showModal();
    this.importInput.focus();
  }
  setImportError(visible) {
    this.importError.hidden = !visible;
    this.importInput.setAttribute("aria-invalid", String(visible));
  }
  importLink() {
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
    this.ui.showStatus(getMessage("link_builder_import_success"), "success");
  }
  textFor(output) {
    switch (output) {
      case "url":
        return this.view.url;
      case "markdown":
        return this.view.markdown;
      case "searchName":
        return this.view.siteSearchName;
      case "searchUrl":
        return this.view.siteSearchUrl;
    }
  }
  async copy(output, button) {
    const text = this.textFor(output);
    if (!text)
      return;
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      copied = this.copyWithSelection(text);
    }
    if (!copied) {
      this.ui.showStatus(getMessage("link_builder_copy_error"), "error");
      return;
    }
    this.showCopied(button);
    this.announce(getMessage("link_builder_status_copied"));
  }
  copyWithSelection(text) {
    const scratch = element("textarea");
    scratch.value = text;
    scratch.setAttribute("readonly", "");
    scratch.style.position = "fixed";
    scratch.style.opacity = "0";
    document.body.append(scratch);
    scratch.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      scratch.remove();
    }
  }
  showCopied(button) {
    const label = button.querySelector(".copy-btn__label");
    const icon = button.querySelector("use");
    button.classList.add("is-copied");
    if (label)
      label.textContent = getMessage("link_builder_copied");
    icon?.setAttribute("href", iconHref("check"));
    window.clearTimeout(this.copyTimers.get(button));
    this.copyTimers.set(button, window.setTimeout(() => {
      button.classList.remove("is-copied");
      if (label)
        label.textContent = getMessage("link_builder_copy");
      icon?.setAttribute("href", iconHref("copy"));
    }, COPIED_FEEDBACK_MS));
  }
  announce(message) {
    this.liveAnnouncer.textContent = "";
    window.setTimeout(() => {
      this.liveAnnouncer.textContent = message;
    }, 50);
  }
  async openSearchEngineSettings() {
    try {
      await chrome.tabs.create({ url: SEARCH_ENGINE_SETTINGS_URL });
    } catch {
      this.ui.showStatus(getMessage("link_builder_search_settings_error"), "error");
    }
  }
  writeInputs() {
    this.providerPicker.querySelectorAll('input[name="target"]').forEach((input) => {
      input.checked = input.value === this.state.target;
    });
    this.customUrlInput.value = this.state.customUrl;
    this.promptInput.value = this.state.prompt;
    this.titleInput.value = this.state.title;
  }
  update(options = {}) {
    this.view = resolveLink(this.state, this.codec);
    this.renderTarget();
    this.renderOptions();
    this.renderResult();
    this.renderSiteSearch();
    if (options.save !== false)
      writeState(getLocalStorage(), this.state);
  }
  renderTarget() {
    const isCustom = this.state.target === "custom";
    this.customUrlField.hidden = !isCustom;
    let messageKey = "";
    if (isCustom && this.view.problem) {
      messageKey = this.view.problem === "empty" ? "link_builder_custom_url_empty" : "link_builder_custom_url_invalid";
    } else if (isCustom && !this.view.site) {
      messageKey = "link_builder_custom_url_unsupported";
    }
    this.customUrlInput.setAttribute("aria-invalid", String(isCustom && this.view.problem !== null));
    if (this.customUrlMessage.dataset.key !== messageKey) {
      this.customUrlMessage.dataset.key = messageKey;
      const message = messageKey ? element("p", this.view.problem ? "field__error" : "field__warning") : null;
      message?.append(createIcon(this.view.problem ? "alert-circle" : "alert-triangle"), element("span", undefined, getMessage(messageKey)));
      this.customUrlMessage.replaceChildren(...message ? [message] : []);
    }
    this.titleInput.placeholder = this.view.siteName || getMessage("link_builder_bookmark_placeholder");
  }
  renderOptions() {
    const { site, unavailable } = this.view;
    const reasonText = {
      "site-unsupported": getMessage("link_builder_site_unsupported"),
      "generates-images": getMessage("link_builder_image_tool_builtin", site?.name ?? ""),
      "feature-unsupported": getMessage("link_builder_feature_unavailable", site?.name ?? "")
    };
    LINK_OPTIONS.forEach((key) => {
      const input = this.optionInputs[key];
      const reason = unavailable[key];
      input.disabled = Boolean(reason);
      input.checked = !reason && this.state[key];
      input.closest(".switch-row")?.classList.toggle("is-unavailable", Boolean(reason));
      const note = byId(`${key}Note`);
      note.hidden = !reason;
      if (reason)
        note.textContent = reasonText[reason];
    });
  }
  renderResult() {
    const { ready, url, baseUrl, siteName, title, markdown } = this.view;
    this.omniboxUrl.replaceChildren(...ready ? renderUrl(url, false) : baseUrl ? renderUrl(baseUrl, false) : []);
    this.bookmarkTitle.textContent = title || getMessage("link_builder_bookmark_placeholder");
    this.bookmarkIcon.setAttribute("href", iconHref(this.view.icon));
    this.setLinkEnabled(this.bookmarkLink, ready ? url : "");
    this.bookmarkLink.draggable = ready;
    this.resultNotice.hidden = ready;
    if (!ready) {
      this.resultNoticeText.textContent = getMessage(baseUrl ? "link_builder_result_empty" : "link_builder_result_url_problem");
    }
    this.openLinkLabel.textContent = siteName ? getMessage("link_builder_open", siteName) : getMessage("link_builder_open_fallback");
    this.setLinkEnabled(this.openLinkBtn, ready ? url : "");
    this.urlOutput.replaceChildren(...ready ? renderUrl(url, true) : []);
    this.markdownOutput.textContent = markdown;
    this.setCopyEnabled("url", ready);
    this.setCopyEnabled("markdown", ready);
  }
  renderSiteSearch() {
    const { siteSearchName, siteSearchUrl, searchTermsInPrompt } = this.view;
    this.searchNameOutput.textContent = siteSearchName;
    this.searchUrlOutput.replaceChildren(...siteSearchUrl ? renderUrl(siteSearchUrl, true) : []);
    this.setCopyEnabled("searchName", Boolean(siteSearchName));
    this.setCopyEnabled("searchUrl", Boolean(siteSearchUrl));
    const message = getMessage(searchTermsInPrompt ? "link_builder_search_terms_in_prompt" : "link_builder_search_terms_appended");
    const parts = message.split("%s");
    const nodes = [];
    parts.forEach((part, index) => {
      if (index > 0)
        nodes.push(element("code", "inline-token", "%s"));
      nodes.push(document.createTextNode(part));
    });
    this.searchTermsNote.replaceChildren(...nodes);
  }
  setLinkEnabled(link, href) {
    if (href) {
      link.href = href;
      link.removeAttribute("aria-disabled");
      link.removeAttribute("tabindex");
    } else {
      link.removeAttribute("href");
      link.setAttribute("aria-disabled", "true");
      link.tabIndex = -1;
    }
  }
  setCopyEnabled(output, enabled) {
    document.querySelectorAll(`.copy-btn[data-copy="${output}"]`).forEach((button) => {
      button.disabled = !enabled;
    });
  }
}
var start = () => {
  const codec = window.ChatGPTToolkitContentUtils;
  if (!codec) {
    console.error("[ChatGPTToolkit] link-builder.html must load scripts/content-utils.js before scripts/link-builder.js.");
    return;
  }
  new LinkBuilderController(codec).init();
};
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}

//# debugId=5CE33324173DD33D64756E2164756E21
