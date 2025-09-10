# Copilot instructions for this repo

Manifest V3 Chrome/Edge extension. Injects one content script to AI sites (ChatGPT/chatgpt.com, Gemini, Claude, Phind, Perplexity, Groq) to auto-fill/submit prompts, optional clipboard image paste, follow-up buttons, and Markmap mindmaps.

## Architecture
- manifest.json: MV3; scripts order matters — d3, markmap-lib, markmap-view, then scripts/content.js; matches list covers all target sites.
- scripts/content.js: IIFE; branches by `location.hostname`; default branch is ChatGPT.
- URL params: `prompt`, `autoSubmit`, `pasteImage`; handles encodeURI/encodeURIComponent quirks, `+` → space, Base64Unicode (see `isBase64Unicode`, `b64DecodeUnicode`); clears hash via `history.replaceState`.
- ChatGPT input: `#prompt-textarea` is contentEditable; set `<p>text</p>`, dispatch `input`, focus, optionally click `button[data-testid*="send-button"]`.
- Buttons/observer: debounced `MutationObserver` rebuilds follow-up buttons under latest assistant block; skip GPTs editor and while a `stop-button` exists.
- Markmap: detect “Markdown” label → toggle button renders next code fence via `window.markmap`; adds `markmap-dark` on dark theme. Locales in `_locales/*`; default `zh_TW`.

## Dev workflows
- No build/tests; load folder as Unpacked Extension. Edit JS/JSON directly.
- Debug in page DevTools; `debug = true` in `content.js`; DOM drifts are common (see CHANGELOG) — fix selectors.
- Release: bump `manifest.json.version`, zip required files, upload (see PUBLISH.md, keep CHANGELOG):
  7z a ChatGPTToolkitExtension_vX.Y.Z.zip _locales images scripts CHANGELOG.md manifest.json README.md

## Patterns
- Branch per hostname with early `return` to avoid default path.
- Custom prompts from `localStorage['chatgpttoolkit.customPrompts']` with fields: `enabled`, `initial`, `title`, `altText`, `prompt`, `autoPaste`, `autoSubmit`.
- Feature toggles: `localStorage['chatgpttoolkit.featureToggle.autoContinue']` auto-clicks “Continue generating”. Dblclick user message to edit; Ctrl+Enter sends.
- Keep script injection order (d3/markmap before content.js) for mindmap to work.

## Integration notes
- Clipboard image paste needs Clipboard API support and user gesture/secure context; may fail on some sites.
- Selectors are fragile; use short retry loops like existing code.
- i18n: default follow-up buttons vary by `chrome.i18n.getUILanguage()` (zh-TW, ja, else en).

## Change checklist
- Re-test on all sites: auto-fill, auto-submit, pasteImage, auto-continue, dblclick edit, Ctrl+Enter, custom buttons, Markmap.
- Preserve URL parsing edge cases (encoding, plus, Base64Unicode, newline normalization).
- Verify `#custom-chatgpt-magic-box-buttons` show/hide rules (not generating, input present).

## Examples
- URL: https://chat.openai.com/chat/#autoSubmit=1&prompt=hello (also supports Base64Unicode for `prompt`).
- DevTools (custom prompts):
  ```js
  localStorage.setItem('chatgpttoolkit.customPrompts', JSON.stringify([
    { enabled: true, title: '總結', prompt: 'Please summarize:', autoPaste: true, autoSubmit: true }
  ]))
  ```

If anything is unclear (e.g., selectors for a site), report it so we can refine these rules.