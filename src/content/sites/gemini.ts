import type { ContentContext } from '../context';

export function initGemini(ctx: ContentContext) {
  if (location.hostname !== 'gemini.google.com') return false;

  ctx.refreshParamsFromHash();
  const { state, debug } = ctx;

  if (!state.prompt && !state.tool) return true;

  let toolImageClicked = false;
  let promptFilled = false;
  let pastingGeminiImage = false;
  let geminiImagePasteAttempted = false;
  let submitted = false;

  const tryClickImageToolButton = () => {
    if (toolImageClicked) return;
    if (state.tool !== 'image') return;

    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
    for (const button of buttons) {
      const textContent = (button.textContent || '').replace(/\s+/g, ' ').trim();
      if (!textContent) continue;

      const isMatch =
        textContent.includes('生成圖片') ||
        textContent.toLowerCase().includes('create image');

      if (!isMatch) continue;
      if (button.disabled) continue;

      toolImageClicked = true;
      button.focus();
      button.click();
      return;
    }
  };

  ctx.startRetryInterval({
    intervalMs: 500,
    retries: 30,
    tick: async () => {
      tryClickImageToolButton();

      const textarea = document.querySelector<HTMLElement>('chat-window .textarea');
      if (textarea && state.prompt && !promptFilled) {
        ctx.fillContentEditableWithParagraphs(textarea, state.prompt);
        promptFilled = true;
      }

      if (textarea && state.pasteImage && !pastingGeminiImage && !geminiImagePasteAttempted) {
        pastingGeminiImage = true;
        geminiImagePasteAttempted = true;
        if (debug) console.log('Gemini: 貼上圖片中');
        await ctx.delay(300);
        await ctx.fetchClipboardImageAndSimulatePaste(textarea);
        if (debug) console.log('Gemini: 貼上圖片完成');
        pastingGeminiImage = false;
      }

      const button = document.querySelector<HTMLButtonElement>('chat-window button.send-button');
      const canSubmit =
        button &&
        !button.disabled &&
        promptFilled &&
        state.autoSubmit &&
        !submitted &&
        !pastingGeminiImage &&
        (!state.pasteImage || geminiImagePasteAttempted) &&
        (state.tool !== 'image' || toolImageClicked);

      if (canSubmit) {
        submitted = true;
        button.focus();
        setTimeout(() => {
          button.click();
        }, 500);
      }

      const done =
        (!state.prompt || promptFilled) &&
        (!state.pasteImage || geminiImagePasteAttempted) &&
        (!state.autoSubmit || submitted) &&
        (state.tool !== 'image' || toolImageClicked);

      if (done) {
        ctx.clearHash();
      }

      return done;
    },
  });

  return true;
}
