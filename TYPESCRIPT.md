# TypeScript Development Guide

This project now uses TypeScript with Bun for building and testing.

## Project Structure

```
src/
└── options/
    ├── models/          # Data models and types
    │   └── CustomPrompt.ts
    ├── services/        # Business logic services
    │   └── PromptsStorageService.ts
    ├── ui/              # UI components
    │   ├── OptionsUIController.ts
    │   └── PromptRenderer.ts
    ├── utils/           # Utility functions
    │   └── helpers.ts
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

This compiles TypeScript files from `src/` to `dist/options.js`.

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
`src/options/services/PromptsStorageService.ts` - Handles all localStorage operations for custom prompts.

### UI Controllers
- `src/options/ui/OptionsUIController.ts` - Manages UI state and user feedback
- `src/options/ui/PromptRenderer.ts` - Renders prompt list items with proper HTML escaping

### Utils
`src/options/utils/helpers.ts` - Shared utility functions:
- `getProperty()` - Safe property access with defaults
- `escapeHtml()` - XSS protection
- `downloadFile()` - File download helper

### Main Controller
`src/options/OptionsController.ts` - Orchestrates all components and handles user interactions.

## Testing

Tests are located in `tests/` directory:
- `helpers.test.ts` - Tests for utility functions
- `PromptsStorageService.test.ts` - Tests for storage service
- `content-utils.test.js` - Legacy JavaScript tests (still using Node.js test runner)

All TypeScript tests use Bun's built-in test runner with happy-dom for DOM simulation.

## Build Output

The build process creates:
- `dist/options.js` - Bundled JavaScript file for the browser
- `dist/options.js.map` - Source map for debugging

## Type Safety

The project uses strict TypeScript configuration:
- Strict null checks
- No unused locals/parameters
- No implicit returns
- No fallthrough cases in switch statements

All DOM types are provided by `@types/chrome` for Chrome extension APIs.
