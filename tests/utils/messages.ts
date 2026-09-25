import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type MessageLookup = (key: string, substitutions?: string | string[]) => string;

/**
 * `chrome.i18n.getMessage` backed by one locale's `_locales/<locale>/messages.json`.
 */
export function loadMessages(locale: 'en' | 'ja' | 'zh_TW'): MessageLookup {
  const messages = JSON.parse(
    readFileSync(resolve(import.meta.dir, '../../_locales', locale, 'messages.json'), 'utf8')
  ) as Record<string, { message: string }>;

  return (key, substitutions) => {
    const entry = messages[key];
    if (!entry) return '';
    const subs = substitutions === undefined ? [] : Array.isArray(substitutions) ? substitutions : [substitutions];
    return entry.message.replace(/\$(\d)/g, (_, n: string) => subs[Number(n) - 1] ?? '');
  };
}
