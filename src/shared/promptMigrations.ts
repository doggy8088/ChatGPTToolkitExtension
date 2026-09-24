/**
 * Migrations for the custom prompts stored in `chrome.storage.local`.
 *
 * Shared by the options page and the content scripts: whichever loads the stored
 * prompts first migrates and saves them, so users who never open the options page
 * still receive newly added default prompts.
 *
 * Each migration runs once. Applied migration ids are stored under
 * `PROMPT_MIGRATIONS_KEY`, so a prompt the user deletes is not added back on the next load.
 */

/** Storage key holding the ids of the migrations already applied (string[]). */
export const PROMPT_MIGRATIONS_KEY = 'chatgpttoolkit.promptMigrations';

export interface StoredPrompt {
  enabled?: boolean;
  initial?: boolean;
  svgIcon?: string;
  title?: string;
  altText?: string;
  prompt?: string;
  autoPaste?: boolean;
  autoSubmit?: boolean;
}

export interface PromptMigrationResult {
  prompts: StoredPrompt[];
  changed: boolean;
}

/**
 * The default 「評論」 initial prompt added after the first release. Returns a fresh object on every call.
 */
export function getDefaultReviewPrompt(): StoredPrompt {
  return {
    enabled: true,
    initial: true,
    svgIcon: '💬',
    title: '評論',
    altText: '評論剪貼簿內容並提出改進建議',
    prompt: '請評論以下內容，指出優缺點並提供改進建議：\n\n',
    autoPaste: true,
    autoSubmit: true,
  };
}

/**
 * Append default initial prompts that were added after the user's prompts were first saved.
 */
export function migrateAddMissingPrompts(prompts: StoredPrompt[]): PromptMigrationResult {
  const review = getDefaultReviewPrompt();
  const reviewTitle = String(review.title).trim();

  const hasReview = prompts.some((p) => Boolean(p?.initial) && String(p?.title || '').trim() === reviewTitle);
  if (hasReview) return { prompts, changed: false };

  return { prompts: [...prompts, { ...review }], changed: true };
}

const PROMPT_MIGRATIONS: ReadonlyArray<{
  id: string;
  run: (prompts: StoredPrompt[]) => PromptMigrationResult;
}> = [{ id: 'add-review-prompt', run: migrateAddMissingPrompts }];

/** Ids of every known migration, e.g. to mark freshly seeded defaults as fully migrated. */
export const ALL_PROMPT_MIGRATION_IDS: readonly string[] = PROMPT_MIGRATIONS.map((migration) => migration.id);

export interface PendingMigrationResult extends PromptMigrationResult {
  /** Every applied migration id, including the ones applied by this call. */
  appliedIds: string[];
  /** True when `appliedIds` differs from the stored value and must be saved. */
  appliedChanged: boolean;
}

/**
 * Run the migrations that have not been applied yet, in order.
 * `storedAppliedIds` is the raw value read from `PROMPT_MIGRATIONS_KEY` (may be missing or malformed).
 */
export function applyPendingPromptMigrations(
  prompts: StoredPrompt[],
  storedAppliedIds: unknown
): PendingMigrationResult {
  const applied = new Set(
    Array.isArray(storedAppliedIds) ? storedAppliedIds.filter((id): id is string => typeof id === 'string') : []
  );
  let current = prompts;
  let changed = false;
  let appliedChanged = !Array.isArray(storedAppliedIds) || applied.size !== storedAppliedIds.length;

  for (const migration of PROMPT_MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    const result = migration.run(current);
    current = result.prompts;
    changed = changed || result.changed;
    applied.add(migration.id);
    appliedChanged = true;
  }

  return { prompts: current, changed, appliedIds: Array.from(applied), appliedChanged };
}
