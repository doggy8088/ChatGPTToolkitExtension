import { createContentContext } from './context';
import { initClaude } from './sites/claude';
import { initGemini } from './sites/gemini';
import { initGroq } from './sites/groq';
import { initPerplexity } from './sites/perplexity';
import { initPhind } from './sites/phind';
import { initChatGPT } from './sites/chatgpt';

function runContentScript() {
  const ctx = createContentContext();
  if (!ctx) return;

  if (initGemini(ctx)) return;
  if (initClaude(ctx)) return;
  if (initPhind(ctx)) return;
  if (initPerplexity(ctx)) return;
  if (initGroq(ctx)) return;

  initChatGPT(ctx);
}

runContentScript();
