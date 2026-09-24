import { describe, test, expect, beforeAll, beforeEach } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_PROMPTS, type CustomPrompt } from '../src/options/models/CustomPrompt';
import { ensureHappyDom } from './utils/happyDom';

ensureHappyDom();

/**
 * End-to-end smoke test: the real options.html + OptionsController wired to an in-memory chrome stub.
 */
const ROOT = resolve(import.meta.dir, '..');
const STORAGE_KEY = 'chatgpttoolkit.customPrompts';
const messages = JSON.parse(readFileSync(resolve(ROOT, '_locales/en/messages.json'), 'utf8')) as Record<string, { message: string }>;

const store: Record<string, unknown> = {};
const storageListeners: Array<(changes: Record<string, { newValue?: unknown; oldValue?: unknown }>, area: string) => void> = [];

function t(key: string, substitutions?: string | string[]): string {
  const entry = messages[key];
  if (!entry) return '';
  const subs = substitutions === undefined ? [] : Array.isArray(substitutions) ? substitutions : [substitutions];
  return entry.message.replace(/\$(\d)/g, (_, n: string) => subs[Number(n) - 1] ?? '');
}

function installChromeStub(): void {
  (globalThis as any).chrome = {
    i18n: { getMessage: t, getUILanguage: () => 'en' },
    runtime: { lastError: undefined },
    storage: {
      local: {
        get(keys: string[] | string, callback: (items: Record<string, unknown>) => void) {
          const list = Array.isArray(keys) ? keys : [keys];
          const result: Record<string, unknown> = {};
          list.forEach((key) => {
            if (key in store) result[key] = structuredClone(store[key]);
          });
          setTimeout(() => callback(result), 0);
        },
        set(items: Record<string, unknown>, callback?: () => void) {
          const changes: Record<string, { newValue?: unknown; oldValue?: unknown }> = {};
          Object.entries(items).forEach(([key, value]) => {
            changes[key] = { oldValue: store[key], newValue: structuredClone(value) };
            store[key] = structuredClone(value);
          });
          setTimeout(() => {
            callback?.();
            storageListeners.forEach((listener) => listener(structuredClone(changes), 'local'));
          }, 0);
        },
      },
      onChanged: { addListener: (listener: (typeof storageListeners)[number]) => storageListeners.push(listener) },
    },
  };
}

const tick = (ms = 10) => new Promise((resolveTick) => setTimeout(resolveTick, ms));
const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector(selector) as T;
const $$ = (selector: string) => Array.from(document.querySelectorAll<HTMLElement>(selector));
const visibleCards = () => $$('#panelInitial:not([hidden]) .prompt-card, #panelFollowUp:not([hidden]) .prompt-card');
const cardTitles = () => visibleCards().map((card) => card.querySelector('.prompt-card__title-text')?.textContent);
const stored = () => store[STORAGE_KEY] as CustomPrompt[];
const click = (element: Element | null) => (element as HTMLElement).click();

async function setStored(prompts: CustomPrompt[]): Promise<void> {
  (globalThis as any).chrome.storage.local.set({ [STORAGE_KEY]: prompts });
  await tick(20);
}

const followUpTitles = () => DEFAULT_PROMPTS.filter((p) => p.initial !== true).map((p) => p.title);

async function confirmDialog(accept: boolean): Promise<void> {
  const dialog = $<HTMLDialogElement>('#confirmDialog');
  expect(dialog.open).toBe(true);
  click($(accept ? '#confirmDialogOkBtn' : '#confirmDialogCancelBtn'));
  await tick();
}

describe('options page (smoke)', () => {
  let seededOnInit: unknown;

  beforeAll(async () => {
    const html = readFileSync(resolve(ROOT, 'options.html'), 'utf8');
    const body = html.slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('</body>'))
      .replace(/<script[\s\S]*?<\/script>/g, '');
    document.body.innerHTML = body;
    installChromeStub();
    (window as any).matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

    await import('../src/options/OptionsController');
    await tick(50);
    seededOnInit = structuredClone(store[STORAGE_KEY]);
  });

  // Every test starts from the defaults on the initial tab. Re-seeding goes through
  // chrome.storage.onChanged, i.e. the "changed in another tab" path.
  beforeEach(async () => {
    $$('dialog[open]').forEach((dialog) => (dialog as HTMLDialogElement).close());
    await tick();
    const search = $<HTMLInputElement>('#promptSearch');
    if (search.value) {
      search.value = '';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await setStored(structuredClone(DEFAULT_PROMPTS));
    click($('#tabInitialBtn'));
  });

  test('seeds defaults and renders the initial tab with counts', () => {
    const initialCount = DEFAULT_PROMPTS.filter((p) => p.initial === true).length;
    expect(seededOnInit).toEqual(DEFAULT_PROMPTS);
    expect($('#tabInitialCount').textContent).toBe(String(initialCount));
    expect($('#tabFollowUpCount').textContent).toBe(String(DEFAULT_PROMPTS.length - initialCount));
    expect(visibleCards()).toHaveLength(initialCount);
    expect(document.documentElement.lang).toBe('en');
    expect($('#addPromptBtn').textContent?.trim()).toBe(t('options_modal_title_add_initial'));
    expect($('#addPromptBtn').dataset.group).toBe('initial');
    expect($('#resetBtn').getAttribute('aria-label')).toBe('Restore defaults');
  });

  test('renders the composer preview with {{args}} semantics and send state', () => {
    const summary = visibleCards()[1];
    expect(summary.querySelector('.token--appended')).not.toBeNull();
    expect(summary.querySelector('.chip--paste')).not.toBeNull();
    expect(summary.querySelector('.send-state')?.classList.contains('is-auto')).toBe(true);

    const note = visibleCards()[0];
    expect(note.querySelector('.token--appended')).toBeNull();
    expect(note.querySelector('.chip--paste')).toBeNull();
  });

  test('move buttons are disabled at the ends and reorder within the group', async () => {
    const first = visibleCards()[0];
    const last = visibleCards()[visibleCards().length - 1];
    expect(first.querySelector<HTMLButtonElement>('[data-action="move-up"]')!.disabled).toBe(true);
    expect(last.querySelector<HTMLButtonElement>('[data-action="move-down"]')!.disabled).toBe(true);

    const [a, b] = cardTitles();
    click(first.querySelector('[data-action="move-down"]'));
    await tick();
    expect(cardTitles().slice(0, 2)).toEqual([b, a]);
    expect(stored()[0].title).toBe(b);
    expect(document.activeElement?.getAttribute('data-action')).toBe('move-down');

    click(visibleCards()[1].querySelector('[data-action="move-up"]'));
    await tick();
    expect(cardTitles().slice(0, 2)).toEqual([a, b]);
  });

  test('toggling a prompt persists without mutating DEFAULT_PROMPTS', async () => {
    const snapshot = JSON.stringify(DEFAULT_PROMPTS);
    const toggle = visibleCards()[0].querySelector<HTMLInputElement>('[data-action="toggle"]')!;
    toggle.click();
    await tick();
    expect(stored()[0].enabled).toBe(false);
    expect(visibleCards()[0].classList.contains('is-disabled')).toBe(true);
    expect(JSON.stringify(DEFAULT_PROMPTS)).toBe(snapshot);

    toggle.click();
    await tick();
    expect(stored()[0].enabled).toBe(true);
  });

  test('switches tabs with the keyboard', () => {
    const tab = $<HTMLButtonElement>('#tabInitialBtn');
    tab.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect($('#tabFollowUpBtn').getAttribute('aria-selected')).toBe('true');
    expect($('#panelFollowUp').hidden).toBe(false);
    expect($('#panelInitial').hidden).toBe(true);

    $('#tabFollowUpBtn').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect($('#tabInitialBtn').getAttribute('aria-selected')).toBe('true');
  });

  test('adds a prompt at the top of the active group', async () => {
    click($('#tabFollowUpBtn'));
    click($('#addPromptBtn'));
    const modal = $<HTMLDialogElement>('#promptModal');
    expect(modal.open).toBe(true);
    expect($('#modalTitle').textContent).toBe(t('options_modal_title_add_followup'));

    ($('#promptTitle') as HTMLInputElement).value = '  New follow-up  ';
    ($('#promptText') as HTMLTextAreaElement).value = 'Hello';
    ($('#promptForm') as HTMLFormElement).requestSubmit();
    await tick(30);

    expect(modal.open).toBe(false);
    expect(cardTitles()[0]).toBe('New follow-up');
    const created = stored().find((p) => p.title === 'New follow-up')!;
    expect(created).toEqual({ enabled: true, title: 'New follow-up', prompt: 'Hello' });
    const firstFollowUpIndex = stored().findIndex((p) => p.initial !== true);
    expect(stored()[firstFollowUpIndex].title).toBe('New follow-up');
  });

  test('the add button names and colors the active group', () => {
    click($('#tabFollowUpBtn'));
    expect($('#addPromptBtn').textContent?.trim()).toBe(t('options_modal_title_add_followup'));
    expect($('#addPromptBtn').dataset.group).toBe('followUp');
    expect($('#panelFollowUp').dataset.group).toBe('followUp');
  });

  test('the type picker reflects the group and moves an edited prompt to the other group', async () => {
    const modal = $<HTMLDialogElement>('#promptModal');
    const firstInitial = DEFAULT_PROMPTS.find((p) => p.initial === true)!;
    click($('#panelInitial [data-action="edit"]'));
    expect(modal.open).toBe(true);
    expect(modal.dataset.group).toBe('initial');
    expect($<HTMLInputElement>('input[name="promptGroup"][value="initial"]').checked).toBe(true);

    const followUpRadio = $<HTMLInputElement>('input[name="promptGroup"][value="followUp"]');
    followUpRadio.checked = true;
    followUpRadio.dispatchEvent(new Event('change', { bubbles: true }));
    expect(modal.dataset.group).toBe('followUp');
    expect($('#modalTitle').textContent).toBe(t('options_modal_title_edit_followup'));

    ($('#promptForm') as HTMLFormElement).requestSubmit();
    await tick(30);

    expect(modal.open).toBe(false);
    expect($('#tabFollowUpBtn').getAttribute('aria-selected')).toBe('true');
    expect(cardTitles()[0]).toBe(firstInitial.title);
    const moved = stored().findIndex((p) => p.initial !== true);
    expect(stored()[moved].title).toBe(firstInitial.title);
    expect(stored()[moved].initial).toBeUndefined();
    expect($('#tabInitialCount').textContent).toBe(String(DEFAULT_PROMPTS.filter((p) => p.initial === true).length - 1));
  });

  test('changing only the type counts as an unsaved change', async () => {
    click($('#addPromptBtn'));
    const followUpRadio = $<HTMLInputElement>('input[name="promptGroup"][value="followUp"]');
    followUpRadio.checked = true;
    followUpRadio.dispatchEvent(new Event('change', { bubbles: true }));
    click($('#cancelBtn'));
    await tick();
    await confirmDialog(false);
    expect($<HTMLDialogElement>('#promptModal').open).toBe(true);
  });

  test('rejects whitespace-only required fields', async () => {
    click($('#addPromptBtn'));
    ($('#promptTitle') as HTMLInputElement).value = '   ';
    ($('#promptText') as HTMLTextAreaElement).value = 'x';
    const before = stored().length;
    ($('#promptForm') as HTMLFormElement).requestSubmit();
    await tick();
    expect($<HTMLDialogElement>('#promptModal').open).toBe(true);
    expect(stored()).toHaveLength(before);

    // Dirty form: cancelling asks before discarding.
    click($('#cancelBtn'));
    await tick();
    expect($<HTMLDialogElement>('#confirmDialog').open).toBe(true);
    await confirmDialog(false);
    expect($<HTMLDialogElement>('#promptModal').open).toBe(true);

    click($('#cancelBtn'));
    await tick();
    await confirmDialog(true);
    expect($<HTMLDialogElement>('#promptModal').open).toBe(false);
  });

  test('edits a prompt, shows the {{args}} helpers and inserts the token', async () => {
    click($('#tabFollowUpBtn'));
    const title = followUpTitles()[0];
    click(visibleCards()[0].querySelector('[data-action="edit"]'));
    expect($('#modalTitle').textContent).toBe(t('options_modal_title_edit_followup'));
    expect($<HTMLInputElement>('#promptTitle').value).toBe(title);
    expect($('#promptArgsHint').hidden).toBe(true);

    const text = $<HTMLTextAreaElement>('#promptText');
    text.value = 'Use {{args}}';
    text.dispatchEvent(new Event('input', { bubbles: true }));
    expect($('#promptArgsWarning').hidden).toBe(false);

    const autoPaste = $<HTMLInputElement>('#promptAutoPaste');
    autoPaste.click();
    expect($('#promptArgsHint').hidden).toBe(false);
    expect($('#promptArgsWarning').hidden).toBe(true);

    text.setSelectionRange(0, 0);
    click($('#promptArgsInsert'));
    expect(text.value.startsWith('{{args}}')).toBe(true);

    ($('#promptForm') as HTMLFormElement).requestSubmit();
    await tick(30);
    expect($<HTMLDialogElement>('#promptModal').open).toBe(false);
    const edited = stored().find((p) => p.title === title && p.initial !== true)!;
    expect(edited.autoPaste).toBe(true);
    expect(edited.prompt).toBe('{{args}}Use {{args}}');
    expect(edited.initial).toBeUndefined();
    expect(visibleCards()[0].querySelectorAll('.token:not(.token--appended)')).toHaveLength(2);
  });

  test('filters with search and disables reordering while filtering', async () => {
    click($('#tabFollowUpBtn'));
    const search = $<HTMLInputElement>('#promptSearch');
    search.value = 'MARKMAP';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(cardTitles()).toEqual(['心智圖(markmap)']);
    expect(visibleCards()[0].querySelector('[data-action="move-down"]')?.getAttribute('aria-disabled')).toBe('true');

    search.value = 'zzz-no-match';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(visibleCards()).toHaveLength(0);
    expect($('#panelFollowUp .empty-state__text')?.textContent).toContain('zzz-no-match');

    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(search.value).toBe('');
    expect(visibleCards()).toHaveLength(followUpTitles().length);
  });

  test('deletes a prompt after confirmation', async () => {
    click($('#tabFollowUpBtn'));
    const [first, second] = cardTitles();
    const before = stored().length;

    click(visibleCards()[0].querySelector('[data-action="delete"]'));
    await tick();
    expect($('#confirmDialogMessage').textContent).toContain(first!);
    await confirmDialog(false);
    expect(stored()).toHaveLength(before);

    click(visibleCards()[0].querySelector('[data-action="delete"]'));
    await tick();
    await confirmDialog(true);
    await tick();
    expect(stored()).toHaveLength(before - 1);
    expect(cardTitles()[0]).toBe(second);
    // Focus moves to the card that took its place.
    expect(document.activeElement?.closest('.prompt-card')).toBe(visibleCards()[0]);
  });

  test('import shows validation errors as toasts and imports valid JSON after confirmation', async () => {
    click($('#importBtn'));
    const modal = $<HTMLDialogElement>('#importModal');
    expect(modal.open).toBe(true);

    $<HTMLTextAreaElement>('#importText').value = '[null]';
    click($('#confirmImportBtn'));
    await tick();
    expect($('#statusMessage').textContent).toContain(t('options_import_error_invalid_item', '1'));
    expect($('#statusMessage').parentElement).toBe(modal);

    const data: CustomPrompt[] = [{ enabled: true, initial: true, title: 'Only', prompt: 'One' }];
    $<HTMLTextAreaElement>('#importText').value = JSON.stringify(data);
    click($('#confirmImportBtn'));
    await tick();
    expect($('#confirmDialogMessage').textContent).toContain('1');
    await confirmDialog(true);
    await tick();

    expect(modal.open).toBe(false);
    expect(stored()).toEqual(data);
    expect($('#tabFollowUpCount').textContent).toBe('0');
    expect($('#statusMessage').parentElement).toBe(document.body);
  });

  test('shows the empty state for an empty group, with an add button for that group', async () => {
    await setStored(DEFAULT_PROMPTS.filter((p) => p.initial === true));
    click($('#tabFollowUpBtn'));
    expect($('#tabFollowUpCount').textContent).toBe('0');
    expect($('#panelFollowUp .empty-state__text')?.textContent).toBe(t('options_empty_followup'));

    click($('#panelFollowUp .empty-state button'));
    expect($<HTMLDialogElement>('#promptModal').open).toBe(true);
    expect($('#modalTitle').textContent).toBe(t('options_modal_title_add_followup'));
  });

  test('applies changes made in another tab', async () => {
    const external: CustomPrompt[] = [{ enabled: true, title: 'From elsewhere', prompt: 'x' }];
    await setStored(external);
    expect($('#tabInitialCount').textContent).toBe('0');
    expect($('#tabFollowUpCount').textContent).toBe('1');
    click($('#tabFollowUpBtn'));
    expect(cardTitles()).toEqual(['From elsewhere']);
  });

  test('defers changes from another tab while the edit dialog is open', async () => {
    click(visibleCards()[0].querySelector('[data-action="edit"]'));
    const titleInput = $<HTMLInputElement>('#promptTitle');
    titleInput.value = 'Typing…';

    await setStored([{ enabled: true, initial: true, title: 'From elsewhere', prompt: 'x' }]);
    expect($<HTMLDialogElement>('#promptModal').open).toBe(true);
    expect(titleInput.value).toBe('Typing…');
    expect(cardTitles()[0]).toBe(DEFAULT_PROMPTS[0].title);

    $<HTMLDialogElement>('#promptModal').close();
    await tick();
    expect(cardTitles()).toEqual(['From elsewhere']);
  });

  test('restores defaults after confirmation, as independent copies', async () => {
    await setStored([{ enabled: true, title: 'Custom', prompt: 'x' }]);
    click($('#resetBtn'));
    await tick();
    await confirmDialog(true);
    await tick();
    expect(stored()).toEqual(DEFAULT_PROMPTS);
    expect($('#tabInitialBtn').getAttribute('aria-selected')).toBe('true');

    // A toggle after reset must not leak into DEFAULT_PROMPTS (a second reset restores pristine defaults).
    visibleCards()[0].querySelector<HTMLInputElement>('[data-action="toggle"]')!.click();
    await tick();
    expect(stored()[0].enabled).toBe(false);
    expect(DEFAULT_PROMPTS[0].enabled).toBe(true);
  });
});
