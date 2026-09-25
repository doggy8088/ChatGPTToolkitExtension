import type { IconName } from '../options/ui/icons';

/**
 * Optional link features the content script understands on a site (see `src/content/sites/*`).
 * `prompt` and `autoSubmit` work on every supported site.
 */
export interface SiteFeatures {
  /** `pasteImage=true`: paste the clipboard image into the composer. */
  pasteImage: boolean;
  /** `tool=image`: switch the composer to image generation before filling in the prompt. */
  imageTool: boolean;
}

const NO_FEATURES: Readonly<SiteFeatures> = { pasteImage: false, imageTool: false };
const IMAGE_FEATURES: Readonly<SiteFeatures> = { pasteImage: true, imageTool: true };

export type ProviderId = 'chatgpt' | 'chatgpt-images' | 'claude' | 'gemini' | 'groq' | 'perplexity';

/** A provider tile, or `custom` for a URL the user types (GPTs, projects, …). */
export type TargetChoice = ProviderId | 'custom';

export interface SupportedSite {
  name: string;
  features: Readonly<SiteFeatures>;
  /** The provider tile for this site, if it has one. */
  providerId?: ProviderId;
  /** The page itself creates images (ChatGPT Images), so it needs no image tool. */
  generatesImages?: boolean;
}

interface SiteEntry {
  hosts: readonly string[];
  site: SupportedSite;
  /** Pages of the same hosts that behave differently. */
  pages?: ReadonlyArray<{ path: RegExp; site: SupportedSite }>;
}

/**
 * Where the content script runs. Keep the hosts in sync with `content_scripts.matches` in manifest.json.
 */
const SITES: readonly SiteEntry[] = [
  {
    hosts: ['chatgpt.com', 'chat.openai.com'],
    site: { name: 'ChatGPT', features: IMAGE_FEATURES, providerId: 'chatgpt' },
    // The images page already generates images, so the `/image` tool command is skipped there.
    pages: [{
      path: /^\/images(\/|$)/,
      site: { name: 'ChatGPT Images', features: { pasteImage: true, imageTool: false }, providerId: 'chatgpt-images', generatesImages: true },
    }],
  },
  { hosts: ['gemini.google.com'], site: { name: 'Gemini', features: IMAGE_FEATURES, providerId: 'gemini' } },
  { hosts: ['claude.ai'], site: { name: 'Claude', features: NO_FEATURES, providerId: 'claude' } },
  { hosts: ['groq.com'], site: { name: 'Groq', features: NO_FEATURES, providerId: 'groq' } },
  { hosts: ['www.perplexity.ai'], site: { name: 'Perplexity', features: NO_FEATURES, providerId: 'perplexity' } },
  { hosts: ['www.phind.com'], site: { name: 'Phind', features: NO_FEATURES } },
];

export const SUPPORTED_HOSTS: readonly string[] = SITES.flatMap((entry) => entry.hosts);

/**
 * What the extension can do when a link opens `url`, or `null` when the content script does not run there.
 */
export function getSupportedSite(url: URL): SupportedSite | null {
  if (url.protocol !== 'https:') return null;
  const entry = SITES.find((item) => item.hosts.includes(url.hostname));
  if (!entry) return null;
  return entry.pages?.find((page) => page.path.test(url.pathname))?.site ?? entry.site;
}

export interface Provider {
  id: ProviderId;
  name: string;
  url: string;
  icon: IconName;
}

export const PROVIDERS: readonly Provider[] = [
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/', icon: 'message' },
  { id: 'chatgpt-images', name: 'ChatGPT Images', url: 'https://chatgpt.com/images/', icon: 'image' },
  { id: 'claude', name: 'Claude', url: 'https://claude.ai/', icon: 'asterisk' },
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app', icon: 'sparkle' },
  { id: 'groq', name: 'Groq', url: 'https://groq.com/', icon: 'zap' },
  { id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai/', icon: 'compass' },
];

export function isTargetChoice(value: unknown): value is TargetChoice {
  return value === 'custom' || PROVIDERS.some((provider) => provider.id === value);
}

export function findProvider(id: string | null | undefined): Provider | undefined {
  return PROVIDERS.find((provider) => provider.id === id);
}

const withoutTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

/**
 * The provider whose URL is `url` (trailing slashes ignored), e.g. to recognize imported links.
 */
export function findProviderByUrl(url: string): Provider | undefined {
  const normalized = withoutTrailingSlash(url);
  return PROVIDERS.find((provider) => withoutTrailingSlash(provider.url) === normalized);
}

export type CustomUrlProblem = 'empty' | 'invalid';
export type CustomUrlResult = { ok: true; url: string } | { ok: false; reason: CustomUrlProblem };

/**
 * Validate a typed URL. `https://` is added when the scheme is missing (so `host:port/path` works too) and any
 * `#fragment` is dropped, because the link parameters go in the fragment.
 */
export function normalizeCustomUrl(input: string): CustomUrlResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  const isWebUrl = (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.includes('.');
  // Credentials mean the text was not a web address (e.g. `mailto:me@example.com` read as `https://mailto:me@…`).
  if (!isWebUrl || url.username || url.password) {
    return { ok: false, reason: 'invalid' };
  }

  url.hash = '';
  return { ok: true, url: url.href };
}
