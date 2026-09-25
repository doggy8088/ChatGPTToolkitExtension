import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseBuilderParams, parseImportedLink } from '../src/linkBuilder/linkImport';
import {
  buildMarkdownLink,
  buildPromptLink,
  buildSiteSearchUrl,
  encodePromptParam,
  encodeUrlComponentStrict,
  getSiteSearchPrompt,
  type PromptLinkParams,
} from '../src/linkBuilder/promptLink';
import {
  PROVIDERS,
  SUPPORTED_HOSTS,
  findProviderByUrl,
  getSupportedSite,
  normalizeCustomUrl,
} from '../src/linkBuilder/sites';
import {
  DEFAULT_STATE,
  LINK_BUILDER_STORAGE_KEY,
  parseState,
  readState,
  resolveLink,
  writeState,
  type LinkBuilderState,
} from '../src/linkBuilder/state';
import { getPromptTemplates } from '../src/linkBuilder/templates';

// The content script's own codec: links must round-trip through the real parser.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const codec = require('../scripts/content-utils.js') as ChatGPTToolkitContentUtils;
const ROOT = resolve(import.meta.dir, '..');

const params = (overrides: Partial<PromptLinkParams> = {}): PromptLinkParams => ({
  prompt: 'hello',
  autoSubmit: true,
  pasteImage: false,
  imageTool: false,
  ...overrides,
});

/** What the content script reads from a link, exactly as it would on the target page. */
function openLink(link: string) {
  const url = new URL(link);
  return codec.parseToolkitHash(url.hash.substring(1), url.search);
}

/** Normalization the content script applies to readable (non-Base64) prompts. */
const normalizeReadable = (prompt: string): string =>
  prompt.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').replace(/^\s+/, '');

/**
 * The prompt a link opens with: the exact text, unless normalization would change it and the prompt is too
 * short for the content script to recognize its Base64 form (under 32 characters).
 */
const expectedPrompt = (prompt: string): string =>
  normalizeReadable(prompt) === prompt || codec.isBase64Unicode(codec.b64EncodeUnicode(prompt)) ? prompt : normalizeReadable(prompt);

const state = (overrides: Partial<LinkBuilderState> = {}): LinkBuilderState => ({ ...DEFAULT_STATE, ...overrides });

describe('link builder', () => {
  describe('encodePromptParam', () => {
    test('keeps short prompts readable', () => {
      expect(encodePromptParam('hello world', codec)).toBe('hello%20world');
      expect(encodePromptParam('請以台灣常用的正體中文回應。', codec)).toBe(encodeURIComponent('請以台灣常用的正體中文回應。'));
    });

    test('Base64-encodes longer prompts', () => {
      const prompt = 'Please review the following code and provide feedback on code quality.';
      expect(encodePromptParam(prompt, codec)).toBe(encodeURIComponent(codec.b64EncodeUnicode(prompt)));
    });

    test('always encodes a short prompt the content script would mistake for Base64', () => {
      const lookalike = 'abcdefghijklmnopqrstuvwxyzABCDEF';
      expect(codec.isBase64Unicode(lookalike)).toBe(true);
      expect(encodePromptParam(lookalike, codec)).toBe(encodeURIComponent(codec.b64EncodeUnicode(lookalike)));
      expect(openLink(buildPromptLink('https://chatgpt.com/', params({ prompt: lookalike }), codec)).prompt).toBe(lookalike);
    });

    // The content script trims and normalizes readable prompts before its Base64 check.
    test.each([' PleaseSummarizeTheFollowingArticle', '\r\nPleaseSummarizeTheFollowingArticle', '\n\nabcdefghijklmnopqrstuvwxyzABCDEF'])(
      'also when it only looks like Base64 after the content script trims it: %p',
      (prompt) => {
        expect(codec.isBase64Unicode(prompt)).toBe(false);
        expect(openLink(buildPromptLink('https://chatgpt.com/', params({ prompt }), codec)).prompt).toBe(prompt);
      }
    );

    test('keeps leading spaces and blank lines whenever the content script can decode the Base64 form', () => {
      for (const prompt of ['  indented, and still short', 'a\n\n\n\nb (four newlines)', 'Windows line endings\r\nsecond line']) {
        expect(encodePromptParam(prompt, codec)).toBe(encodeURIComponent(codec.b64EncodeUnicode(prompt)));
        expect(openLink(buildPromptLink('https://chatgpt.com/', params({ prompt }), codec)).prompt).toBe(prompt);
      }
      // Too short for Base64 detection: the content script trims it, so it stays readable.
      expect(encodePromptParam(' hi', codec)).toBe('%20hi');
      expect(openLink(buildPromptLink('https://chatgpt.com/', params({ prompt: ' hi' }), codec)).prompt).toBe('hi');
    });

    test('escapes the characters encodeURIComponent leaves alone', () => {
      expect(encodeUrlComponentStrict("(it's)!*")).toBe('%28it%27s%29%21%2A');
      expect(encodePromptParam('(hi)', codec)).toBe('%28hi%29');
    });
  });

  describe('buildPromptLink', () => {
    test('puts the flags first and the prompt last', () => {
      expect(buildPromptLink('https://chatgpt.com/', params(), codec)).toBe('https://chatgpt.com/#autoSubmit=true&prompt=hello');
      expect(buildPromptLink('https://gemini.google.com/app', params({ autoSubmit: false, pasteImage: true, imageTool: true }), codec))
        .toBe('https://gemini.google.com/app#autoSubmit=false&pasteImage=true&tool=image&prompt=hello');
    });

    const prompts = [
      'hello',
      '你好',
      '請以台灣常用的正體中文回應。',
      'Emoji 🎉👩‍💻 and symbols & = # % + ? / : @ $ ; , (parens) [brackets] {braces}',
      'prompt=inside the prompt&autoSubmit=false#hash',
      '100% sure %s %25 %zz',
      'Line one\nLine two\n\n\n\nAfter blank lines\r\nWindows line',
      'Translate the following into Traditional Chinese:\n\n',
      '   leading spaces are kept in long prompts because Base64 is decoded as-is',
      'x'.repeat(5000),
      '長'.repeat(1200),
      'a+b=c',
      '+',
    ];

    test.each(prompts)('content script reads back %p', (prompt) => {
      for (const flags of [
        { autoSubmit: true, pasteImage: false, imageTool: false },
        { autoSubmit: false, pasteImage: true, imageTool: true },
      ]) {
        const parsed = openLink(buildPromptLink('https://chatgpt.com/', params({ prompt, ...flags }), codec));
        expect(parsed.prompt).toBe(expectedPrompt(prompt));
        expect(parsed.autoSubmit).toBe(flags.autoSubmit);
        expect(parsed.pasteImage).toBe(flags.pasteImage);
        expect(parsed.tool).toBe(flags.imageTool ? 'image' : '');
      }
    });

    test('round-trips on a base URL with a query string', () => {
      const prompt = 'Summarize this page & keep the links / anchors #intact';
      const parsed = openLink(buildPromptLink('https://www.phind.com/search?home=true', params({ prompt }), codec));
      expect(parsed.prompt).toBe(prompt);
    });
  });

  describe('site search', () => {
    test('keeps every %s as the search terms placeholder', () => {
      const url = buildSiteSearchUrl('https://chatgpt.com/', params({ prompt: 'Compare %s with %s' }));
      expect(url).toBe('https://chatgpt.com/#autoSubmit=true&prompt=Compare%20%s%20with%20%s');
    });

    test('adds the search terms after the prompt when it has no %s', () => {
      expect(getSiteSearchPrompt('Translate into English:\n\n')).toBe('Translate into English:\n\n%s');
      expect(getSiteSearchPrompt('Explain')).toBe('Explain\n\n%s');
      expect(getSiteSearchPrompt('   ')).toBe('%s');
      expect(buildSiteSearchUrl('https://claude.ai/', params({ prompt: '' }))).toBe('https://claude.ai/#autoSubmit=true&prompt=%s');
    });

    test('never Base64-encodes, and keeps the options', () => {
      const prompt = 'Please review the following code and provide feedback on code quality: %s';
      const url = buildSiteSearchUrl('https://gemini.google.com/app', params({ prompt, pasteImage: true, imageTool: true }));
      expect(url.startsWith('https://gemini.google.com/app#autoSubmit=true&pasteImage=true&tool=image&prompt=Please%20review')).toBe(true);
    });

    // Chrome encodes the typed text with encodeURIComponent when the URL has a query string,
    // and like encodeURI otherwise; the content script handles both.
    test.each([
      ['https://chatgpt.com/', encodeURI],
      ['https://www.phind.com/search?home=true', encodeURIComponent],
    ] as const)('the content script reads the prompt with the search terms on %s', (baseUrl, encodeTerms) => {
      const terms = '小明 & 小華 = 好朋友? #1 /path';
      const url = buildSiteSearchUrl(baseUrl, params({ prompt: '翻譯：%s（請保留格式）' }));
      const opened = url.replace(/%s/g, () => encodeTerms(terms));
      expect(openLink(opened).prompt).toBe(`翻譯：${terms}（請保留格式）`);
    });
  });

  describe('buildMarkdownLink', () => {
    test('escapes brackets in the title and encodes parentheses in the URL', () => {
      expect(buildMarkdownLink('Ask [ChatGPT]', 'https://example.com/a_(b)#prompt=x y'))
        .toBe('[Ask \\[ChatGPT\\]](https://example.com/a_%28b%29#prompt=x%20y)');
    });
  });

  describe('sites', () => {
    test('map each host to one provider tile', () => {
      const providerOf = (url: string) => getSupportedSite(new URL(url))?.providerId;
      expect(providerOf('https://chatgpt.com/')).toBe('chatgpt');
      expect(providerOf('https://chat.openai.com/g/g-abc')).toBe('chatgpt');
      expect(providerOf('https://chatgpt.com/images/')).toBe('chatgpt-images');
      expect(providerOf('https://www.phind.com/')).toBeUndefined();
    });

    test('match the content script hosts in manifest.json', () => {
      const manifest = JSON.parse(readFileSync(resolve(ROOT, 'manifest.json'), 'utf8'));
      const hosts = manifest.content_scripts.flatMap((entry: { matches: string[] }) => entry.matches)
        .map((pattern: string) => new URL(pattern.replace('/*', '/')).hostname);
      expect([...SUPPORTED_HOSTS].sort()).toEqual([...new Set<string>(hosts)].sort());
      SUPPORTED_HOSTS.forEach((host) => expect(getSupportedSite(new URL(`https://${host}/`))).not.toBeNull());
    });

    test('describe the optional features per site', () => {
      const features = (url: string) => getSupportedSite(new URL(url))?.features;
      expect(features('https://chatgpt.com/')).toEqual({ pasteImage: true, imageTool: true });
      expect(features('https://chatgpt.com/g/g-abc-my-gpt')).toEqual({ pasteImage: true, imageTool: true });
      expect(features('https://chatgpt.com/images/')).toEqual({ pasteImage: true, imageTool: false });
      expect(features('https://gemini.google.com/app')).toEqual({ pasteImage: true, imageTool: true });
      expect(features('https://claude.ai/')).toEqual({ pasteImage: false, imageTool: false });
      expect(getSupportedSite(new URL('https://chatgpt.com/images'))?.name).toBe('ChatGPT Images');
      expect(getSupportedSite(new URL('https://chatgpt.com/imagesearch'))?.name).toBe('ChatGPT');
    });

    test('need https and a supported host', () => {
      expect(getSupportedSite(new URL('http://chatgpt.com/'))).toBeNull();
      expect(getSupportedSite(new URL('https://example.com/'))).toBeNull();
    });

    test('every provider opens a supported site under its own name', () => {
      PROVIDERS.forEach((provider) => {
        expect(getSupportedSite(new URL(provider.url))?.name).toBe(provider.name);
        expect(findProviderByUrl(provider.url)?.id).toBe(provider.id);
      });
      expect(findProviderByUrl('https://gemini.google.com/app/')?.id).toBe('gemini');
      expect(findProviderByUrl('https://chatgpt.com')?.id).toBe('chatgpt');
      expect(findProviderByUrl('https://chatgpt.com/g/g-abc')).toBeUndefined();
    });

    test('normalizeCustomUrl validates and cleans typed URLs', () => {
      expect(normalizeCustomUrl('  ')).toEqual({ ok: false, reason: 'empty' });
      expect(normalizeCustomUrl('not a url')).toEqual({ ok: false, reason: 'invalid' });
      expect(normalizeCustomUrl('chatgpt')).toEqual({ ok: false, reason: 'invalid' });
      expect(normalizeCustomUrl('ftp://chatgpt.com/')).toEqual({ ok: false, reason: 'invalid' });
      expect(normalizeCustomUrl('chatgpt.com/g/g-abc')).toEqual({ ok: true, url: 'https://chatgpt.com/g/g-abc' });
      expect(normalizeCustomUrl('https://chatgpt.com/g/g-abc#old=1')).toEqual({ ok: true, url: 'https://chatgpt.com/g/g-abc' });
      expect(normalizeCustomUrl('http://example.com')).toEqual({ ok: true, url: 'http://example.com/' });
      // A port is not a scheme, and credentials mean it was not a web address.
      expect(normalizeCustomUrl('chat.example.com:8443/app')).toEqual({ ok: true, url: 'https://chat.example.com:8443/app' });
      expect(normalizeCustomUrl('mailto:me@example.com')).toEqual({ ok: false, reason: 'invalid' });
      expect(normalizeCustomUrl('javascript:alert(1)')).toEqual({ ok: false, reason: 'invalid' });
    });
  });

  describe('resolveLink', () => {
    test('defaults to ChatGPT with auto-send, and needs a prompt for the link', () => {
      const empty = resolveLink(state(), codec);
      expect(empty.baseUrl).toBe('https://chatgpt.com/');
      expect(empty.siteName).toBe('ChatGPT');
      expect(empty.title).toBe('ChatGPT');
      expect(empty.ready).toBe(false);
      expect(empty.url).toBe('');
      expect(empty.markdown).toBe('');
      // A shortcut without a prompt still works: the search terms become the prompt.
      expect(empty.siteSearchUrl).toBe('https://chatgpt.com/#autoSubmit=true&prompt=%s');

      const link = resolveLink(state({ prompt: 'hello', title: '  My link ' }), codec);
      expect(link.ready).toBe(true);
      expect(link.url).toBe('https://chatgpt.com/#autoSubmit=true&prompt=hello');
      expect(link.title).toBe('My link');
      expect(link.markdown).toBe('[My link](https://chatgpt.com/#autoSubmit=true&prompt=hello)');
    });

    test('drops options the site does not support', () => {
      const claude = resolveLink(state({ target: 'claude', prompt: 'hi', pasteImage: true, imageTool: true }), codec);
      expect(claude.unavailable).toEqual({ pasteImage: 'feature-unsupported', imageTool: 'feature-unsupported' });
      expect(claude.url).toBe('https://claude.ai/#autoSubmit=true&prompt=hi');

      const images = resolveLink(state({ target: 'chatgpt-images', prompt: 'a cat', pasteImage: true, imageTool: true }), codec);
      expect(images.unavailable).toEqual({ imageTool: 'generates-images' });
      expect(images.url).toBe('https://chatgpt.com/images/#autoSubmit=true&pasteImage=true&prompt=a%20cat');
    });

    test('the image tool alone makes a link', () => {
      expect(resolveLink(state({ imageTool: true }), codec).url).toBe('https://chatgpt.com/#autoSubmit=true&tool=image&prompt=');
      expect(resolveLink(state({ target: 'claude', imageTool: true }), codec).ready).toBe(false);
    });

    test('reports custom URL problems and unsupported sites', () => {
      expect(resolveLink(state({ target: 'custom', customUrl: '' }), codec)).toMatchObject({ baseUrl: null, problem: 'empty', ready: false, siteSearchUrl: '' });
      expect(resolveLink(state({ target: 'custom', customUrl: 'nope' }), codec)).toMatchObject({ baseUrl: null, problem: 'invalid' });

      const gpt = resolveLink(state({ target: 'custom', customUrl: 'https://chatgpt.com/g/g-abc', prompt: 'hi', imageTool: true }), codec);
      expect(gpt).toMatchObject({ problem: null, siteName: 'ChatGPT', title: 'ChatGPT', ready: true });
      expect(gpt.url).toBe('https://chatgpt.com/g/g-abc#autoSubmit=true&tool=image&prompt=hi');

      const other = resolveLink(state({ target: 'custom', customUrl: 'example.com/chat', prompt: 'hi' }), codec);
      expect(other).toMatchObject({ site: null, siteName: 'example.com', title: 'example.com', ready: true });
      expect(other.unavailable).toEqual({ autoSubmit: 'site-unsupported', pasteImage: 'site-unsupported', imageTool: 'site-unsupported' });
      expect(other.url).toBe('https://example.com/chat#autoSubmit=false&prompt=hi');

      // Nothing to check the options against until the URL is valid.
      expect(resolveLink(state({ target: 'custom', customUrl: 'nope' }), codec).unavailable).toEqual({});
    });

    test('names the site search entry and picks the bookmark icon', () => {
      expect(resolveLink(state({ target: 'gemini', title: 'Ask' }), codec)).toMatchObject({ icon: 'sparkle', siteSearchName: 'Ask' });
      expect(resolveLink(state({ target: 'custom', customUrl: 'https://chatgpt.com/images' }), codec)).toMatchObject({ icon: 'image', siteSearchName: 'ChatGPT Images' });
      expect(resolveLink(state({ target: 'custom', customUrl: 'https://www.phind.com/' }), codec)).toMatchObject({ icon: 'globe', siteSearchName: 'Phind' });
      expect(resolveLink(state({ target: 'custom', customUrl: '' }), codec)).toMatchObject({ icon: 'globe', siteSearchName: '' });
    });

    test('knows whether the prompt has a search terms placeholder', () => {
      expect(resolveLink(state({ prompt: 'Explain %s' }), codec).searchTermsInPrompt).toBe(true);
      expect(resolveLink(state({ prompt: 'Explain' }), codec).searchTermsInPrompt).toBe(false);
    });
  });

  describe('state persistence', () => {
    const memoryStorage = () => {
      const store = new Map<string, string>();
      return {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        store,
      };
    };

    test('round-trips through storage', () => {
      const storage = memoryStorage();
      const saved = state({ target: 'custom', customUrl: 'https://chatgpt.com/g/g-1', title: 'T', prompt: 'P', autoSubmit: false, pasteImage: true, imageTool: true });
      expect(writeState(storage, saved)).toBe(true);
      expect(storage.store.has(LINK_BUILDER_STORAGE_KEY)).toBe(true);
      expect(readState(storage)).toEqual(saved);
    });

    test('falls back to defaults for missing, invalid or unreadable data', () => {
      expect(readState(null)).toEqual(DEFAULT_STATE);
      expect(readState({ getItem: () => '{not json' })).toEqual(DEFAULT_STATE);
      expect(readState({ getItem: () => { throw new Error('blocked'); } })).toEqual(DEFAULT_STATE);
      expect(writeState({ getItem: () => null, setItem: () => { throw new Error('quota'); } }, state())).toBe(false);
      expect(parseState({ target: 'bing', prompt: 42, autoSubmit: 'yes', pasteImage: true, extra: 1 }))
        .toEqual({ ...DEFAULT_STATE, pasteImage: true });
    });
  });

  describe('importing links', () => {
    test('reads prompt links back into settings', () => {
      const prompt = 'Please review the following code and provide feedback on code quality.';
      const link = buildPromptLink('https://gemini.google.com/app', params({ prompt, autoSubmit: false, pasteImage: true, imageTool: true }), codec);
      expect(parseImportedLink(link, codec)).toEqual(state({ target: 'gemini', prompt, autoSubmit: false, pasteImage: true, imageTool: true }));

      expect(parseImportedLink('https://chatgpt.com/g/g-abc-dictionary#autoSubmit=1&prompt=hello', codec))
        .toEqual(state({ target: 'custom', customUrl: 'https://chatgpt.com/g/g-abc-dictionary', prompt: 'hello', autoSubmit: true }));
      expect(parseImportedLink('https://chat.openai.com/chat/#autoSubmit=0&prompt=你好', codec))
        .toEqual(state({ target: 'custom', customUrl: 'https://chat.openai.com/chat/', prompt: '你好', autoSubmit: false }));
    });

    test('treats everything after prompt= as the prompt, like the content script', () => {
      const link = 'https://chatgpt.com/#autoSubmit=true&prompt=Tell me A&subject=x';
      expect(openLink(link).prompt).toBe('Tell me A&subject=x');
      expect(parseImportedLink(link, codec)).toEqual(state({ target: 'chatgpt', prompt: 'Tell me A&subject=x' }));
    });

    test('reads the Markdown the page writes, including the link name', () => {
      const url = buildPromptLink('https://claude.ai/', params({ prompt: 'Explain (briefly) [x]' }), codec);
      const markdown = buildMarkdownLink('Ask [Claude] (fast)', url);
      expect(parseImportedLink(`  ${markdown}\n`, codec)).toEqual(state({ target: 'claude', title: 'Ask [Claude] (fast)', prompt: 'Explain (briefly) [x]' }));
      expect(parseImportedLink('[](https://claude.ai/#prompt=hi)', codec)).toEqual(state({ target: 'claude', prompt: 'hi', autoSubmit: false }));
      expect(parseImportedLink('[name](not a url)', codec)).toBeNull();
    });

    test('reads site search templates (bare %s)', () => {
      const url = buildSiteSearchUrl('https://claude.ai/', params({ prompt: 'Explain %s simply' }));
      expect(parseImportedLink(url, codec)).toEqual(state({ target: 'claude', prompt: 'Explain %s simply' }));
    });

    test("reads the original web builder's share links", () => {
      const share = 'https://ct-link-builder.gh.miniasp.com/#aiProvider=gemini&baseurl=https%3A%2F%2Fgemini.google.com%2Fapp'
        + '&subject=%E7%BF%BB%E8%AD%AF&=&prompt=Translate%20%2B%20explain%0A%25s&tool=image&autoSubmit=false&pasteImage=true&';
      expect(parseImportedLink(share, codec)).toEqual(state({
        target: 'gemini', title: '翻譯', prompt: 'Translate + explain\n%s', imageTool: true, autoSubmit: false, pasteImage: true,
      }));

      const gpts = 'https://ct-link-builder.gh.miniasp.com/#aiProvider=chatgpt&baseurl=https%3A%2F%2Fchatgpt.com%2Fg%2Fg-To1h9Sf1w&subject=Dict&prompt=hi';
      expect(parseImportedLink(gpts, codec)).toMatchObject({ target: 'custom', customUrl: 'https://chatgpt.com/g/g-To1h9Sf1w', title: 'Dict' });
    });

    test('rejects text that is not a prompt link', () => {
      expect(parseImportedLink('', codec)).toBeNull();
      expect(parseImportedLink('hello world', codec)).toBeNull();
      expect(parseImportedLink('https://chatgpt.com/', codec)).toBeNull();
      expect(parseImportedLink('https://chatgpt.com/#autoSubmit=true', codec)).toBeNull();
      expect(parseImportedLink('https://example.com/#section-2', codec)).toBeNull();
    });

    test('builder hash parameters only include the fields that are present', () => {
      expect(parseBuilderParams('#prompt=hi%20there')).toEqual({ prompt: 'hi there' });
      expect(parseBuilderParams('#aiProvider=claude&autoSubmit=false')).toEqual({ target: 'claude', customUrl: '', autoSubmit: false });
      expect(parseBuilderParams('#section')).toBeNull();
      expect(parseBuilderParams('')).toBeNull();
    });
  });

  describe('templates', () => {
    test('follow the language of the extension messages', () => {
      const zh = getPromptTemplates('zh-Hant-TW');
      const en = getPromptTemplates('en');
      const ja = getPromptTemplates('ja');
      expect(zh[0]).toEqual({ name: '使用正體中文回應', prompt: '請以台灣常用的正體中文回應。' });
      expect(en[0].name).toBe('Reply in English');
      expect(ja[0].name).toBe('日本語で回答');
      expect(getPromptTemplates('fr')).toBe(en);
      [zh, en, ja].forEach((list) => {
        expect(list).toHaveLength(14);
        list.forEach((template) => {
          expect(template.name.trim()).not.toBe('');
          expect(template.prompt.trim()).not.toBe('');
        });
        expect(new Set(list.map((template) => template.name)).size).toBe(list.length);
      });
    });
  });
});
