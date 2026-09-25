import { describe, test, expect, beforeAll, beforeEach } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ensureHappyDom } from './utils/happyDom';
import { loadMessages } from './utils/messages';

ensureHappyDom();

/**
 * End-to-end smoke test: the real link-builder.html + LinkBuilderController with the English messages.
 */
const ROOT = resolve(import.meta.dir, '..');
const STORAGE_KEY = 'chatgpttoolkit.linkBuilder';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const codec = require('../scripts/content-utils.js') as ChatGPTToolkitContentUtils;

const calls: Array<[string, ...unknown[]]> = [];
const clipboard: string[] = [];

const t = loadMessages('en');

function installStubs(): void {
  (globalThis as any).chrome = {
    i18n: { getMessage: t, getUILanguage: () => 'en' },
    runtime: {
      lastError: undefined,
      openOptionsPage: async () => void calls.push(['runtime.openOptionsPage']),
    },
    tabs: { create: async (properties: unknown) => void calls.push(['tabs.create', properties]) },
  };
  (window as any).ChatGPTToolkitContentUtils = codec;
  (window as any).matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (text: string) => void clipboard.push(text) },
  });
}

const tick = (ms = 10) => new Promise((done) => setTimeout(done, ms));
const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector(selector) as T;
const $$ = <T extends Element = HTMLElement>(selector: string) => Array.from(document.querySelectorAll<T & Element>(selector)) as T[];
const click = (selector: string) => $<HTMLElement>(selector).click();
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');

function type(selector: string, value: string): void {
  const field = $<HTMLInputElement | HTMLTextAreaElement>(selector);
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

function choose(target: string): void {
  const input = $<HTMLInputElement>(`#providerPicker input[value="${target}"]`);
  input.checked = true;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function toggle(id: string, checked: boolean): void {
  const input = $<HTMLInputElement>(`#${id}`);
  input.checked = checked;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

const urlText = () => $('#urlOutput').textContent ?? '';
const note = (id: string) => ($(`#${id}Note`).hidden ? '' : $(`#${id}Note`).textContent);

describe('link builder page (smoke)', () => {
  beforeAll(async () => {
    const html = readFileSync(resolve(ROOT, 'link-builder.html'), 'utf8');
    document.body.innerHTML = html.slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('</body>'))
      .replace(/<script[\s\S]*?<\/script>/g, '');
    installStubs();
    localStorage.removeItem(STORAGE_KEY);
    // Deep link with the original web builder's parameters.
    (window as any).happyDOM.setURL('chrome-extension://abcdefghijklmnop/link-builder.html#aiProvider=gemini&subject=From%20a%20link&prompt=Hello%20there');

    await import('../src/linkBuilder/LinkBuilderController');
    await tick(20);
  });

  test('prefills the form from the page hash, then clears it', () => {
    expect(location.hash).toBe('');
    expect($<HTMLInputElement>('#providerPicker input[value="gemini"]').checked).toBe(true);
    expect($<HTMLInputElement>('#linkTitle').value).toBe('From a link');
    expect($<HTMLTextAreaElement>('#promptText').value).toBe('Hello there');
    expect(urlText()).toBe('https://gemini.google.com/app#autoSubmit=true&prompt=Hello%20there');
    expect(stored()).toMatchObject({ target: 'gemini', title: 'From a link', prompt: 'Hello there' });
  });

  describe('with a clean form', () => {
    beforeEach(async () => {
      $$<HTMLDialogElement>('dialog[open]').forEach((dialog) => dialog.close());
      choose('chatgpt');
      type('#promptText', '');
      type('#linkTitle', '');
      type('#customUrl', '');
      toggle('autoSubmit', true);
      toggle('pasteImage', false);
      toggle('imageTool', false);
      calls.length = 0;
      clipboard.length = 0;
      await tick();
    });

    test('is localized and lists every AI service and template', () => {
      expect(document.documentElement.lang).toBe('en');
      expect($('.brand__title').textContent).toBe('Prompt link builder');
      expect($$('#providerPicker .provider__name').map((node) => node.textContent))
        .toEqual(['ChatGPT', 'ChatGPT Images', 'Claude', 'Gemini', 'Groq', 'Perplexity', 'Custom URL']);
      expect($$('#providerPicker .provider__detail').map((node) => node.textContent).slice(0, 2)).toEqual(['chatgpt.com', 'chatgpt.com/images']);
      expect($$('.template__name')).toHaveLength(14);
      expect($$('.template__name')[0].textContent).toBe('Reply in English');
      expect($('#importLinkBtn').textContent?.trim()).toBe('Import link');
    });

    test('waits for a prompt before offering the link', () => {
      expect($('#bookmarkLink').getAttribute('aria-disabled')).toBe('true');
      expect($('#bookmarkLink').hasAttribute('href')).toBe(false);
      expect($('#openLinkBtn').getAttribute('aria-disabled')).toBe('true');
      expect($('#resultNotice').hidden).toBe(false);
      expect($('#resultNoticeText').textContent).toBe(t('link_builder_result_empty'));
      expect($<HTMLButtonElement>('.copy-btn[data-copy="url"]').disabled).toBe(true);
      // The address bar shortcut works without a prompt.
      expect($('#searchUrlOutput').textContent).toBe('https://chatgpt.com/#autoSubmit=true&prompt=%s');
      expect($('#searchNameOutput').textContent).toBe('ChatGPT');
    });

    test('builds the link, Markdown and shortcut as the prompt is typed', () => {
      type('#promptText', 'Explain %s simply');
      type('#linkTitle', 'Explain');

      const href = 'https://chatgpt.com/#autoSubmit=true&prompt=Explain%20%25s%20simply';
      expect($('#resultNotice').hidden).toBe(true);
      expect($('#bookmarkLink').getAttribute('href')).toBe(href);
      expect($('#bookmarkTitle').textContent).toBe('Explain');
      expect($('#openLinkBtn').getAttribute('href')).toBe(href);
      expect($('#openLinkLabel').textContent).toBe('Open in ChatGPT');
      expect(urlText()).toBe(href);
      expect($('#markdownOutput').textContent).toBe(`[Explain](${href})`);
      expect($('#searchUrlOutput').textContent).toBe('https://chatgpt.com/#autoSubmit=true&prompt=Explain%20%s%20simply');
      expect($('#searchTermsNote').textContent).toBe(t('link_builder_search_terms_in_prompt'));
      expect(stored()).toMatchObject({ target: 'chatgpt', title: 'Explain', prompt: 'Explain %s simply' });
    });

    test('turns off the options a service does not support', () => {
      type('#promptText', 'hi');
      toggle('pasteImage', true);
      toggle('imageTool', true);
      expect(urlText()).toBe('https://chatgpt.com/#autoSubmit=true&pasteImage=true&tool=image&prompt=hi');

      choose('claude');
      expect($<HTMLInputElement>('#pasteImage').disabled).toBe(true);
      expect($<HTMLInputElement>('#pasteImage').checked).toBe(false);
      expect(note('pasteImage')).toBe('Not available on Claude');
      expect(note('imageTool')).toBe('Not available on Claude');
      expect(urlText()).toBe('https://claude.ai/#autoSubmit=true&prompt=hi');

      choose('chatgpt-images');
      expect($<HTMLInputElement>('#pasteImage').checked).toBe(true);
      expect(note('imageTool')).toBe('ChatGPT Images already generates images');

      // The choices come back on a service that supports them.
      choose('chatgpt');
      expect($<HTMLInputElement>('#imageTool').checked).toBe(true);
      expect(note('pasteImage')).toBe('');
    });

    test('validates a custom URL, starting from the selected service', () => {
      type('#promptText', 'hi');
      choose('gemini');
      choose('custom');
      expect($('#customUrlField').hidden).toBe(false);
      expect($<HTMLInputElement>('#customUrl').value).toBe('https://gemini.google.com/app');

      type('#customUrl', 'not a url');
      expect($('#customUrl').getAttribute('aria-invalid')).toBe('true');
      expect($('#customUrlMessage').textContent).toBe(t('link_builder_custom_url_invalid'));
      expect($('#resultNoticeText').textContent).toBe(t('link_builder_result_url_problem'));

      type('#customUrl', 'example.com/chat');
      expect($('#customUrl').getAttribute('aria-invalid')).toBe('false');
      expect($('#customUrlMessage').textContent).toBe(t('link_builder_custom_url_unsupported'));
      expect($<HTMLInputElement>('#autoSubmit').disabled).toBe(true);
      expect(urlText()).toBe('https://example.com/chat#autoSubmit=false&prompt=hi');

      type('#customUrl', 'https://chatgpt.com/g/g-abc');
      expect($('#customUrlMessage').textContent).toBe('');
      expect($('#openLinkLabel').textContent).toBe('Open in ChatGPT');
      expect(urlText()).toBe('https://chatgpt.com/g/g-abc#autoSubmit=true&prompt=hi');
    });

    test('templates fill in the prompt and name the link, but keep a custom name', () => {
      click('#openTemplatesBtn');
      expect($<HTMLDialogElement>('#templatesDialog').open).toBe(true);
      $$<HTMLButtonElement>('.template')[1].click();
      expect($<HTMLDialogElement>('#templatesDialog').open).toBe(false);
      expect($<HTMLTextAreaElement>('#promptText').value).toBe('You are a professional translator. Please translate the following content into natural, fluent English.');
      expect($<HTMLInputElement>('#linkTitle').value).toBe('Translate into English');

      // Another template replaces a name that came from a template...
      click('#openTemplatesBtn');
      $$<HTMLButtonElement>('.template')[2].click();
      expect($<HTMLInputElement>('#linkTitle').value).toBe('Summarize a long text');

      // ...but not one the user typed.
      type('#linkTitle', 'My summary');
      click('#openTemplatesBtn');
      $$<HTMLButtonElement>('.template')[0].click();
      expect($<HTMLTextAreaElement>('#promptText').value).toBe('Please reply in English.');
      expect($<HTMLInputElement>('#linkTitle').value).toBe('My summary');
    });

    test('inserts %s at the caret while typing, otherwise at the end', () => {
      const prompt = $<HTMLTextAreaElement>('#promptText');
      type('#promptText', 'Translate: ');
      prompt.setSelectionRange(0, 0);
      prompt.blur();
      click('#insertSearchTermsBtn');
      expect(prompt.value).toBe('Translate: %s');
      expect($('#searchUrlOutput').textContent).toBe('https://chatgpt.com/#autoSubmit=true&prompt=Translate%3A%20%s');

      type('#promptText', 'Compare  with B');
      prompt.focus();
      prompt.setSelectionRange(8, 8);
      click('#insertSearchTermsBtn');
      expect(prompt.value).toBe('Compare %s with B');
    });

    test('moves into the custom URL field only when the tile is clicked', () => {
      const picker = $('#providerPicker');
      picker.dispatchEvent(new Event('keydown', { bubbles: true }));
      choose('custom');
      expect(document.activeElement).not.toBe($('#customUrl'));

      choose('chatgpt');
      picker.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      choose('custom');
      expect(document.activeElement).toBe($('#customUrl'));
    });

    test('copies the outputs', async () => {
      type('#promptText', 'hi');
      click('.copy-btn[data-copy="url"]');
      await tick();
      expect(clipboard).toEqual(['https://chatgpt.com/#autoSubmit=true&prompt=hi']);
      expect($('.copy-btn[data-copy="url"] .copy-btn__label').textContent).toBe('Copied');

      click('.copy-btn[data-copy="searchUrl"]');
      await tick();
      expect(clipboard[1]).toBe('https://chatgpt.com/#autoSubmit=true&prompt=hi%0A%0A%s');
    });

    test('imports a link, and explains when the text is not one', async () => {
      click('#importLinkBtn');
      expect($<HTMLDialogElement>('#importDialog').open).toBe(true);

      type('#importInput', 'hello');
      $<HTMLFormElement>('#importForm').requestSubmit();
      expect($('#importError').hidden).toBe(false);
      expect($<HTMLDialogElement>('#importDialog').open).toBe(true);

      type('#importInput', 'https://claude.ai/#autoSubmit=false&prompt=Imported%20prompt');
      expect($('#importError').hidden).toBe(true);
      $<HTMLFormElement>('#importForm').requestSubmit();
      await tick();
      expect($<HTMLDialogElement>('#importDialog').open).toBe(false);
      expect($<HTMLInputElement>('#providerPicker input[value="claude"]').checked).toBe(true);
      expect($<HTMLTextAreaElement>('#promptText').value).toBe('Imported prompt');
      expect($<HTMLInputElement>('#autoSubmit').checked).toBe(false);
      expect(urlText()).toBe('https://claude.ai/#autoSubmit=false&prompt=Imported%20prompt');
      expect($('#statusMessage').textContent).toContain(t('link_builder_import_success'));
    });

    test('opens the options page and Chrome search engine settings', async () => {
      click('#managePromptsBtn');
      click('#openSearchSettingsBtn');
      await tick();
      expect(calls).toEqual([['runtime.openOptionsPage'], ['tabs.create', { url: 'chrome://settings/searchEngines' }]]);
    });
  });
});
