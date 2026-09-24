import { PROMPT_MIGRATIONS_KEY, applyPendingPromptMigrations } from '../shared/promptMigrations';

/**
 * Prompt helpers shared by the per-site content scripts (ChatGPT, Gemini).
 */

export interface PromptItem {
  enabled?: boolean;
  initial?: boolean;
  svgIcon?: string;
  title?: string;
  altText?: string;
  prompt?: string;
  autoPaste?: boolean;
  autoSubmit?: boolean;
}

export interface ReadyPrompt extends PromptItem {
  title: string;
  prompt: string;
}

export const CUSTOM_PROMPTS_KEY = 'chatgpttoolkit.customPrompts';
export const ARGS_PLACEHOLDER = '{{args}}';

function safeParseJsonArray(str?: string | null): PromptItem[] | null {
  if (!str) return null;
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? (parsed as PromptItem[]) : null;
  } catch {
    return null;
  }
}

function chromeStorageGet(keys: string[]) {
  try {
    if (!chrome?.storage?.local) return Promise.resolve<Record<string, unknown>>({});
    return new Promise<Record<string, unknown>>((resolve) =>
      chrome.storage.local.get(keys, (result) => resolve((result as Record<string, unknown>) || {}))
    );
  } catch {
    return Promise.resolve<Record<string, unknown>>({});
  }
}

function chromeStorageSet(items: Record<string, unknown>) {
  try {
    if (!chrome?.storage?.local) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => chrome.storage.local.set(items, () => resolve(true)));
  } catch {
    return Promise.resolve(false);
  }
}

/**
 * Load custom prompts from `chrome.storage.local`, migrating legacy per-site
 * `localStorage` data and applying pending one-time prompt migrations.
 * Returns `null` when the user has never saved any prompts.
 */
export async function loadCustomPrompts(): Promise<PromptItem[] | null> {
  const items = await chromeStorageGet([CUSTOM_PROMPTS_KEY, PROMPT_MIGRATIONS_KEY]);
  const stored = items[CUSTOM_PROMPTS_KEY];
  const legacy = Array.isArray(stored) ? null : safeParseJsonArray(localStorage.getItem(CUSTOM_PROMPTS_KEY));
  const source = Array.isArray(stored) ? (stored as PromptItem[]) : legacy;
  if (!source) return null;

  const migrated = applyPendingPromptMigrations(source, items[PROMPT_MIGRATIONS_KEY]);
  const updates: Record<string, unknown> = {};
  if (migrated.changed || legacy) updates[CUSTOM_PROMPTS_KEY] = migrated.prompts;
  if (migrated.appliedChanged) updates[PROMPT_MIGRATIONS_KEY] = migrated.appliedIds;
  if (Object.keys(updates).length > 0) await chromeStorageSet(updates);
  return migrated.prompts;
}

/**
 * Pick the enabled, complete prompts of one group (initial or follow-up), keeping storage order.
 */
export function selectReadyPrompts(prompts: PromptItem[] | null | undefined, initial: boolean): ReadyPrompt[] {
  return (prompts || []).filter((item): item is ReadyPrompt => {
    if (!item || typeof item !== 'object') return false;
    const isEnabled = !Object.prototype.hasOwnProperty.call(item, 'enabled') || item.enabled === true;
    const isInitial = Object.prototype.hasOwnProperty.call(item, 'initial') && item.initial === true;
    return isEnabled && isInitial === initial && !!item.title && !!item.prompt;
  });
}

/**
 * Stable signature used to skip re-rendering buttons when the prompt list is unchanged.
 */
export function getReadyPromptsSignature(items: ReadyPrompt[]): string {
  return JSON.stringify(
    items.map((item) => [item.title, item.prompt, item.altText || '', item.autoPaste === true, item.autoSubmit === true])
  );
}

/**
 * Built-in follow-up buttons used when the user has no stored prompts.
 */
export function getLocaleDefaultFollowUpPrompts(locale: string | undefined): ReadyPrompt[] {
  if (!locale) return [];
  if (locale === 'zh-TW') {
    return [
      { title: '舉例說明', prompt: '請舉例說明' },
      { title: '提供細節', prompt: '請提供更多細節說明' },
      { title: '翻譯成繁中', prompt: '請將上述回應內容翻譯成臺灣常用的正體中文' },
      { title: '翻譯成英文', prompt: 'Please translate the above response into English.' },
    ];
  }
  if (locale === 'ja') {
    return [
      { title: '例えば', prompt: '例を挙げて説明して' },
      { title: '詳細説明', prompt: 'もっと詳細に説明して' },
      { title: '日本語に翻訳', prompt: '上述の返答内容を日本語に翻訳して' },
      { title: '英語に翻訳', prompt: 'Please translate the above response into English.' },
    ];
  }
  return [
    { title: 'More Examples', prompt: 'Could you please provide me with more examples?' },
    { title: 'More Details', prompt: 'Could you please provide me with more details?' },
    { title: 'Translate to English', prompt: 'Please translate the above response into English.' },
  ];
}

/**
 * Build the final prompt for an auto-paste button: replace every `{{args}}` with the
 * argument text, or append it when the template has no placeholder.
 */
export function applyPromptArgs(template: string, argsText: string): string {
  if (template.includes(ARGS_PLACEHOLDER)) {
    return template.split(ARGS_PLACEHOLDER).join(argsText);
  }
  return argsText ? template + argsText : template;
}

export function readClipboardTextSafely(debug: boolean, site: string): Promise<string> {
  if (!navigator.clipboard?.readText) return Promise.resolve('');
  return navigator.clipboard.readText().catch((error) => {
    if (debug) console.warn(`[ChatGPTToolkit][${site}] clipboard read failed`, error);
    return '';
  });
}

/**
 * Resolve the text of an auto-paste button: the composer text wins over the clipboard.
 */
export async function resolveAutoPastePrompt(
  template: string,
  editorText: string,
  debug: boolean,
  site: string
): Promise<{ prompt: string; argsSource: 'editor' | 'clipboard'; argsLength: number }> {
  const trimmedEditorText = editorText.trim();
  const argsText = trimmedEditorText || (await readClipboardTextSafely(debug, site)).trim();
  return {
    prompt: applyPromptArgs(template, argsText),
    argsSource: trimmedEditorText ? 'editor' : 'clipboard',
    argsLength: argsText.length,
  };
}
