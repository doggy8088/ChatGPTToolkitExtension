import { describe, test, expect } from 'bun:test';
import {
  ALL_PROMPT_MIGRATION_IDS,
  applyPendingPromptMigrations,
  getDefaultReviewPrompt,
  migrateAddMissingPrompts,
  type StoredPrompt
} from '../src/shared/promptMigrations';
import { DEFAULT_PROMPTS } from '../src/options/models/CustomPrompt';

describe('promptMigrations', () => {
  describe('getDefaultReviewPrompt', () => {
    test('returns a fresh object on every call', () => {
      const first = getDefaultReviewPrompt();
      const second = getDefaultReviewPrompt();
      expect(first).toEqual(second);
      expect(first).not.toBe(second);
    });
  });

  describe('migrateAddMissingPrompts', () => {
    test('appends the default review prompt when no initial prompt has its title', () => {
      const prompts: StoredPrompt[] = [{ enabled: true, title: '評論', prompt: '不是初始按鈕' }];

      const result = migrateAddMissingPrompts(prompts);

      expect(result.changed).toBe(true);
      expect(result.prompts).toEqual([...prompts, getDefaultReviewPrompt()]);
      expect(prompts).toHaveLength(1);
    });

    test('keeps prompts unchanged when the review prompt already exists', () => {
      const prompts: StoredPrompt[] = [{ ...getDefaultReviewPrompt(), prompt: '使用者改過的評論提示' }];

      const result = migrateAddMissingPrompts(prompts);

      expect(result.changed).toBe(false);
      expect(result.prompts).toBe(prompts);
    });
  });

  describe('applyPendingPromptMigrations', () => {
    test('runs pending migrations once and records them', () => {
      const prompts: StoredPrompt[] = [{ enabled: true, title: '品質', prompt: 'Custom', autoSubmit: true }];

      const first = applyPendingPromptMigrations(prompts, undefined);
      expect(first.changed).toBe(true);
      expect(first.prompts).toEqual([...prompts, getDefaultReviewPrompt()]);
      expect(first.appliedIds).toEqual([...ALL_PROMPT_MIGRATION_IDS]);
      expect(first.appliedChanged).toBe(true);

      const second = applyPendingPromptMigrations(first.prompts, first.appliedIds);
      expect(second.changed).toBe(false);
      expect(second.appliedChanged).toBe(false);
      expect(second.prompts).toBe(first.prompts);
    });

    test('does not re-add a default prompt the user deleted after the migration ran', () => {
      const withoutReview: StoredPrompt[] = [{ enabled: true, title: '品質', prompt: 'Custom' }];

      const result = applyPendingPromptMigrations(withoutReview, [...ALL_PROMPT_MIGRATION_IDS]);

      expect(result.changed).toBe(false);
      expect(result.appliedChanged).toBe(false);
      expect(result.prompts).toBe(withoutReview);
    });

    test('marks the migration applied without changes when the prompt already exists', () => {
      const prompts: StoredPrompt[] = [getDefaultReviewPrompt()];

      const result = applyPendingPromptMigrations(prompts, []);

      expect(result.changed).toBe(false);
      expect(result.appliedChanged).toBe(true);
      expect(result.appliedIds).toEqual([...ALL_PROMPT_MIGRATION_IDS]);
    });

    test('ignores malformed stored ids and rewrites them', () => {
      const result = applyPendingPromptMigrations([getDefaultReviewPrompt()], ['add-review-prompt', 42]);

      expect(result.appliedIds).toEqual(['add-review-prompt']);
      expect(result.appliedChanged).toBe(true);
    });
  });

  describe('defaults stay in sync with the migrations', () => {
    test('DEFAULT_PROMPTS contains the review prompt that migrations add', () => {
      expect(DEFAULT_PROMPTS).toContainEqual(getDefaultReviewPrompt());
    });
  });
});
