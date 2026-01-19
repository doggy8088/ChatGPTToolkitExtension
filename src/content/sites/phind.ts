import type { ContentContext } from '../context';

export function initPhind(ctx: ContentContext) {
  if (location.hostname !== 'www.phind.com') return false;

  const params = ctx.refreshParamsFromHash();
  if (!params?.prompt) return true;

  ctx.startRetryInterval({
    intervalMs: 500,
    retries: 10,
    tick: () => {
      const textarea = document.querySelector<HTMLTextAreaElement>('textarea[name="q"]');
      if (!textarea) return false;

      ctx.fillTextareaAndDispatchInput(textarea, params.prompt);

      if (params.autoSubmit) {
        textarea.form?.submit();
      }

      return true;
    },
  });

  return true;
}
