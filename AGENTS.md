# Repository Guidelines

## Project Structure and Module Organization
This is a Chrome extension (MV3) with TypeScript sources and prebuilt content assets.
- `src/options/`: TypeScript for the options page UI and storage services.
- `src/content/`: TypeScript content script entry (`index.ts`) and per-domain modules in `sites/`.
- `scripts/`: Built content script output (`content.js`) plus vendored libraries (markmap, d3). Do not edit generated files here.
- `dist/`: Built options bundle (`options.js`).
- `tests/`: Bun and Node unit tests.
- `_locales/`, `images/`, `manifest.json`, `options.html`: extension assets and configuration.
- `scripts/content-utils.js`: shared helper used by the content script; keep load order in `manifest.json` (utils before content).

## Build, Test, and Development Commands
- `bun run build`: Bundle options and content scripts. Outputs `dist/options.js` and `scripts/content.js`.
- `bun run typecheck`: Run `tsc --noEmit` on `src/`.
- `bun test`: Run Bun tests in `tests/*.test.ts` and `tests/content-utils.test.js`.
- `bun run test:js`: Run Node tests for `scripts/content-utils.js` only (CommonJS).
- `bun run validate`: Typecheck + tests + build.
For manual testing, load the repository root as an unpacked extension in Chrome.

## Coding Style and Naming Conventions
- TypeScript uses 2-space indentation and semicolons; follow existing file formatting.
- Use `camelCase` for functions/variables and `PascalCase` for classes and most files under `src/options/` (e.g., `OptionsController.ts`).
- Content script modules live in `src/content/sites/` with lowercase filenames.
- Do not edit `scripts/content.js` directly; change `src/content` and rebuild.

## Testing Guidelines
- Primary tests use Bun (`tests/*.test.ts`); content-utils also has a Node test at `tests/content-utils.test.js`.
- No formal coverage target; add tests for changes to prompt parsing, storage migrations, or shared helpers.
- Prefer `bun test` for routine validation.

## Commit and Pull Request Guidelines
- Recent history follows Conventional Commits, e.g. `feat(content): add initial buttons`.
- Keep commits scoped and descriptive.
- PRs should include: a short summary, test commands run, and screenshots for UI changes (options page or in-page buttons).
- Link related issues when applicable.
