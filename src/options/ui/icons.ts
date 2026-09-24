const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Names of the `<symbol id="icon-…">` entries in the SVG sprite at the top of `options.html`.
 */
export type IconName =
  | 'alert-circle'
  | 'alert-triangle'
  | 'arrow-up'
  | 'check-circle'
  | 'chevron-down'
  | 'chevron-up'
  | 'clipboard'
  | 'pencil'
  | 'plus'
  | 'text-cursor'
  | 'trash';

/**
 * Create a decorative `<svg><use href="#icon-name"/></svg>` element referencing the page sprite.
 */
export function createIcon(name: IconName, className: string = 'icon'): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#icon-${name}`);
  svg.appendChild(use);
  return svg;
}
