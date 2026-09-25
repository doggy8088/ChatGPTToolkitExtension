# TypeScript Development Guide

This project now uses TypeScript with Bun for building and testing.

## Project Structure

```
src/
├── background/
│   └── index.ts              # Service worker: toolbar button, "open link builder" context menu
├── shared/
│   ├── contentUtils.d.ts     # Types of scripts/content-utils.js (content script + link builder)
│   └── promptMigrations.ts   # One-time stored-prompt migrations (options page + content scripts)
├── linkBuilder/
│   ├── sites.ts              # AI services, supported hosts and their link features, custom URL checks
│   ├── promptLink.ts         # Prompt / site search / Markdown link encoding
│   ├── linkImport.ts         # Pasted links and old web builder share links back to settings
│   ├── state.ts              # Page state, persistence, derived view (resolveLink)
│   ├── templates.ts          # Prompt templates per language
│   └── LinkBuilderController.ts  # Page controller (scripts/link-builder.js)
├── content/
│   ├── index.ts              # Content script entry, picks the site module
│   ├── context.ts            # Shared helpers (URL params, editor filling, retries)
│   ├── editorText.ts         # Read composer text while keeping line breaks
│   ├── prompts.ts            # Load/select prompts, {{args}} resolution (ChatGPT + Gemini)
│   └── sites/                # One module per supported site
└── options/
    ├── models/               # Data models and types
    │   └── CustomPrompt.ts
    ├── services/             # Storage (chrome.storage.local), import/export
    │   └── PromptsStorageService.ts
    ├── ui/                   # UI components
    │   ├── OptionsUIController.ts  # Toasts, confirm dialog
    │   ├── PromptRenderer.ts       # Prompt cards and empty states
    │   ├── ThemeSwitcher.ts        # System / light / dark switch
    │   └── icons.ts                # Icon sprite helper
    ├── utils/
    │   ├── dom.ts            # element(), byId(), insertTextAtCaret(), shortcut labels (options page + link builder)
    │   ├── helpers.ts        # downloadFile(), getLocalStorage()
    │   ├── i18n.ts           # chrome.i18n wrapper, data-i18n page localization
    │   ├── promptIcon.ts     # Emoji/text icons, sanitized SVG icons
    │   ├── promptList.ts     # Pure prompt-list operations (groups, move, form mapping)
    │   └── theme.ts          # Theme preference parsing/persistence
    ├── themeInit.ts          # Applies the stored theme before first paint (dist/theme-init.js)
    └── OptionsController.ts  # Main controller
```

## Prerequisites

- [Bun](https://bun.sh/) installed
- Node.js >= 20 (for legacy test support)

## Installation

```bash
bun install
```

## Development Commands

### Build TypeScript

```bash
bun run build
```

This compiles `src/options/` to `dist/options.js` and `dist/theme-init.js`, and `src/linkBuilder/`, `src/content/` and `src/background/` to the committed `scripts/link-builder.js`, `scripts/content.js` and `scripts/background.js`. The shared stylesheet `styles/common.css` (used by options.html and link-builder.html) needs no build step.

### Run Tests

```bash
# Run all tests (TypeScript + JavaScript)
bun test

# Run only TypeScript tests
bun test tests/*.test.ts

# Run only legacy JavaScript tests
bun run test:js
```

### Type Checking

```bash
bun run typecheck
```

### Validate Everything

```bash
bun run validate
```

This runs type checking, tests, and build in sequence.

## Module Structure

### Models
`src/options/models/CustomPrompt.ts` - Defines the CustomPrompt interface and DEFAULT_PROMPTS configuration.

### Services
`src/options/services/PromptsStorageService.ts` - Loads/saves prompts in `chrome.storage.local` (shared with the content scripts), runs pending migrations, validates imports.

### Shared
`src/shared/promptMigrations.ts` - Stored-prompt migrations. Each migration runs once; applied ids are kept under `chatgpttoolkit.promptMigrations`, so a default prompt the user deletes stays deleted.

### UI Controllers
- `src/options/ui/OptionsUIController.ts` - Toast notifications and the confirm dialog
- `src/options/ui/PromptRenderer.ts` - Builds prompt cards with DOM APIs (no HTML strings)
- `src/options/ui/ThemeSwitcher.ts` - System / light / dark theme switch

### Utils
- `src/options/utils/promptList.ts` - Pure functions over the prompt list (groups, reorder, form mapping)
- `src/options/utils/promptIcon.ts` - Renders prompt icons; SVG markup is sanitized
- `src/options/utils/theme.ts` - Theme preference parsing and persistence
- `src/options/utils/helpers.ts` - `downloadFile()`, `getLocalStorage()`
- `src/options/utils/dom.ts` - `element()`, `byId()`, `insertTextAtCaret()`, shortcut labels (shared with the link builder)
- `src/options/utils/i18n.ts` - `chrome.i18n` wrapper and `applyPageI18n()` for the `data-i18n` attributes

### Main Controller
`src/options/OptionsController.ts` - Orchestrates all components and handles user interactions.

### Link Builder
`link-builder.html` (opened from the toolbar button's right-click menu) turns a prompt into a bookmark, a Markdown link and a Chrome site search shortcut. It loads `scripts/content-utils.js` before its bundle, so links are encoded with the same codec the content script decodes them with. The page reuses the options page's i18n, theme and toast helpers.

## Testing

Tests are located in `tests/` directory:
- `helpers.test.ts` - Tests for utility functions
- `PromptsStorageService.test.ts` - Tests for storage service
- `linkBuilder.test.ts` - Link encoding round-trips through the content script's parser, sites, import, state
- `linkBuilderPage.test.ts` / `optionsPage.test.ts` - Page smoke tests against the real HTML
- `pageAssets.test.ts` - The pages only load committed files (plus the existing `dist/` bundles)
- `dom.test.ts` - Shared DOM helpers
- `background.test.ts` - Service worker context menu
- `content-utils.test.js` - Legacy JavaScript tests (still using Node.js test runner)

All TypeScript tests use Bun's built-in test runner with happy-dom for DOM simulation.

## Build Output

The build process creates:
- `dist/options.js` - Options page bundle (ES module)
- `dist/theme-init.js` - Tiny classic script loaded in `<head>` to apply the saved theme before first paint
- `scripts/content.js` - Content script bundle (IIFE)
- `scripts/background.js` - Service worker bundle (IIFE)
- `scripts/link-builder.js` - Link builder page bundle (ES module)
- `*.map` - Source maps for debugging

## Type Safety

The project uses strict TypeScript configuration:
- Strict null checks
- No unused locals/parameters
- No implicit returns
- No fallthrough cases in switch statements

All DOM types are provided by `@types/chrome` for Chrome extension APIs.
