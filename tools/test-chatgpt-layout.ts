// Run with an active Ego Lite task space: bun tools/test-chatgpt-layout.ts <space-id>
// Happy DOM cannot resolve container units; check actual geometry in Chromium.
import { ensureHappyDom } from '../tests/utils/happyDom';
import { applyChatGPTWidth, CHATGPT_LAYOUT_STYLE_ID } from '../src/content/sites/chatgptLayout';
import { spawnSync } from 'node:child_process';

const spaceId = Number(process.argv[2]);
if (!Number.isSafeInteger(spaceId) || spaceId <= 0) {
  throw new Error('Provide the active Ego Lite task space ID.');
}
ensureHappyDom();
const styles: Record<string, string> = {};
for (const width of ['60', '80', '100', 'default'] as const) {
  applyChatGPTWidth(width);
  styles[width] = document.getElementById(CHATGPT_LAYOUT_STYLE_ID)?.textContent ?? '';
}

// Minimal app-shell structure captured on 2026-10-21. Opening the summary
// translates BOTH full-width containers; it does not reduce their widths.
const fixture = `
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; }
    #shell { position: relative; }
    main { margin-left: var(--sidebar); }
    .shifted { container-type: inline-size; transform: translateX(calc(-1 * var(--thread-wide-block-inline-shift, 0px))); }
    .wrapper { --thread-content-max-width: 768px; width: 100%; max-width: calc(var(--thread-content-max-width) + 40px); padding-inline: 20px; margin-inline: auto; }
    form { width: 100%; }
    #pane { position: absolute; top: 0; right: 0; width: var(--pane); }
  </style>
  <div id="shell">
    <main data-app-shell-main-surface="browser">
      <div class="shifted">
        <div class="wrapper [--thread-content-max-width]">
          <div data-thread-find-target="conversation">Conversation</div>
        </div>
      </div>
      <div class="shifted">
        <div class="wrapper [--thread-content-max-width]">
          <form data-chatgpt-composer>Ask ChatGPT</form>
        </div>
      </div>
    </main>
    <aside id="pane">Scheduled / Outputs</aside>
  </div>
  <style id="overrides"></style>`;

const script = `
const task = await takeOverTaskSpace(${spaceId});
const page = await task.newPage();
try {
  await page.goto('about:blank');
  const results = await page.evaluate(({ fixture, styles }) => {
    document.body.innerHTML = fixture;
    const results = [];
    for (const shellWidth of [900, 1300, 2048]) {
      for (const sidebar of [52, 340]) {
        for (const pane of [0, 308]) {
          const shell = document.getElementById('shell');
          shell.style.cssText = 'width:' + shellWidth + 'px;--sidebar:' + sidebar + 'px;--pane:' + pane + 'px';
          for (const shifted of document.querySelectorAll('.shifted')) {
            if (pane) shifted.style.setProperty('--thread-wide-block-inline-shift', pane / 2 + 'px');
            else shifted.style.removeProperty('--thread-wide-block-inline-shift');
          }
          for (const width of ['60', '80', '100', 'default']) {
            document.getElementById('overrides').textContent = styles[width];
            const main = document.querySelector('main').getBoundingClientRect();
            const available = main.width - pane;
            const expected = width === 'default' ? Math.min(768, main.width - 40)
              : Math.min(available * Number(width) / 100, available - 32, main.width - 40);
            const rects = [...document.querySelectorAll('[data-thread-find-target="conversation"], form')]
              .map(e => e.getBoundingClientRect());
            const pass = rects.every(r => Math.abs(r.width - expected) < 0.1 &&
              (width === 'default' || (r.left >= main.left + 15.9 &&
                r.right <= main.right - pane - 15.9)));
            results.push({ shellWidth, sidebar, pane, width, expected, pass,
              measured: rects.map(r => ({ left: r.left, right: r.right, width: r.width })) });
          }
        }
      }
    }
    return results;
  }, ${JSON.stringify({ fixture, styles })});
  const failures = results.filter(r => !r.pass);
  console.log(JSON.stringify({ cases: results.length, failures }, null, 2));
  if (failures.length) throw new Error('Conversation/composer geometry regression');
} finally {
  await page.close();
}
`;
const child = spawnSync('ego-browser', ['nodejs'], {
  input: script,
  stdio: ['pipe', 'inherit', 'inherit'],
});
if (child.error) throw child.error;
process.exitCode = child.status ?? 1;
