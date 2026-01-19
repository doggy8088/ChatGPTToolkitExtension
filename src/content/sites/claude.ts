import type { ContentContext } from '../context';

export function initClaude(ctx: ContentContext) {
  if (location.hostname !== 'claude.ai') return false;

  const params = ctx.refreshParamsFromHash();
  if (!params?.prompt) return true;

  ctx.startRetryInterval({
    intervalMs: 500,
    retries: 10,
    tick: () => {
      const textarea = document.querySelector<HTMLElement>('div[contenteditable]');
      if (!textarea) return false;

      ctx.fillContentEditableWithParagraphs(textarea, params.prompt);

      const button = document.querySelector<HTMLButtonElement>('button');
      if (!button) return false;

      if (params.autoSubmit) {
        button.focus();
        setTimeout(() => {
          button.click();
        }, 500);
      }

      return true;
    },
  });

  return true;
}
