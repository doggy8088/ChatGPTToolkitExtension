/**
 * Safe rendering of a prompt's `svgIcon` value.
 *
 * `svgIcon` is user data (it can arrive through JSON import), so it is never injected as HTML.
 * Plain values (usually an emoji) are rendered as text. Values that look like `<svg …>` markup are
 * parsed as XML and sanitized before being imported into the page.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

const BLOCKED_ELEMENTS = new Set([
  'script',
  'foreignobject',
  'style',
  'iframe',
  'embed',
  'object',
  'audio',
  'video',
  'canvas',
  'handler',
  'listener',
]);

const ANIMATION_ELEMENTS = new Set(['animate', 'set', 'animatemotion', 'animatetransform', 'animatecolor']);

// `url(` that does not point at a same-document fragment (`url(#id)`).
const EXTERNAL_URL_REFERENCE = /url\s*\(\s*(?!['"]?\s*#)/i;

export const DEFAULT_PROMPT_ICON = '📝';

export function isSvgMarkup(value: string): boolean {
  return /^\s*<svg[\s>/]/i.test(value);
}

function isScriptUrl(value: string): boolean {
  // Browsers ignore ASCII whitespace/control characters inside the scheme (e.g. "java\nscript:").
  const compact = value.replace(/[\u0000- \u007f-\u009f]/g, '').toLowerCase();
  return compact.startsWith('javascript:') || compact.startsWith('vbscript:');
}

function sanitizeAttributes(element: Element): void {
  Array.from(element.attributes).forEach((attribute) => {
    const localName = attribute.localName.toLowerCase();
    const value = attribute.value;

    const shouldRemove =
      localName.startsWith('on') ||
      (localName === 'href' && !value.trim().startsWith('#')) ||
      EXTERNAL_URL_REFERENCE.test(value) ||
      isScriptUrl(value);

    if (shouldRemove) {
      element.removeAttributeNode(attribute);
    }
  });
}

function shouldRemoveElement(element: Element): boolean {
  if (element.namespaceURI !== SVG_NS) return true;

  const name = element.localName.toLowerCase();
  if (BLOCKED_ELEMENTS.has(name)) return true;

  if (ANIMATION_ELEMENTS.has(name)) {
    const target = (element.getAttribute('attributeName') || '').trim().toLowerCase();
    if (target.startsWith('on') || target.endsWith('href')) return true;
  }

  return false;
}

function hasParserError(doc: Document): boolean {
  return doc.getElementsByTagName('parsererror').length > 0
    || doc.getElementsByTagNameNS('*', 'parsererror').length > 0;
}

/**
 * Parse and sanitize SVG markup. Returns `null` when the markup is not a well-formed `<svg>` document.
 */
export function sanitizeSvgMarkup(markup: string, targetDocument: Document = document): SVGSVGElement | null {
  if (!isSvgMarkup(markup)) return null;

  let source = markup.trim();
  // SVG copied from HTML often omits the namespace, which XML parsing requires.
  const openTag = source.match(/^<svg\b[^>]*>/i)?.[0] ?? '';
  if (!/\sxmlns\s*=/.test(openTag)) {
    source = source.replace(/^<svg\b/i, `<svg xmlns="${SVG_NS}"`);
  }

  let parsed: Document;
  try {
    parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
  } catch {
    return null;
  }

  const root = parsed.documentElement;
  if (!root || hasParserError(parsed) || root.namespaceURI !== SVG_NS || root.localName.toLowerCase() !== 'svg') {
    return null;
  }

  const elements = [root, ...Array.from(root.getElementsByTagName('*'))];
  elements.forEach((element) => {
    if (element !== root && shouldRemoveElement(element)) {
      element.remove();
      return;
    }
    sanitizeAttributes(element);
  });

  const imported = targetDocument.importNode(root, true) as unknown as SVGSVGElement;
  imported.setAttribute('aria-hidden', 'true');
  imported.setAttribute('focusable', 'false');
  return imported;
}

/**
 * Create a DOM node for a prompt icon: sanitized SVG, or a text node for anything else.
 */
export function renderPromptIcon(
  icon: unknown,
  fallback: string = DEFAULT_PROMPT_ICON,
  targetDocument: Document = document
): Node {
  const value = typeof icon === 'string' ? icon.trim() : '';
  if (!value) return targetDocument.createTextNode(fallback);

  if (isSvgMarkup(value)) {
    return sanitizeSvgMarkup(value, targetDocument) ?? targetDocument.createTextNode(fallback);
  }

  return targetDocument.createTextNode(value);
}
