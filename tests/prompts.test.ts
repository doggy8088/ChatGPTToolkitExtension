import { describe, expect, test } from 'bun:test';
import {
  applyPromptArgs,
  getLocaleDefaultFollowUpPrompts,
  getReadyPromptsSignature,
  loadCustomPrompts,
  selectReadyPrompts,
} from '../src/content/prompts';
import { ensureHappyDom } from './utils/happyDom';

ensureHappyDom();

function installStorage(initial: Record<string, unknown>) {
  const store: Record<string, unknown> = { ...initial };
  const previous = (globalThis as { chrome?: unknown }).chrome;
  (globalThis as { chrome?: unknown }).chrome = {
    storage: {
      local: {
        get: (keys: string[], callback: (items: Record<string, unknown>) => void) => {
          callback(Object.fromEntries(keys.map((key) => [key, store[key]])));
        },
        set: (items: Record<string, unknown>, callback?: () => void) => {
          Object.assign(store, items);
          callback?.();
        },
      },
    },
  };
  return { store, restore: () => ((globalThis as { chrome?: unknown }).chrome = previous) };
}

describe('content prompts helpers', () => {
  test('applyPromptArgs replaces every {{args}} placeholder', () => {
    expect(applyPromptArgs('A {{args}} B {{args}}', 'x')).toBe('A x B x');
  });

  test('applyPromptArgs appends the args when the template has no placeholder', () => {
    expect(applyPromptArgs('Summarize:\n', 'text')).toBe('Summarize:\ntext');
    expect(applyPromptArgs('Summarize:\n', '')).toBe('Summarize:\n');
  });

  test('selectReadyPrompts splits groups and skips disabled or incomplete prompts', () => {
    const prompts = [
      { title: 'a', prompt: 'A', initial: true },
      { title: 'b', prompt: 'B' },
      { title: 'c', prompt: 'C', enabled: false },
      { title: '', prompt: 'D' },
      { title: 'e', prompt: '' },
      null as unknown as { title: string; prompt: string },
      { title: 'f', prompt: 'F', enabled: true, initial: false },
    ];

    expect(selectReadyPrompts(prompts, true).map((p) => p.title)).toEqual(['a']);
    expect(selectReadyPrompts(prompts, false).map((p) => p.title)).toEqual(['b', 'f']);
    expect(selectReadyPrompts(null, false)).toEqual([]);
  });

  test('getReadyPromptsSignature changes when a rendered field changes', () => {
    const base = [{ title: 'a', prompt: 'A' }];
    expect(getReadyPromptsSignature(base)).toBe(getReadyPromptsSignature([{ title: 'a', prompt: 'A' }]));
    expect(getReadyPromptsSignature(base)).not.toBe(
      getReadyPromptsSignature([{ title: 'a', prompt: 'A', autoSubmit: true }])
    );
  });

  test('getLocaleDefaultFollowUpPrompts follows the UI language', () => {
    expect(getLocaleDefaultFollowUpPrompts('zh-TW')[0].title).toBe('舉例說明');
    expect(getLocaleDefaultFollowUpPrompts('ja')[0].title).toBe('例えば');
    expect(getLocaleDefaultFollowUpPrompts('en-US')[0].title).toBe('More Examples');
    expect(getLocaleDefaultFollowUpPrompts(undefined)).toEqual([]);
  });

  test('loadCustomPrompts applies the review-prompt migration once', async () => {
    const custom = [{ enabled: true, title: 'x', prompt: 'X' }];
    const { store, restore } = installStorage({ 'chatgpttoolkit.customPrompts': custom });

    try {
      const first = await loadCustomPrompts();
      expect(first?.map((p) => p.title)).toEqual(['x', '評論']);
      expect(store['chatgpttoolkit.promptMigrations']).toEqual(['add-review-prompt']);

      // The user deletes the review prompt; it must not come back.
      store['chatgpttoolkit.customPrompts'] = custom;
      const second = await loadCustomPrompts();
      expect(second).toEqual(custom);
    } finally {
      restore();
    }
  });

  test('loadCustomPrompts returns null when nothing was ever saved', async () => {
    localStorage.clear();
    const { restore } = installStorage({});
    try {
      expect(await loadCustomPrompts()).toBeNull();
    } finally {
      restore();
    }
  });
});
