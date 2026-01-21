# Repository Guidelines

## Project Structure and Module Organization
This is a Chrome extension (MV3) with TypeScript sources.
- `src/options/`: Options page UI and storage services.
- `src/content/`: Content script entry (`index.ts`) and per-site modules in `sites/`.
- `scripts/`: Built content script (`content.js`) plus vendored libraries (markmap, d3).
- `dist/`: Built options bundle (`options.js`).
- `tests/`: Bun and Node unit tests.
- `_locales/`, `images/`, `manifest.json`, `options.html`: extension assets and configuration.
- `scripts/content-utils.js`: shared helper used by the content script; keep load order in `manifest.json` (utils before content).

## Build, Test, and Development Commands
- `bun run build`: Build options + content to `dist/` and `scripts/`.
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
- Do not edit `scripts/content.js` directly; change `src/content` and rebuild.

## Content Script Notes
- Domain support is modular: add a new file under `src/content/sites/` and update `manifest.json` matches.
- DOM selectors change often; keep selectors scoped and test on target sites.
- Do not remove existing match patterns (e.g., `chat.openai.com`, `chatgpt.com`) without confirmation.

## Testing Guidelines
- Primary tests use Bun (`tests/*.test.ts`); content-utils also has a Node test at `tests/content-utils.test.js`.
- No formal coverage target; add tests for changes to prompt parsing, storage migrations, or shared helpers.
- Prefer `bun test` for routine validation.

## Release and CI
- `.github/workflows/publish.yml` creates a GitHub Release and uploads a zip on pushes to `main`.
- Release tags follow `vX.Y.Z`, derived from `manifest.json`.
- Before release, update `manifest.json` and `CHANGELOG.md`; the published zip includes `_locales`, `images`, `scripts`, `manifest.json`, `README.md`, and `CHANGELOG.md`.

## Commit and Pull Request Guidelines
- Recent history follows Conventional Commits (feat/fix/refactor/chore/docs/ci), e.g. `feat(content): add initial buttons`.
- Keep commits scoped and descriptive.
- PRs should include: a short summary, test commands run, and screenshots for UI changes (options page or in-page buttons).
- Link related issues when applicable.
