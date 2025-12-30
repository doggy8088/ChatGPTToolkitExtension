import { describe, test, expect, beforeEach } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { PromptsStorageService } from '../src/options/services/PromptsStorageService';
import type { CustomPrompt } from '../src/options/models/CustomPrompt';

// Register DOM globals
GlobalRegistrator.register();

describe('PromptsStorageService', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('loadPrompts', () => {
    test('should return empty array when localStorage is empty', () => {
      const prompts = PromptsStorageService.loadPrompts();
      expect(prompts).toEqual([]);
    });

    test('should load prompts from localStorage', () => {
      const testPrompts: CustomPrompt[] = [
        { enabled: true, title: 'Test', prompt: 'Test prompt' }
      ];
      localStorage.setItem('chatgpttoolkit.customPrompts', JSON.stringify(testPrompts));

      const loaded = PromptsStorageService.loadPrompts();
      expect(loaded).toEqual(testPrompts);
    });

    test('should return empty array for invalid JSON', () => {
      localStorage.setItem('chatgpttoolkit.customPrompts', 'invalid json');

      const prompts = PromptsStorageService.loadPrompts();
      expect(prompts).toEqual([]);
    });
  });

  describe('savePrompts', () => {
    test('should save prompts to localStorage', () => {
      const testPrompts: CustomPrompt[] = [
        { enabled: true, title: 'Test', prompt: 'Test prompt' }
      ];

      const result = PromptsStorageService.savePrompts(testPrompts);
      expect(result).toBe(true);

      const stored = localStorage.getItem('chatgpttoolkit.customPrompts');
      expect(stored).toBe(JSON.stringify(testPrompts));
    });

    test('should return true on successful save', () => {
      const testPrompts: CustomPrompt[] = [];
      const result = PromptsStorageService.savePrompts(testPrompts);
      expect(result).toBe(true);
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
