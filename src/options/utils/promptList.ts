import type { CustomPrompt } from '../models/CustomPrompt';

/**
 * Pure helpers for working with the prompt list. All functions return new arrays/objects and never
 * mutate their inputs.
 *
 * Flag semantics intentionally mirror the content scripts (`src/content/sites/*`), which treat
 * `initial`, `autoPaste` and `autoSubmit` as on only when strictly `true`, and `enabled` as on when
 * missing or strictly `true`.
 */
export type PromptGroup = 'initial' | 'followUp';

export interface IndexedPrompt {
  prompt: CustomPrompt;
  /** Index in the full stored array. */
  index: number;
}

export const ARGS_PLACEHOLDER = '{{args}}';

const hasOwn = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

export function isPromptInitial(prompt: CustomPrompt): boolean {
  return prompt.initial === true;
}

export function isPromptEnabled(prompt: CustomPrompt): boolean {
  return !hasOwn(prompt, 'enabled') || prompt.enabled === true;
}

export function isPromptAutoPaste(prompt: CustomPrompt): boolean {
  return prompt.autoPaste === true;
}

export function isPromptAutoSubmit(prompt: CustomPrompt): boolean {
  return prompt.autoSubmit === true;
}

export function getPromptGroup(prompt: CustomPrompt): PromptGroup {
  return isPromptInitial(prompt) ? 'initial' : 'followUp';
}

export function getGroupItems(prompts: readonly CustomPrompt[], group: PromptGroup): IndexedPrompt[] {
  return prompts
    .map((prompt, index) => ({ prompt, index }))
    .filter(({ prompt }) => getPromptGroup(prompt) === group);
}

export function countByGroup(prompts: readonly CustomPrompt[]): Record<PromptGroup, number> {
  const initial = prompts.filter(isPromptInitial).length;
  return { initial, followUp: prompts.length - initial };
}

export function clonePrompt(prompt: CustomPrompt): CustomPrompt {
  return structuredClone(prompt);
}

export function clonePrompts(prompts: readonly CustomPrompt[]): CustomPrompt[] {
  return prompts.map(clonePrompt);
}

export function arePromptListsEqual(a: readonly CustomPrompt[], b: readonly CustomPrompt[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Insert a prompt before the first prompt of the same group (or append when the group is empty).
 */
export function insertPromptAtTop(
  prompts: readonly CustomPrompt[],
  prompt: CustomPrompt
): { prompts: CustomPrompt[]; index: number } {
  const group = getPromptGroup(prompt);
  const next = [...prompts];
  const firstIndex = next.findIndex((item) => getPromptGroup(item) === group);
  const index = firstIndex === -1 ? next.length : firstIndex;
  next.splice(index, 0, prompt);
  return { prompts: next, index };
}

export function replacePromptAt(prompts: readonly CustomPrompt[], index: number, prompt: CustomPrompt): CustomPrompt[] {
  if (index < 0 || index >= prompts.length) return [...prompts];
  const next = [...prompts];
  next[index] = prompt;
  return next;
}

export function removePromptAt(prompts: readonly CustomPrompt[], index: number): CustomPrompt[] {
  if (index < 0 || index >= prompts.length) return [...prompts];
  return prompts.filter((_, i) => i !== index);
}

export function setPromptEnabledAt(prompts: readonly CustomPrompt[], index: number, enabled: boolean): CustomPrompt[] {
  const current = prompts[index];
  if (!current) return [...prompts];
  return replacePromptAt(prompts, index, { ...current, enabled });
}

/**
 * Swap a prompt with its nearest neighbour of the same group.
 * Returns `null` when the prompt is already at that end of its group.
 */
export function movePromptWithinGroup(
  prompts: readonly CustomPrompt[],
  index: number,
  direction: -1 | 1
): { prompts: CustomPrompt[]; index: number } | null {
  const current = prompts[index];
  if (!current) return null;

  const group = getPromptGroup(current);
  for (let i = index + direction; i >= 0 && i < prompts.length; i += direction) {
    if (getPromptGroup(prompts[i]) !== group) continue;
    const next = [...prompts];
    [next[index], next[i]] = [next[i], next[index]];
    return { prompts: next, index: i };
  }
  return null;
}

/**
 * Case-insensitive search across title, tooltip and prompt text. Every whitespace-separated term must match.
 */
export function matchesPromptQuery(prompt: CustomPrompt, query: string): boolean {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const haystack = [prompt.title, prompt.altText, prompt.prompt]
    .map((value) => (typeof value === 'string' ? value : ''))
    .join('\n')
    .toLocaleLowerCase();

  return terms.every((term) => haystack.includes(term));
}

export type PromptPreviewSegment =
  | { type: 'text'; value: string }
  | { type: 'args' }
  | { type: 'appended' };

/**
 * Describe how the prompt text lands in the composer, matching the content script behaviour:
 * with auto paste on, `{{args}}` is replaced by the input box / clipboard text, or that text is
 * appended when the prompt has no placeholder. Without auto paste the text is inserted verbatim.
 */
export function getPromptPreviewSegments(promptText: string, autoPaste: boolean): PromptPreviewSegment[] {
  const text = promptText.replace(/\r\n?/g, '\n');
  if (!autoPaste) return text ? [{ type: 'text', value: text }] : [];

  const segments: PromptPreviewSegment[] = [];
  const parts = text.split(ARGS_PLACEHOLDER);
  parts.forEach((part, i) => {
    if (i > 0) segments.push({ type: 'args' });
    if (part) segments.push({ type: 'text', value: part });
  });

  if (parts.length === 1) segments.push({ type: 'appended' });
  return segments;
}

export interface PromptFormValues {
  svgIcon: string;
  title: string;
  altText: string;
  prompt: string;
  autoPaste: boolean;
  autoSubmit: boolean;
  enabled: boolean;
}

const FORM_MANAGED_KEYS = ['enabled', 'initial', 'svgIcon', 'title', 'altText', 'prompt', 'autoPaste', 'autoSubmit'];

/**
 * Build the stored prompt object from form values.
 * Optional fields are omitted when empty/false (same shape as before), and unknown keys from the
 * prompt being edited (e.g. written by a newer version) are preserved.
 */
export function buildPromptFromForm(values: PromptFormValues, group: PromptGroup, base?: CustomPrompt): CustomPrompt {
  const record: Record<string, unknown> = { enabled: values.enabled };
  if (group === 'initial') record.initial = true;
  const svgIcon = values.svgIcon.trim();
  if (svgIcon) record.svgIcon = svgIcon;
  record.title = values.title.trim();
  const altText = values.altText.trim();
  if (altText) record.altText = altText;
  record.prompt = values.prompt;
  if (values.autoPaste) record.autoPaste = true;
  if (values.autoSubmit) record.autoSubmit = true;

  if (base) {
    Object.entries(base).forEach(([key, value]) => {
      if (!FORM_MANAGED_KEYS.includes(key)) record[key] = structuredClone(value);
    });
  }

  return record as unknown as CustomPrompt;
}

/**
 * Form values for editing an existing prompt (or defaults for a new one).
 */
export function getPromptFormValues(prompt?: CustomPrompt): PromptFormValues {
  if (!prompt) {
    return { svgIcon: '', title: '', altText: '', prompt: '', autoPaste: false, autoSubmit: false, enabled: true };
  }

  const asText = (value: unknown): string => (typeof value === 'string' ? value : '');
  return {
    svgIcon: asText(prompt.svgIcon),
    title: asText(prompt.title),
    altText: asText(prompt.altText),
    prompt: asText(prompt.prompt),
    autoPaste: isPromptAutoPaste(prompt),
    autoSubmit: isPromptAutoSubmit(prompt),
    enabled: isPromptEnabled(prompt),
  };
}
