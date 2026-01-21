export type I18nSubstitutions = string | string[];

export const getMessage = (key: string, substitutions?: I18nSubstitutions): string => {
  if (typeof chrome !== 'undefined' && chrome.i18n?.getMessage) {
    const message = chrome.i18n.getMessage(key, substitutions as string[]);
    return message || key;
  }

  return key;
};
