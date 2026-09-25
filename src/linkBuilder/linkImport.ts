import { findProvider, findProviderByUrl } from './sites';
import { DEFAULT_STATE, type LinkBuilderState } from './state';

export type HashCodec = Pick<ChatGPTToolkitContentUtils, 'parseToolkitHash'>;

/** Hash parameters of the original web builder: its "share" links and deep links to this page. */
const BUILDER_KEYS = ['aiProvider', 'baseurl', 'subject', 'prompt', 'tool', 'autoSubmit', 'pasteImage'];
/** Only builder links carry these, and always before `prompt=`. */
const SHARE_ONLY_KEYS = ['aiProvider', 'baseurl', 'subject'];

/** `[name](url)`, as the page's Markdown output writes it (brackets in the name escaped). */
const MARKDOWN_LINK = /^\[((?:\\.|[^\\\]])*)\]\((\S+)\)$/;

type TargetFields = Pick<LinkBuilderState, 'target' | 'customUrl'>;

/** The provider tile for a URL, or the URL as a custom target. */
function targetForUrl(url: string): TargetFields {
  const provider = findProviderByUrl(url);
  return provider ? { target: provider.id, customUrl: '' } : { target: 'custom', customUrl: url };
}

function targetFromBuilderParams(params: URLSearchParams): TargetFields | null {
  const baseUrl = params.get('baseurl')?.trim();
  if (baseUrl) return targetForUrl(baseUrl);
  const provider = findProvider(params.get('aiProvider'));
  return provider ? { target: provider.id, customUrl: '' } : null;
}

/**
 * Read builder hash parameters (`#aiProvider=…&subject=…&prompt=…`). Only the fields that are present are
 * returned, so they can be applied on top of the saved state; `null` when there are none.
 */
export function parseBuilderParams(hash: string): Partial<LinkBuilderState> | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (!BUILDER_KEYS.some((key) => params.has(key))) return null;

  const fields: Partial<LinkBuilderState> = { ...targetFromBuilderParams(params) };
  if (params.has('subject')) fields.title = params.get('subject') ?? '';
  if (params.has('prompt')) fields.prompt = params.get('prompt') ?? '';
  if (params.has('tool')) fields.imageTool = params.get('tool') === 'image';
  // The original builder wrote checkboxes as "true"/"false" and treated anything but "false" as checked.
  if (params.has('autoSubmit')) fields.autoSubmit = params.get('autoSubmit') !== 'false';
  if (params.has('pasteImage')) fields.pasteImage = params.get('pasteImage') !== 'false';
  return fields;
}

function parseToolkitHashSafely(hash: string, search: string, codec: HashCodec): ReturnType<HashCodec['parseToolkitHash']> | null {
  try {
    return codec.parseToolkitHash(hash, search);
  } catch {
    // Site search URLs contain a bare `%s`, which is not valid percent-encoding.
    try {
      return codec.parseToolkitHash(hash.replace(/%s/g, '%25s'), search);
    } catch {
      return null;
    }
  }
}

function parseLinkUrl(input: string, codec: HashCodec): LinkBuilderState | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  const hash = url.hash.replace(/^#/, '');
  if (!hash) return null;

  // In prompt links everything after `prompt=` is prompt text, so only look for share keys before it.
  const beforePrompt = new URLSearchParams(hash.split(/(?:^|&)prompt=/)[0]);
  if (SHARE_ONLY_KEYS.some((key) => beforePrompt.has(key))) {
    return { ...DEFAULT_STATE, ...parseBuilderParams(hash) };
  }

  const parsed = parseToolkitHashSafely(hash, url.search, codec);
  if (!parsed || (!parsed.prompt && parsed.tool !== 'image')) return null;

  url.hash = '';
  return {
    ...DEFAULT_STATE,
    ...targetForUrl(url.href),
    prompt: parsed.prompt ?? '',
    autoSubmit: parsed.autoSubmit,
    pasteImage: parsed.pasteImage,
    imageTool: parsed.tool === 'image',
  };
}

/**
 * Turn a pasted link back into builder settings: a prompt link for any site (decoded exactly like the
 * content script does), a Markdown link to one (its text becomes the link name), or a share link from the
 * original web builder. `null` when it is none of these.
 */
export function parseImportedLink(input: string, codec: HashCodec): LinkBuilderState | null {
  const text = input.trim();
  const markdown = MARKDOWN_LINK.exec(text);
  const imported = parseLinkUrl(markdown ? markdown[2] : text, codec);
  if (!imported || !markdown) return imported;

  const title = markdown[1].replace(/\\(.)/g, '$1');
  return title.trim() ? { ...imported, title } : imported;
}
