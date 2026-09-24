import type { CustomPrompt } from '../models/CustomPrompt';
import { DEFAULT_PROMPTS } from '../models/CustomPrompt';
import { getMessage } from '../utils/i18n';
import {
  ALL_PROMPT_MIGRATION_IDS,
  PROMPT_MIGRATIONS_KEY,
  applyPendingPromptMigrations,
} from '../../shared/promptMigrations';
import { clonePrompts } from '../utils/promptList';

/** Storage key shared with the content scripts. The stored value is an array of `CustomPrompt`. */
export const PROMPTS_STORAGE_KEY = 'chatgpttoolkit.customPrompts';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/**
 * Service for managing custom prompts in extension storage.
 *
 * Notes:
 * - `localStorage` is per-origin, so `options.html` cannot read/write `chatgpt.com` localStorage.
 * - `chrome.storage.local` is shared between options pages and content scripts.
 */
export class PromptsStorageService {
  /**
   * Deep copies of the default prompts, safe to mutate without touching `DEFAULT_PROMPTS`.
   */
  static getDefaultPrompts(): CustomPrompt[] {
    return clonePrompts(DEFAULT_PROMPTS);
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
      const stored = localStorage.getItem(PROMPTS_STORAGE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? (parsed as CustomPrompt[]) : null;
    } catch {
      return null;
    }
  }

  /**
   * Load prompts from `chrome.storage.local` with automatic migration:
   * - Stored prompts get the migrations they have not received yet (each migration runs once,
   *   so a default prompt the user deleted stays deleted).
   * - If storage is empty, migrate from legacy `options.html` localStorage (if present).
   * - Otherwise seed defaults, which already contain everything the migrations add.
   */
  static async loadPrompts(): Promise<CustomPrompt[]> {
    const stored = await this.chromeGet(PROMPTS_STORAGE_KEY);
    const legacy = Array.isArray(stored) ? null : this.readLegacyLocalStoragePrompts();
    const source = Array.isArray(stored) ? (stored as CustomPrompt[]) : legacy;

    if (!source) {
      const defaults = this.getDefaultPrompts();
      await this.savePrompts(defaults);
      await this.chromeSet(PROMPT_MIGRATIONS_KEY, [...ALL_PROMPT_MIGRATION_IDS]);
      return defaults;
    }

    const migrated = applyPendingPromptMigrations(source, await this.chromeGet(PROMPT_MIGRATIONS_KEY));
    // Migrations only append complete default prompts, so the shape is preserved.
    const prompts = migrated.prompts as CustomPrompt[];
    if (migrated.changed || legacy) await this.savePrompts(prompts);
    if (migrated.appliedChanged) await this.chromeSet(PROMPT_MIGRATIONS_KEY, migrated.appliedIds);
    return prompts;
  }

  /**
   * Read the raw stored prompts without migrations or seeding (used to re-sync after a failed save).
   */
  static async readStoredPrompts(): Promise<CustomPrompt[] | null> {
    const stored = await this.chromeGet(PROMPTS_STORAGE_KEY);
    return Array.isArray(stored) ? (stored as CustomPrompt[]) : null;
  }

  /**
   * Save prompts to `chrome.storage.local` (and mirror into `options.html` localStorage for rollback safety).
   */
  static async savePrompts(prompts: CustomPrompt[]): Promise<boolean> {
    try {
      const success = await this.chromeSet(PROMPTS_STORAGE_KEY, prompts);
      try {
        localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(prompts));
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
   * Parse and validate prompts from a JSON string.
   * Throws an `Error` with a localized message when the data is not an array of prompt objects
   * with non-empty string `title` and `prompt` fields.
   */
  static importPrompts(jsonString: string): CustomPrompt[] {
    const text = jsonString.trim();
    if (!text) {
      throw new Error(getMessage('options_import_error_empty'));
    }

    let imported: unknown;
    try {
      imported = JSON.parse(text);
    } catch {
      throw new Error(getMessage('options_import_error_invalid_json'));
    }

    if (!Array.isArray(imported)) {
      throw new Error(getMessage('options_import_error_not_array'));
    }

    imported.forEach((item: unknown, index) => {
      const position = String(index + 1);
      if (!isPlainObject(item)) {
        throw new Error(getMessage('options_import_error_invalid_item', position));
      }
      if (!isNonEmptyString(item.title) || !isNonEmptyString(item.prompt)) {
        throw new Error(getMessage('options_import_error_missing_fields', position));
      }
    });

    return imported as CustomPrompt[];
  }
}
