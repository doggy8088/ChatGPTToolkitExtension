import type { ContentContext } from '../context';

export function initPerplexity(ctx: ContentContext) {
  if (location.hostname !== 'www.perplexity.ai') return false;

  const params = ctx.refreshParamsFromHash();
  if (!params?.prompt) return true;

  ctx.startRetryInterval({
    intervalMs: 500,
    retries: 10,
    tick: () => {
      const textarea = document.querySelector<HTMLTextAreaElement>('textarea[autofocus]');
      if (!textarea) return false;

      ctx.fillTextareaAndDispatchInput(textarea, params.prompt);

      if (params.autoSubmit) {
        setTimeout(() => {
          const buttons = textarea.parentElement?.querySelectorAll<HTMLButtonElement>('button');
          const submitButton = buttons?.[buttons.length - 1];
          submitButton?.click();
        }, 500);
      }

      return true;
    },
  });

  return true;
}
