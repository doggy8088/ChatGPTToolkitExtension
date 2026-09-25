import type { IconName } from '../options/ui/icons';
import {
  LINK_OPTIONS,
  buildMarkdownLink,
  buildPromptLink,
  buildSiteSearchUrl,
  hasSearchTermsPlaceholder,
  type LinkOptions,
  type PromptCodec,
  type PromptLinkParams,
} from './promptLink';
import {
  findProvider,
  getSupportedSite,
  isTargetChoice,
  normalizeCustomUrl,
  type CustomUrlProblem,
  type SupportedSite,
  type TargetChoice,
} from './sites';

export interface LinkBuilderState extends LinkOptions {
  target: TargetChoice;
  /** Used when `target` is `custom`. */
  customUrl: string;
  /** Link name; empty means "use the AI service name". */
  title: string;
  prompt: string;
}

export const DEFAULT_STATE: Readonly<LinkBuilderState> = {
  target: 'chatgpt',
  customUrl: '',
  title: '',
  prompt: '',
  autoSubmit: true,
  pasteImage: false,
  imageTool: false,
};

export const LINK_BUILDER_STORAGE_KEY = 'chatgpttoolkit.linkBuilder';

type StateStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Normalize stored or imported data; unknown and invalid fields fall back to the defaults.
 */
export function parseState(value: unknown): LinkBuilderState {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const state: LinkBuilderState = { ...DEFAULT_STATE };
  if (isTargetChoice(source.target)) state.target = source.target;
  (['customUrl', 'title', 'prompt'] as const).forEach((key) => {
    if (typeof source[key] === 'string') state[key] = source[key] as string;
  });
  LINK_OPTIONS.forEach((key) => {
    if (typeof source[key] === 'boolean') state[key] = source[key] as boolean;
  });
  return state;
}

export function readState(storage: Pick<Storage, 'getItem'> | null | undefined): LinkBuilderState {
  if (!storage) return { ...DEFAULT_STATE };
  try {
    const raw = storage.getItem(LINK_BUILDER_STORAGE_KEY);
    return parseState(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function writeState(storage: StateStorage | null | undefined, state: LinkBuilderState): boolean {
  if (!storage) return false;
  try {
    storage.setItem(LINK_BUILDER_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/**
 * Why an option cannot be used: the extension does not run on the site, the page already generates images
 * (ChatGPT Images, for the image tool), or the site does not support the option.
 */
export type UnavailableReason = 'site-unsupported' | 'generates-images' | 'feature-unsupported';

/**
 * Everything the page shows, derived from the state.
 */
export interface ResolvedLink {
  /** Where the link opens; `null` when the custom URL is empty or invalid (see `problem`). */
  baseUrl: string | null;
  problem: CustomUrlProblem | null;
  /** `null` when the extension does not run on `baseUrl`, so nothing is filled in. */
  site: SupportedSite | null;
  /** AI service name for labels such as "Open in …"; the host name for other sites. */
  siteName: string;
  /** Icon of the AI service (a globe for other sites). */
  icon: IconName;
  /**
   * The options the target cannot use, and why; they are left out of the links. Empty until a valid URL
   * is known, since there is nothing to check the options against.
   */
  unavailable: Partial<Record<keyof LinkOptions, UnavailableReason>>;
  /** The link name, falling back to `siteName`. */
  title: string;
  /** A link can be made: the target is valid and there is a prompt (or the image tool to open). */
  ready: boolean;
  url: string;
  markdown: string;
  /** Available whenever the target is valid: an empty prompt makes a plain "ask the AI" shortcut. */
  siteSearchUrl: string;
  /** Name for the site search entry; empty while the target is invalid. */
  siteSearchName: string;
  searchTermsInPrompt: boolean;
}

function resolveTarget(state: LinkBuilderState): { baseUrl: string | null; problem: CustomUrlProblem | null; name: string } {
  const provider = state.target === 'custom' ? undefined : findProvider(state.target);
  if (provider) return { baseUrl: provider.url, problem: null, name: provider.name };

  const custom = normalizeCustomUrl(state.customUrl);
  if (!custom.ok) return { baseUrl: null, problem: custom.reason, name: '' };
  return { baseUrl: custom.url, problem: null, name: '' };
}

export function resolveLink(state: LinkBuilderState, codec: PromptCodec): ResolvedLink {
  const target = resolveTarget(state);
  const url = target.baseUrl ? new URL(target.baseUrl) : null;
  const site = url ? getSupportedSite(url) : null;

  const unavailable: ResolvedLink['unavailable'] = {};
  if (url && !site) {
    LINK_OPTIONS.forEach((key) => {
      unavailable[key] = 'site-unsupported';
    });
  } else if (site) {
    if (!site.features.pasteImage) unavailable.pasteImage = 'feature-unsupported';
    if (!site.features.imageTool) unavailable.imageTool = site.generatesImages ? 'generates-images' : 'feature-unsupported';
  }
  const params: PromptLinkParams = {
    prompt: state.prompt,
    autoSubmit: state.autoSubmit && !unavailable.autoSubmit,
    pasteImage: state.pasteImage && !unavailable.pasteImage,
    imageTool: state.imageTool && !unavailable.imageTool,
  };

  const siteName = target.name || site?.name || url?.hostname || '';
  const icon = (findProvider(state.target) ?? findProvider(site?.providerId))?.icon ?? 'globe';
  const title = state.title.trim() || siteName;
  const ready = Boolean(target.baseUrl) && (state.prompt.trim().length > 0 || params.imageTool);
  const link = ready && target.baseUrl ? buildPromptLink(target.baseUrl, params, codec) : '';

  return {
    baseUrl: target.baseUrl,
    problem: target.problem,
    site,
    siteName,
    icon,
    unavailable,
    title,
    ready,
    url: link,
    markdown: link ? buildMarkdownLink(title, link) : '',
    siteSearchUrl: target.baseUrl ? buildSiteSearchUrl(target.baseUrl, params) : '',
    siteSearchName: target.baseUrl ? title : '',
    searchTermsInPrompt: hasSearchTermsPlaceholder(state.prompt),
  };
}
