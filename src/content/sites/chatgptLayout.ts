import { watchChatGPTWidth, type ChatGPTWidth } from '../../shared/chatgptLayout';
import { CHATGPT_COMPOSER_FORM_SELECTORS } from './chatgptSelectors';

export const CHATGPT_LAYOUT_STYLE_ID = 'chatgpttoolkit-conversation-width';
const COMPOSER_SELECTOR = `:is(${CHATGPT_COMPOSER_FORM_SELECTORS.join(', ')})`;

export function applyChatGPTWidth(width: ChatGPTWidth): void {
  if (width === 'default') {
    document.getElementById(CHATGPT_LAYOUT_STYLE_ID)?.remove();
    return;
  }

  let style = document.getElementById(CHATGPT_LAYOUT_STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = CHATGPT_LAYOUT_STYLE_ID;
    document.head.appendChild(style);
  }
  // Container units refer to the main surface, so nested message/composer wrappers
  // use the same measure instead of repeatedly multiplying a percentage.
  style.textContent = `
    @media screen and (min-width: 768px) {
      main:has(#thread), main:has([data-thread-find-target="conversation"]),
      main:has(${COMPOSER_SELECTOR}) {
        container-type: inline-size;
      }
      main :is(#thread, [data-thread-find-target="conversation"], #thread-bottom-container),
      main ${COMPOSER_SELECTOR},
      main [class*="--thread-content-max-width"] {
        --thread-content-max-width: ${width}cqw !important;
        --thread-content-responsive-max-width: ${width}cqw !important;
      }
      main #thread [class*="--thread-content-margin"] {
        --thread-content-margin: 16px !important;
      }
      main :is(#thread, #thread-bottom-container) [class*="max-w-"][class*="thread-content"],
      main #thread article[data-testid^="conversation-turn-"] > div > div,
      main[data-app-shell-main-surface] [data-thread-find-target="conversation"],
      main ${COMPOSER_SELECTOR} {
        box-sizing: border-box;
        width: min(100%, ${width}cqw) !important;
        max-width: min(100%, ${width}cqw) !important;
        margin-inline: auto !important;
      }
    }
  `;
}

export function initChatGPTLayout(): void {
  watchChatGPTWidth(applyChatGPTWidth, (error) => console.warn('Unable to load ChatGPT layout settings:', error));
}
