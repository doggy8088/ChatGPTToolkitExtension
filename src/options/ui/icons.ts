const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Names of the `<symbol id="icon-…">` entries in the SVG sprites at the top of `options.html`
 * and `link-builder.html` (each page only defines the icons it uses).
 */
export type IconName =
  | 'alert-circle'
  | 'alert-triangle'
  | 'arrow-up'
  | 'asterisk'
  | 'check'
  | 'check-circle'
  | 'chevron-down'
  | 'chevron-up'
  | 'clipboard'
  | 'compass'
  | 'copy'
  | 'globe'
  | 'image'
  | 'message'
  | 'pencil'
  | 'plus'
  | 'sparkle'
  | 'text-cursor'
  | 'trash'
  | 'zap';

/** `href` of a sprite symbol, for `<use>` elements that switch icons. */
export const iconHref = (name: IconName): string => `#icon-${name}`;

/**
 * Create a decorative `<svg><use href="#icon-name"/></svg>` element referencing the page sprite.
 */
export function createIcon(name: IconName, className: string = 'icon'): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', iconHref(name));
  svg.appendChild(use);
  return svg;
}
