interface RetryIntervalOptions {
  intervalMs?: number;
  retries?: number;
  tick: () => boolean | Promise<boolean>;
}

declare const __CHATGPT_TOOLKIT_DEBUG__: boolean;

interface ParsedToolkitHash {
  prompt: string | null;
  autoSubmit: boolean;
  pasteImage: boolean;
  tool: string;
}

interface ContentUtilsApi {
  parseToolkitHash: (hash: string, locationSearch: string) => ParsedToolkitHash;
}

export const CLIPBOARD_ARGS_PLACEHOLDER = '{{args}}';

export function buildPrefixedText(newText: string, existingText: string) {
  if (!existingText) return newText;
  if (!newText) return existingText;
  return newText.endsWith('\n') ? `${newText}${existingText}` : `${newText}\n${existingText}`;
}

export function normalizeComparableText(text: string) {
  return (text || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hasPrefixText(existingText: string, prefixText: string) {
  if (!existingText || !prefixText) return false;
  if (existingText === prefixText) return true;

  const rawPrefixWithBreak = prefixText.endsWith('\n') ? prefixText : `${prefixText}\n`;
  if (existingText.startsWith(rawPrefixWithBreak)) return true;

  const normalizedExisting = normalizeComparableText(existingText);
  const normalizedPrefix = normalizeComparableText(prefixText);
  if (normalizedPrefix.length > 0 && normalizedExisting.startsWith(normalizedPrefix)) {
    return (
      normalizedExisting.length === normalizedPrefix.length ||
      normalizedExisting.charAt(normalizedPrefix.length) === ' '
    );
  }

  return false;
}

export function resolvePromptText(
  promptText: string,
  clipboardText: string,
  placeholder = CLIPBOARD_ARGS_PLACEHOLDER
) {
  const trimmedClipboard = clipboardText.trim();
  if (!trimmedClipboard) return promptText;

  if (promptText.includes(placeholder)) {
    return promptText.split(placeholder).join(trimmedClipboard);
  }

  return buildPrefixedText(promptText, trimmedClipboard);
}

export interface ParamsState {
  prompt: string;
  autoSubmit: boolean;
  pasteImage: boolean;
  tool: string;
  pastingImage: boolean;
}

export interface ContentContext {
  debug: boolean;
  state: ParamsState;
  refreshParamsFromHash: () => ParamsState | null;
  clearHash: () => void;
  fillContentEditableWithParagraphs: (
    target: HTMLElement | null,
    text: string,
    preserveExistingText?: boolean
  ) => void;
  fillTextareaAndDispatchInput: (
    textarea: HTMLTextAreaElement | null,
    text: string,
    preserveExistingText?: boolean
  ) => void;
  startRetryInterval: (options: RetryIntervalOptions) => number;
  delay: (ms: number) => Promise<void>;
  fetchClipboardImageAndSimulatePaste: (targetElement: HTMLElement | null) => Promise<boolean>;
}

export function createContentContext(): ContentContext | null {
  const debug =
    typeof __CHATGPT_TOOLKIT_DEBUG__ === 'boolean' ? __CHATGPT_TOOLKIT_DEBUG__ : true;

  const contentUtils = window.ChatGPTToolkitContentUtils as ContentUtilsApi | undefined;
  if (!contentUtils) {
    console.error('[ChatGPTToolkit] Missing ChatGPTToolkitContentUtils; check manifest.json script order.');
    return null;
  }

  const state: ParamsState = {
    prompt: '',
    autoSubmit: false,
    pasteImage: false,
    tool: '',
    pastingImage: false,
  };

  function readTargetText(target: HTMLElement | HTMLTextAreaElement) {
    if (target instanceof HTMLTextAreaElement) {
      return target.value;
    }

    if (target.isConnected) {
      return target.innerText;
    }

    return Array.from(target.childNodes)
      .map((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          return node.textContent || '';
        }

        if (node instanceof HTMLBRElement) {
          return '\n';
        }

        return (node as HTMLElement).textContent || '';
      })
      .join('\n');
  }

  function fillContentEditableWithParagraphs(
    target: HTMLElement | null,
    text: string,
    preserveExistingText = false
  ) {
    if (!target) return;
    const existingText = readTargetText(target);
    const nextText = preserveExistingText
      ? hasPrefixText(existingText, text)
        ? existingText
        : buildPrefixedText(text, existingText)
      : text;
    const lines = (nextText || '').split('\n');
    target.innerHTML = '';
    lines.forEach((line) => {
      const paragraph = document.createElement('p');
      paragraph.innerText = line;
      target.appendChild(paragraph);
    });
  }

  function fillTextareaAndDispatchInput(
    textarea: HTMLTextAreaElement | null,
    text: string,
    preserveExistingText = false
  ) {
    if (!textarea) return;
    const existingText = readTargetText(textarea);
    textarea.value = preserveExistingText
      ? hasPrefixText(existingText, text)
        ? existingText
        : buildPrefixedText(text, existingText)
      : text;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function startRetryInterval({ intervalMs = 500, retries = 10, tick }: RetryIntervalOptions) {
    let remaining = retries;
    const ti = window.setInterval(async () => {
      try {
        const shouldStop = await tick();
        if (shouldStop) {
          clearInterval(ti);
          return;
        }
      } catch {
        // Keep retrying on errors to preserve existing behavior.
      }

      remaining--;
      if (remaining <= 0) {
        clearInterval(ti);
      }
    }, intervalMs);
    return ti;
  }

  function delay(ms: number) {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  async function fetchClipboardImageAndSimulatePaste(targetElement: HTMLElement | null) {
    if (!targetElement) return false;

    targetElement.focus();

    try {
      if (debug) console.log('從剪貼簿抓取圖片');
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const file = new File([blob], 'clipboard-image.png', { type });

            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            const pasteEvent = new ClipboardEvent('paste', {
              bubbles: true,
              cancelable: true,
              clipboardData: dataTransfer,
            });

            console.log('觸發貼上事件', pasteEvent);
            targetElement.dispatchEvent(pasteEvent);
            console.log('模擬貼上圖片成功');

            return true;
          }
        }
      }

      console.log('剪貼簿中沒有圖片');
      return false;
    } catch (error) {
      console.error('抓取剪貼簿圖片失敗:', error);
      return false;
    }
  }

  function refreshParamsFromHash() {
    const hash = location.hash.substring(1);
    if (!hash) return null;

    if (debug) console.log('hash: ', hash);

    const parsed = contentUtils!.parseToolkitHash(hash, location.search);
    state.prompt = parsed.prompt || '';
    state.autoSubmit = parsed.autoSubmit;
    state.pasteImage = parsed.pasteImage;
    state.tool = parsed.tool || '';

    if (debug) console.log('prompt: ', state.prompt);
    if (debug) console.log('autoSubmit: ', state.autoSubmit);
    if (debug) console.log('pasteImage: ', state.pasteImage);
    if (debug) console.log('tool: ', state.tool);

    if (!state.prompt && !state.tool) {
      return null;
    }

    return state;
  }

  function clearHash() {
    if (history.replaceState) {
      history.replaceState(null, document.title, window.location.pathname + window.location.search);
    } else {
      window.location.hash = '';
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
    fetchClipboardImageAndSimulatePaste,
  };
}
