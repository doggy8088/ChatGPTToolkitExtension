/**
 * DOM helpers shared by the extension pages (options page, link builder).
 */
export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** A required element of the page; a missing one is a markup bug. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`${location.pathname} is missing #${id}`);
  return node as T;
}

/**
 * Insert text at the caret (replacing the selection) through the editing commands, so Ctrl/⌘ + Z can
 * undo it. Where `insertText` is unsupported, falls back to `setRangeText` plus an `input` event.
 */
export function insertTextAtCaret(field: HTMLTextAreaElement, text: string): void {
  field.focus();
  let inserted = false;
  try {
    inserted = document.execCommand('insertText', false, text);
  } catch {
    inserted = false;
  }

  if (!inserted) {
    const { selectionStart, selectionEnd } = field;
    field.setRangeText(text, selectionStart, selectionEnd, 'end');
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

const isApplePlatform = (): boolean => /Mac|iPhone|iPad|iPod/i.test(navigator.platform || '');

/** The keys of a Ctrl/⌘ shortcut on this platform: `['⌘', '⇧', 'B']` or `['Ctrl', 'Shift', 'B']`. */
export function shortcutKeys(key: string, options: { shift?: boolean } = {}): string[] {
  const apple = isApplePlatform();
  return [apple ? '⌘' : 'Ctrl', ...(options.shift ? [apple ? '⇧' : 'Shift'] : []), key];
}

/** A shortcut written inline: `⌘Z` / `Ctrl+Z`. */
export function shortcutText(key: string, options: { shift?: boolean } = {}): string {
  return shortcutKeys(key, options).join(isApplePlatform() ? '' : '+');
}

/** A shortcut as `<kbd>` elements. */
export function shortcutKbds(key: string, options: { shift?: boolean } = {}): HTMLElement[] {
  return shortcutKeys(key, options).map((label) => element('kbd', undefined, label));
}
