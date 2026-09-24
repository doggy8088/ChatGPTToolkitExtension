import { describe, test, expect } from 'bun:test';
import { DEFAULT_PROMPTS, type CustomPrompt } from '../src/options/models/CustomPrompt';
import {
  arePromptListsEqual,
  buildPromptFromForm,
  clonePrompts,
  countByGroup,
  getGroupItems,
  getPromptFormValues,
  getPromptPreviewSegments,
  insertPromptAtTop,
  isPromptEnabled,
  isPromptInitial,
  matchesPromptQuery,
  movePromptWithinGroup,
  removePromptAt,
  replacePromptAt,
  setPromptEnabledAt,
  type PromptFormValues,
} from '../src/options/utils/promptList';

const initial = (title: string, extra: Partial<CustomPrompt> = {}): CustomPrompt => ({ enabled: true, initial: true, title, prompt: title, ...extra });
const followUp = (title: string, extra: Partial<CustomPrompt> = {}): CustomPrompt => ({ enabled: true, title, prompt: title, ...extra });
const titles = (prompts: CustomPrompt[]) => prompts.map((p) => p.title);

// Interleaved groups on purpose: group order must be preserved independently of array position.
const mixed = (): CustomPrompt[] => [initial('I1'), followUp('F1'), initial('I2'), followUp('F2'), initial('I3')];

describe('promptList', () => {
  describe('flag semantics match the content scripts', () => {
    test('initial is on only when strictly true', () => {
      expect(isPromptInitial(initial('a'))).toBe(true);
      expect(isPromptInitial(followUp('a'))).toBe(false);
      expect(isPromptInitial({ ...followUp('a'), initial: 'yes' as unknown as boolean })).toBe(false);
    });

    test('enabled is on when missing or strictly true', () => {
      expect(isPromptEnabled({ title: 'a', prompt: 'a' } as CustomPrompt)).toBe(true);
      expect(isPromptEnabled(followUp('a'))).toBe(true);
      expect(isPromptEnabled(followUp('a', { enabled: false }))).toBe(false);
      expect(isPromptEnabled({ ...followUp('a'), enabled: undefined as unknown as boolean })).toBe(false);
      expect(isPromptEnabled({ ...followUp('a'), enabled: 1 as unknown as boolean })).toBe(false);
    });
  });

  describe('grouping', () => {
    test('getGroupItems keeps storage indexes and order', () => {
      const items = getGroupItems(mixed(), 'initial');
      expect(items.map((item) => [item.prompt.title, item.index])).toEqual([['I1', 0], ['I2', 2], ['I3', 4]]);
      expect(getGroupItems(mixed(), 'followUp').map((item) => item.index)).toEqual([1, 3]);
    });

    test('countByGroup', () => {
      expect(countByGroup(mixed())).toEqual({ initial: 3, followUp: 2 });
      expect(countByGroup([])).toEqual({ initial: 0, followUp: 0 });
    });
  });

  describe('insertPromptAtTop', () => {
    test('inserts before the first prompt of the same group', () => {
      const result = insertPromptAtTop(mixed(), followUp('NEW'));
      expect(result.index).toBe(1);
      expect(titles(result.prompts)).toEqual(['I1', 'NEW', 'F1', 'I2', 'F2', 'I3']);

      const initialResult = insertPromptAtTop(mixed(), initial('NEW'));
      expect(initialResult.index).toBe(0);
      expect(titles(initialResult.prompts)[0]).toBe('NEW');
    });

    test('appends when the group is empty', () => {
      const result = insertPromptAtTop([initial('I1')], followUp('NEW'));
      expect(result.index).toBe(1);
      expect(titles(result.prompts)).toEqual(['I1', 'NEW']);
    });

    test('does not mutate the input', () => {
      const prompts = mixed();
      insertPromptAtTop(prompts, followUp('NEW'));
      expect(prompts).toHaveLength(5);
    });
  });

  describe('movePromptWithinGroup', () => {
    test('swaps with the nearest neighbour of the same group, skipping the other group', () => {
      const up = movePromptWithinGroup(mixed(), 2, -1);
      expect(up?.index).toBe(0);
      expect(titles(up!.prompts)).toEqual(['I2', 'F1', 'I1', 'F2', 'I3']);

      const down = movePromptWithinGroup(mixed(), 1, 1);
      expect(down?.index).toBe(3);
      expect(titles(down!.prompts)).toEqual(['I1', 'F2', 'I2', 'F1', 'I3']);
    });

    test('returns null at the ends of a group or for an invalid index', () => {
      expect(movePromptWithinGroup(mixed(), 0, -1)).toBeNull();
      expect(movePromptWithinGroup(mixed(), 4, 1)).toBeNull();
      expect(movePromptWithinGroup(mixed(), 3, 1)).toBeNull();
      expect(movePromptWithinGroup(mixed(), 99, 1)).toBeNull();
    });

    test('keeps object identity of the moved prompts and does not mutate the input', () => {
      const prompts = mixed();
      const result = movePromptWithinGroup(prompts, 2, -1)!;
      expect(result.prompts[0]).toBe(prompts[2]);
      expect(titles(prompts)).toEqual(['I1', 'F1', 'I2', 'F2', 'I3']);
    });
  });

  describe('replace / remove / toggle', () => {
    test('replacePromptAt and removePromptAt return new arrays', () => {
      const prompts = mixed();
      expect(titles(replacePromptAt(prompts, 1, followUp('X')))).toEqual(['I1', 'X', 'I2', 'F2', 'I3']);
      expect(titles(removePromptAt(prompts, 1))).toEqual(['I1', 'I2', 'F2', 'I3']);
      expect(titles(prompts)).toEqual(['I1', 'F1', 'I2', 'F2', 'I3']);
      expect(removePromptAt(prompts, 10)).toHaveLength(5);
    });

    test('setPromptEnabledAt replaces the object instead of mutating it', () => {
      const prompts = mixed();
      const original = prompts[1];
      const next = setPromptEnabledAt(prompts, 1, false);
      expect(next[1].enabled).toBe(false);
      expect(next[1]).not.toBe(original);
      expect(original.enabled).toBe(true);
    });

    test('toggling a prompt of a default-based list never mutates DEFAULT_PROMPTS', () => {
      const snapshot = JSON.stringify(DEFAULT_PROMPTS);
      let prompts = clonePrompts(DEFAULT_PROMPTS);
      prompts = setPromptEnabledAt(prompts, 0, false);
      prompts[1].title = 'mutated clone';
      expect(JSON.stringify(DEFAULT_PROMPTS)).toBe(snapshot);
    });
  });

  describe('clonePrompts / arePromptListsEqual', () => {
    test('deep-clones nested values', () => {
      const source = [{ ...followUp('A'), extra: { nested: [1, 2] } } as unknown as CustomPrompt];
      const cloned = clonePrompts(source);
      ((cloned[0] as unknown as { extra: { nested: number[] } }).extra.nested).push(3);
      expect((source[0] as unknown as { extra: { nested: number[] } }).extra.nested).toEqual([1, 2]);
      expect(cloned[0]).not.toBe(source[0]);
    });

    test('compares by value', () => {
      expect(arePromptListsEqual(mixed(), mixed())).toBe(true);
      expect(arePromptListsEqual(mixed(), removePromptAt(mixed(), 0))).toBe(false);
    });
  });

  describe('matchesPromptQuery', () => {
    const prompt = followUp('Summary', { altText: 'Summarize the chat', prompt: '請總結 {{args}}' });

    test('matches title, tooltip and prompt text case-insensitively', () => {
      expect(matchesPromptQuery(prompt, 'summary')).toBe(true);
      expect(matchesPromptQuery(prompt, 'CHAT')).toBe(true);
      expect(matchesPromptQuery(prompt, '總結')).toBe(true);
    });

    test('requires every term', () => {
      expect(matchesPromptQuery(prompt, 'sum chat')).toBe(true);
      expect(matchesPromptQuery(prompt, 'sum nothing')).toBe(false);
    });

    test('an empty query matches everything, and non-string fields are ignored', () => {
      expect(matchesPromptQuery(prompt, '   ')).toBe(true);
      expect(matchesPromptQuery({ enabled: true, title: 5 as unknown as string, prompt: 'x' }, 'x')).toBe(true);
    });
  });

  describe('getPromptPreviewSegments', () => {
    test('without auto paste the text is shown verbatim, with normalized line endings', () => {
      expect(getPromptPreviewSegments('A {{args}}\r\nB', false)).toEqual([{ type: 'text', value: 'A {{args}}\nB' }]);
    });

    test('with auto paste and no placeholder, the clipboard text is appended', () => {
      expect(getPromptPreviewSegments('Translate:\n\n', true)).toEqual([
        { type: 'text', value: 'Translate:\n\n' },
        { type: 'appended' },
      ]);
    });

    test('with auto paste, every placeholder is marked', () => {
      expect(getPromptPreviewSegments('{{args}} vs {{args}}!', true)).toEqual([
        { type: 'args' },
        { type: 'text', value: ' vs ' },
        { type: 'args' },
        { type: 'text', value: '!' },
      ]);
    });
  });

  describe('form values', () => {
    const values = (overrides: Partial<PromptFormValues> = {}): PromptFormValues => ({
      ...getPromptFormValues(),
      title: '  Title  ',
      prompt: 'Prompt\n\n',
      ...overrides,
    });

    test('new form defaults to enabled with every option off', () => {
      expect(getPromptFormValues()).toEqual({
        svgIcon: '', title: '', altText: '', prompt: '', autoPaste: false, autoSubmit: false, enabled: true,
      });
    });

    test('reads strict flags and tolerates non-string fields', () => {
      const prompt = { enabled: false, title: 'T', prompt: 'P', altText: 3, autoPaste: 'yes', autoSubmit: true } as unknown as CustomPrompt;
      expect(getPromptFormValues(prompt)).toEqual({
        svgIcon: '', title: 'T', altText: '', prompt: 'P', autoPaste: false, autoSubmit: true, enabled: false,
      });
    });

    test('builds the stored shape: trims title/icon/alt, keeps prompt whitespace, omits empty optionals', () => {
      expect(buildPromptFromForm(values(), 'followUp')).toEqual({ enabled: true, title: 'Title', prompt: 'Prompt\n\n' });
      expect(buildPromptFromForm(values({ svgIcon: ' 📝 ', altText: ' tip ', autoPaste: true, autoSubmit: true }), 'initial')).toEqual({
        enabled: true,
        initial: true,
        svgIcon: '📝',
        title: 'Title',
        altText: 'tip',
        prompt: 'Prompt\n\n',
        autoPaste: true,
        autoSubmit: true,
      });
    });

    test('the group decides `initial`, not the base prompt', () => {
      const base = initial('Old');
      expect(buildPromptFromForm(values(), 'followUp', base)).not.toHaveProperty('initial');
    });

    test('preserves unknown keys from the edited prompt but drops cleared optionals', () => {
      const base = { ...initial('Old', { altText: 'old tip', autoPaste: true }), futureField: { a: 1 } } as unknown as CustomPrompt;
      const built = buildPromptFromForm(values(), 'initial', base) as unknown as Record<string, unknown>;
      expect(built.futureField).toEqual({ a: 1 });
      expect(built.futureField).not.toBe((base as unknown as Record<string, unknown>).futureField);
      expect(built).not.toHaveProperty('altText');
      expect(built).not.toHaveProperty('autoPaste');
    });
  });
});
