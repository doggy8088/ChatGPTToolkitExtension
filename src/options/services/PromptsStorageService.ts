import type { CustomPrompt } from '../models/CustomPrompt';

const STORAGE_KEY = 'chatgpttoolkit.customPrompts';

/**
 * Service for managing custom prompts in localStorage
 */
export class PromptsStorageService {
  /**
   * Load prompts from localStorage
   */
  static loadPrompts(): CustomPrompt[] {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }

    try {
      return JSON.parse(stored) as CustomPrompt[];
    } catch (error) {
      console.error('Failed to parse stored prompts:', error);
      return [];
    }
  }

  /**
   * Save prompts to localStorage
   */
  static savePrompts(prompts: CustomPrompt[]): boolean {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
      return true;
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

    // Validate that each item has at least title and prompt
    for (const item of imported) {
      if (!item.title || !item.prompt) {
        throw new Error('每個提示必須包含 title 和 prompt 欄位');
      }
    }

    return imported as CustomPrompt[];
  }
}
