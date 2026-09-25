# Repository Guidelines

## Project Structure and Module Organization
This is a Chrome extension (MV3) with TypeScript sources.
- `src/options/`: Options page UI and storage services; its `utils/` (i18n, theme, DOM) and `ui/` helpers (theme switch, toasts, icons) are shared with the link builder.
- `src/linkBuilder/`: Prompt link builder page (`link-builder.html`), opened from the toolbar button's right-click menu.
- `src/background/`: Service worker (toolbar button, context menu), built to `scripts/background.js`.
- `styles/common.css`: Design tokens and components shared by `options.html` and `link-builder.html`, loaded directly (no build step) so the pages keep their styles when `dist/` is outdated; page-specific styles stay inline in each page.
- `src/content/`: Content script entry (`index.ts`), shared prompt helpers (`prompts.ts`) and per-site modules in `sites/`.
- `src/shared/`: Code shared by the content scripts and the extension pages (e.g. `promptMigrations.ts`, the `contentUtils.d.ts` codec types).
- `scripts/`: Committed build output (`content.js`, `background.js`, `link-builder.js`) plus vendored libraries (markmap, d3).
- `dist/`: Untracked build output (`options.js`, `theme-init.js`). New page assets belong in `scripts/` or `styles/`, so a checkout that has not been rebuilt still works (a test checks the pages' references).
- `tests/`: Bun and Node unit tests.
- `_locales/`, `images/`, `manifest.json`, `options.html`, `link-builder.html`: extension assets and configuration.
- `scripts/content-utils.js`: URL prompt codec used by the content script and `link-builder.html`, so generated links always decode the same way; keep load order (utils before content) in `manifest.json` and in `link-builder.html`.

## Build, Test, and Development Commands
- `bun run build`: Build the pages, content script and service worker to `dist/` and `scripts/`.
- `bun run typecheck`: `tsc --noEmit` for `src/`.
- `bun test`: Run Bun tests in `tests/`.
- `bun run test:js`: Run Node tests for `scripts/content-utils.js` only (CommonJS).
- `bun run validate`: Typecheck + tests + build.
Always run `bun run build` after any code change.
For manual testing, load the repository root as an unpacked extension in Chrome.

## Coding Style and Naming Conventions
- TypeScript uses 2-space indentation and semicolons; follow existing file formatting.
- Use `camelCase` for functions/variables and `PascalCase` for classes and most files under `src/options/` (e.g., `OptionsController.ts`).
- Content script modules live in `src/content/sites/` with lowercase filenames.
- Avoid inline event handlers; prefer `addEventListener` and `Object.prototype.hasOwnProperty.call` for prompt objects.
- `scripts/content.js`, `scripts/background.js` and `scripts/link-builder.js` are committed build output that also bundles code from `src/options` and `src/shared`: after any change under `src/`, run `bun run build` and commit the rebuilt files.

## Content Script Notes
- Domain support is modular: add a new file under `src/content/sites/`, update `manifest.json` matches, and describe the site's link features in `src/linkBuilder/sites.ts` (a test checks the hosts match).
- DOM selectors change often; keep selectors scoped and test on target sites.
- Do not remove existing match patterns (e.g., `chat.openai.com`, `chatgpt.com`) without confirmation.

## Testing Guidelines
- Primary tests use Bun (`tests/*.test.ts`); content-utils also has a Node test at `tests/content-utils.test.js`.
- No formal coverage target; add tests for changes to prompt parsing, storage migrations, or shared helpers.
- Prefer `bun test` for routine validation.

## Release and CI
- `.github/workflows/publish.yml` creates a GitHub Release and uploads a zip on pushes to `main`, unless the tag for the `manifest.json` version already exists (a manual run always publishes).
- Release tags follow `vX.Y.Z`, derived from `manifest.json`.
- Before release, update `manifest.json` and `CHANGELOG.md`.
- The zip file list is spelled out in both `publish.yml` and `tools/pack-release.mjs`; a new top-level page or folder must be added to both.

## Commit and Pull Request Guidelines
- Recent history follows Conventional Commits (feat/fix/refactor/chore/docs/ci), e.g. `feat(content): add initial buttons`.
- Keep commits scoped and descriptive.
- PRs should include: a short summary, test commands run, and screenshots for UI changes (options page, link builder or in-page buttons).
- Link related issues when applicable.
