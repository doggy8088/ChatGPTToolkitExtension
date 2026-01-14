import type { CustomPrompt } from '../models/CustomPrompt';
import { DEFAULT_PROMPTS } from '../models/CustomPrompt';

const STORAGE_KEY = 'chatgpttoolkit.customPrompts';

/**
 * Service for managing custom prompts in extension storage.
 *
 * Notes:
 * - `localStorage` is per-origin, so `options.html` cannot read/write `chatgpt.com` localStorage.
 * - `chrome.storage.local` is shared between options pages and content scripts.
 */
export class PromptsStorageService {
  private static cloneDefaultPrompts(): CustomPrompt[] {
    return DEFAULT_PROMPTS.map(prompt => ({ ...prompt }));
  }

  private static getChromeStorageLocal(): chrome.storage.StorageArea | null {
    try {
      return typeof chrome !== 'undefined' && chrome.storage?.local ? chrome.storage.local : null;
    } catch {
      return null;
    }
  }

  private static async chromeGet(key: string): Promise<unknown | undefined> {
    const storage = this.getChromeStorageLocal();
    if (!storage) return undefined;

    return await new Promise((resolve) => {
      storage.get([key], (result) => {
        const lastError = chrome?.runtime?.lastError;
        if (lastError) {
          console.error('chrome.storage.local.get failed:', lastError);
          resolve(undefined);
          return;
        }

        resolve((result as Record<string, unknown>)[key]);
      });
    });
  }

  private static async chromeSet(key: string, value: unknown): Promise<boolean> {
    const storage = this.getChromeStorageLocal();
    if (!storage) return false;

    return await new Promise((resolve) => {
      storage.set({ [key]: value }, () => {
        const lastError = chrome?.runtime?.lastError;
        if (lastError) {
          console.error('chrome.storage.local.set failed:', lastError);
          resolve(false);
          return;
        }

        resolve(true);
      });
    });
  }

  private static readLegacyLocalStoragePrompts(): CustomPrompt[] | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? (parsed as CustomPrompt[]) : null;
    } catch {
      return null;
    }
  }

  /**
   * Load prompts from `chrome.storage.local` with automatic migration:
   * - If storage is empty, migrate from legacy `options.html` localStorage (if present).
   * - Otherwise seed defaults.
   */
  static async loadPrompts(): Promise<CustomPrompt[]> {
    const stored = await this.chromeGet(STORAGE_KEY);
    if (Array.isArray(stored)) {
      return stored as CustomPrompt[];
    }

    const legacy = this.readLegacyLocalStoragePrompts();
    if (legacy) {
      await this.savePrompts(legacy);
      return legacy;
    }

    const defaults = this.cloneDefaultPrompts();
    await this.savePrompts(defaults);
    return defaults;
  }

  /**
   * Save prompts to `chrome.storage.local` (and mirror into `options.html` localStorage for rollback safety).
   */
  static async savePrompts(prompts: CustomPrompt[]): Promise<boolean> {
    try {
      const success = await this.chromeSet(STORAGE_KEY, prompts);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
      } catch {
        // ignore
      }
      return success;
    } catch (error) {
      console.error('Failed to save prompts:', error);
      return false;
    }
  }

  /**
   * Export prompts as JSON string
   */
  static exportPrompts(prompts: CustomPrompt[]): string {
    return JSON.stringify(prompts, null, 2);
  }

  /**
   * Import prompts from JSON string
   */
  static importPrompts(jsonString: string): CustomPrompt[] {
    const imported = JSON.parse(jsonString);

    if (!Array.isArray(imported)) {
      throw new Error('匯入的資料必須是陣列格式');
    }

    for (const item of imported) {
      if (!item.title || !item.prompt) {
        throw new Error('每個提示必須包含 title 和 prompt 欄位');
      }
    }

    return imported as CustomPrompt[];
  }
}
