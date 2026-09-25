export type I18nSubstitutions = string | string[];

export const getMessage = (key: string, substitutions?: I18nSubstitutions): string => {
  if (typeof chrome !== 'undefined' && chrome.i18n?.getMessage) {
    const message = chrome.i18n.getMessage(key, substitutions as string[]);
    return message || key;
  }

  return key;
};

/**
 * BCP 47 tag of the locale Chrome picked for the extension messages (e.g. `zh-Hant-TW`, `en`, `ja`),
 * or an empty string when messages are unavailable.
 */
export const getMessagesLangTag = (): string => {
  const lang = getMessage('options_lang_tag');
  return lang && lang !== 'options_lang_tag' ? lang : '';
};

/**
 * `data-i18n-args="key1, key2"` → the localized messages used as substitutions.
 */
const resolveI18nArgs = (rawArgs?: string): string[] | undefined => {
  if (!rawArgs) return undefined;
  const parts = rawArgs.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;
  return parts.map((part) => getMessage(part));
};

/**
 * Localize an extension page: `<html lang>` plus the `data-i18n` (text), `data-i18n-placeholder`,
 * `data-i18n-aria-label` (also the tooltip of `.has-tooltip` elements) and `data-i18n-title` attributes.
 */
export function applyPageI18n(): void {
  const lang = getMessagesLangTag();
  if (lang) document.documentElement.lang = lang;

  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n;
    if (!key) return;
    element.textContent = getMessage(key, resolveI18nArgs(element.dataset.i18nArgs));
  });

  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-i18n-placeholder]').forEach((element) => {
    const key = element.dataset.i18nPlaceholder;
    if (!key) return;
    element.placeholder = getMessage(key, resolveI18nArgs(element.dataset.i18nArgs));
  });

  document.querySelectorAll<HTMLElement>('[data-i18n-aria-label]').forEach((element) => {
    const key = element.dataset.i18nAriaLabel;
    if (!key) return;
    const label = getMessage(key, resolveI18nArgs(element.dataset.i18nArgs));
    element.setAttribute('aria-label', label);
    if (element.classList.contains('has-tooltip')) element.dataset.tooltip = label;
  });

  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((element) => {
    const key = element.dataset.i18nTitle;
    if (!key) return;
    element.title = getMessage(key, resolveI18nArgs(element.dataset.i18nArgs));
  });
}
