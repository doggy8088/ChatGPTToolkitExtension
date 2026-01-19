import { describe, test, expect, beforeEach } from 'bun:test';
import { PromptsStorageService } from '../src/options/services/PromptsStorageService';
import { DEFAULT_PROMPTS, type CustomPrompt } from '../src/options/models/CustomPrompt';
import { ensureHappyDom } from './utils/happyDom';

// Register DOM globals once across the test suite.
ensureHappyDom();

const STORAGE_KEY = 'chatgpttoolkit.customPrompts';

function createChromeStorageMock() {
  let store: Record<string, unknown> = {};

  const storageArea = {
    get(keys: string[] | string, callback: (items: Record<string, unknown>) => void) {
      const keyList = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const key of keyList) result[key] = store[key];
      callback(result);
    },
    set(items: Record<string, unknown>, callback?: () => void) {
      store = { ...store, ...items };
      callback?.();
    },
    clear(callback?: () => void) {
      store = {};
      callback?.();
    }
  };

  (globalThis as any).chrome = {
    storage: {
      local: storageArea
    }
  };

  return {
    clear: () => storageArea.clear(),
    getRaw: () => store
  };
}

function getReviewPrompt() {
  const review = DEFAULT_PROMPTS.find((prompt) => prompt.initial === true && prompt.title === '評論');
  if (!review) {
    throw new Error('Missing default review prompt in DEFAULT_PROMPTS');
  }
  return review;
}

describe('PromptsStorageService', () => {
  const chromeStorage = createChromeStorageMock();

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    chromeStorage.clear();
  });

  describe('loadPrompts', () => {
    test('should return default prompts when localStorage is empty', () => {
      return (async () => {
        const prompts = await PromptsStorageService.loadPrompts();
        expect(prompts).toEqual(DEFAULT_PROMPTS);

        const raw = chromeStorage.getRaw()[STORAGE_KEY];
        expect(raw).toEqual(DEFAULT_PROMPTS);
      })();
    });

    test('should load prompts from localStorage', () => {
      return (async () => {
        const testPrompts: CustomPrompt[] = [
          { enabled: true, title: 'Test', prompt: 'Test prompt' }
        ];
        await (globalThis as any).chrome.storage.local.set({ [STORAGE_KEY]: testPrompts });

        const loaded = await PromptsStorageService.loadPrompts();
        expect(loaded).toEqual([...testPrompts, getReviewPrompt()]);
      })();
    });

    test('should migrate prompts from legacy localStorage', () => {
      return (async () => {
        const testPrompts: CustomPrompt[] = [
          { enabled: true, title: 'Legacy', prompt: 'Legacy prompt' }
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(testPrompts));

        const loaded = await PromptsStorageService.loadPrompts();
        expect(loaded).toEqual([...testPrompts, getReviewPrompt()]);
        expect(chromeStorage.getRaw()[STORAGE_KEY]).toEqual([...testPrompts, getReviewPrompt()]);
      })();
    });

    test('should fallback to default prompts for invalid legacy JSON', () => {
      return (async () => {
        localStorage.setItem(STORAGE_KEY, 'invalid json');

        const prompts = await PromptsStorageService.loadPrompts();
        expect(prompts).toEqual(DEFAULT_PROMPTS);
      })();
    });
  });

  describe('savePrompts', () => {
    test('should save prompts to localStorage', () => {
      return (async () => {
        const testPrompts: CustomPrompt[] = [
          { enabled: true, title: 'Test', prompt: 'Test prompt' }
        ];

        const result = await PromptsStorageService.savePrompts(testPrompts);
        expect(result).toBe(true);

        expect(chromeStorage.getRaw()[STORAGE_KEY]).toEqual(testPrompts);
        expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(testPrompts));
      })();
    });

    test('should return true on successful save', () => {
      return (async () => {
        const testPrompts: CustomPrompt[] = [];
        const result = await PromptsStorageService.savePrompts(testPrompts);
        expect(result).toBe(true);
      })();
    });
  });

  describe('exportPrompts', () => {
    test('should export prompts as formatted JSON string', () => {
      const testPrompts: CustomPrompt[] = [
        { enabled: true, title: 'Test', prompt: 'Test prompt' }
      ];

      const exported = PromptsStorageService.exportPrompts(testPrompts);
      expect(exported).toContain('"title": "Test"');
      expect(exported).toContain('"prompt": "Test prompt"');
      expect(JSON.parse(exported)).toEqual(testPrompts);
    });
  });

  describe('importPrompts', () => {
    test('should import valid prompts JSON', () => {
      const testPrompts: CustomPrompt[] = [
        { enabled: true, title: 'Test', prompt: 'Test prompt' }
      ];
      const jsonString = JSON.stringify(testPrompts);

      const imported = PromptsStorageService.importPrompts(jsonString);
      expect(imported).toEqual(testPrompts);
    });

    test('should throw error for non-array JSON', () => {
      const jsonString = '{"not": "an array"}';

      expect(() => PromptsStorageService.importPrompts(jsonString)).toThrow('必須是陣列格式');
    });

    test('should throw error for prompts without title', () => {
      const invalidPrompts = [{ prompt: 'Test' }];
      const jsonString = JSON.stringify(invalidPrompts);

      expect(() => PromptsStorageService.importPrompts(jsonString)).toThrow('必須包含 title 和 prompt');
    });

    test('should throw error for prompts without prompt field', () => {
      const invalidPrompts = [{ title: 'Test' }];
      const jsonString = JSON.stringify(invalidPrompts);

      expect(() => PromptsStorageService.importPrompts(jsonString)).toThrow('必須包含 title 和 prompt');
    });

    test('should accept prompts with optional fields', () => {
      const validPrompts: CustomPrompt[] = [
        {
          enabled: true,
          initial: true,
          svgIcon: '📝',
          title: 'Test',
          altText: 'Test alt',
          prompt: 'Test prompt',
          autoPaste: true,
          autoSubmit: true
        }
      ];
      const jsonString = JSON.stringify(validPrompts);

      const imported = PromptsStorageService.importPrompts(jsonString);
      expect(imported).toEqual(validPrompts);
    });
  });
});
