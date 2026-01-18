import type { ContentContext } from '../context';

export function initGroq(ctx: ContentContext) {
  if (location.hostname !== 'groq.com') return false;

  const params = ctx.refreshParamsFromHash();
  if (!params?.prompt) return true;

  ctx.startRetryInterval({
    intervalMs: 500,
    retries: 10,
    tick: () => {
      const textarea = document.getElementById('chat') as HTMLTextAreaElement | null;
      if (!textarea) return false;

      ctx.fillTextareaAndDispatchInput(textarea, params.prompt);

      if (params.autoSubmit) {
        setTimeout(() => {
          const btn = textarea.parentElement?.querySelector<HTMLButtonElement>('button');
          btn?.click();
        }, 2000);
      }

      return true;
    },
  });

  return true;
}
