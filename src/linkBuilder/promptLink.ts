/**
 * Builds the links the content script reads: `https://chatgpt.com/#autoSubmit=true&prompt=…`.
 * Decoding lives in `scripts/content-utils.js` (`parseToolkitHash`); the same file provides the
 * helpers used here, so both sides always agree.
 */
export type PromptCodec = Pick<ChatGPTToolkitContentUtils, 'b64EncodeUnicode' | 'isBase64Unicode' | 'flexiblePromptDetection'>;

/** What happens when a link opens. */
export interface LinkOptions {
  autoSubmit: boolean;
  pasteImage: boolean;
  imageTool: boolean;
}

export const LINK_OPTIONS: readonly (keyof LinkOptions)[] = ['autoSubmit', 'pasteImage', 'imageTool'];

export interface PromptLinkParams extends LinkOptions {
  prompt: string;
}

/** Chrome site search replaces this with what the user types in the address bar. */
export const SEARCH_TERMS_PLACEHOLDER = '%s';

/** Prompts whose Base64 form is shorter than this stay readable in the link (as the original web builder did). */
const MIN_BASE64_LENGTH = 64;

/**
 * `encodeURIComponent` that also escapes `!'()*`, so a link survives Markdown and chat apps
 * that stop auto-linking at a parenthesis.
 */
export function encodeUrlComponentStrict(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * Value of the `prompt=` parameter. The content script decodes Base64 exactly, but trims readable prompts
 * and normalizes their line breaks. So longer prompts are Base64-encoded, and short ones stay readable unless:
 * - the content script would mistake the trimmed text for Base64, or
 * - it would change the text, and the Base64 form is long enough for it to recognize (32+ characters).
 */
export function encodePromptParam(prompt: string, codec: PromptCodec): string {
  const base64 = codec.b64EncodeUnicode(prompt);
  const readable = encodeUrlComponentStrict(prompt);
  if (base64.length >= MIN_BASE64_LENGTH) return encodeUrlComponentStrict(base64);

  const decodedByContentScript = codec.flexiblePromptDetection(`prompt=${readable}`, '') ?? '';
  const mistakenForBase64 = codec.isBase64Unicode(decodedByContentScript);
  const keepsExactText = decodedByContentScript !== prompt && codec.isBase64Unicode(base64);
  return mistakenForBase64 || keepsExactText ? encodeUrlComponentStrict(base64) : readable;
}

function flagParams(options: LinkOptions): string[] {
  const flags = [`autoSubmit=${options.autoSubmit}`];
  if (options.pasteImage) flags.push('pasteImage=true');
  if (options.imageTool) flags.push('tool=image');
  return flags;
}

/**
 * The prompt goes last: the content script treats everything after `prompt=` as the prompt.
 */
export function buildPromptLink(baseUrl: string, params: PromptLinkParams, codec: PromptCodec): string {
  return `${baseUrl}#${[...flagParams(params), `prompt=${encodePromptParam(params.prompt, codec)}`].join('&')}`;
}

export function hasSearchTermsPlaceholder(prompt: string): boolean {
  return prompt.includes(SEARCH_TERMS_PLACEHOLDER);
}

/**
 * The prompt used for site search: without `%s`, the search terms go on a new paragraph after the prompt.
 */
export function getSiteSearchPrompt(prompt: string): string {
  if (hasSearchTermsPlaceholder(prompt)) return prompt;
  const trimmed = prompt.replace(/\s+$/, '');
  return trimmed ? `${trimmed}\n\n${SEARCH_TERMS_PLACEHOLDER}` : SEARCH_TERMS_PLACEHOLDER;
}

/**
 * "URL with %s in place of query" for a Chrome site search shortcut. The prompt cannot be Base64-encoded
 * here because Chrome has to find and replace every `%s`.
 */
export function buildSiteSearchUrl(baseUrl: string, params: PromptLinkParams): string {
  const prompt = encodeUrlComponentStrict(getSiteSearchPrompt(params.prompt)).replace(/%25s/g, SEARCH_TERMS_PLACEHOLDER);
  return `${baseUrl}#${[...flagParams(params), `prompt=${prompt}`].join('&')}`;
}

/**
 * `[title](url)` with the brackets in the title escaped and the parentheses in the URL encoded.
 */
export function buildMarkdownLink(title: string, url: string): string {
  const text = title.replace(/[\\[\]]/g, '\\$&');
  const href = url.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/ /g, '%20');
  return `[${text}](${href})`;
}
