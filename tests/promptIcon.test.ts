import { describe, test, expect } from 'bun:test';
import {
  DEFAULT_PROMPT_ICON,
  isSvgMarkup,
  renderPromptIcon,
  sanitizeSvgMarkup,
} from '../src/options/utils/promptIcon';
import { ensureHappyDom } from './utils/happyDom';

ensureHappyDom();

const SVG_NS = 'http://www.w3.org/2000/svg';

function serialize(node: Node | null): string {
  return node ? new XMLSerializer().serializeToString(node) : '';
}

describe('promptIcon', () => {
  describe('isSvgMarkup', () => {
    test('detects svg markup', () => {
      expect(isSvgMarkup('<svg viewBox="0 0 24 24"></svg>')).toBe(true);
      expect(isSvgMarkup('  <SVG>')).toBe(true);
      expect(isSvgMarkup('<svg/>')).toBe(true);
    });

    test('rejects other values', () => {
      expect(isSvgMarkup('📝')).toBe(false);
      expect(isSvgMarkup('<svgfoo>')).toBe(false);
      expect(isSvgMarkup('<img src=x onerror=alert(1)>')).toBe(false);
      expect(isSvgMarkup('text <svg></svg>')).toBe(false);
    });
  });

  describe('renderPromptIcon', () => {
    test('renders emoji as a text node', () => {
      const node = renderPromptIcon('🍥');
      expect(node.nodeType).toBe(Node.TEXT_NODE);
      expect(node.textContent).toBe('🍥');
    });

    test('renders non-svg HTML as literal text, never as elements', () => {
      const markup = '<img src=x onerror="alert(1)">';
      const node = renderPromptIcon(markup);
      expect(node.nodeType).toBe(Node.TEXT_NODE);
      expect(node.textContent).toBe(markup);

      const container = document.createElement('div');
      container.append(node);
      expect(container.querySelector('img')).toBeNull();
    });

    test('falls back for empty, missing or non-string values', () => {
      expect(renderPromptIcon('').textContent).toBe(DEFAULT_PROMPT_ICON);
      expect(renderPromptIcon('   ').textContent).toBe(DEFAULT_PROMPT_ICON);
      expect(renderPromptIcon(undefined).textContent).toBe(DEFAULT_PROMPT_ICON);
      expect(renderPromptIcon(42).textContent).toBe(DEFAULT_PROMPT_ICON);
      expect(renderPromptIcon(null, '★').textContent).toBe('★');
    });

    test('falls back when svg markup is malformed', () => {
      expect(renderPromptIcon('<svg><circle></svg>').textContent).toBe(DEFAULT_PROMPT_ICON);
    });

    test('renders valid svg as an SVG element', () => {
      const node = renderPromptIcon('<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>') as Element;
      expect(node.nodeType).toBe(Node.ELEMENT_NODE);
      expect(node.namespaceURI).toBe(SVG_NS);
      expect(node.localName).toBe('svg');
      expect(node.getAttribute('aria-hidden')).toBe('true');
      expect(node.querySelector('circle')?.getAttribute('r')).toBe('10');
    });
  });

  describe('sanitizeSvgMarkup', () => {
    test('adds the SVG namespace when missing', () => {
      const svg = sanitizeSvgMarkup('<svg viewBox="0 0 1 1"><rect width="1" height="1"/></svg>');
      expect(svg?.namespaceURI).toBe(SVG_NS);
      expect(svg?.querySelector('rect')).not.toBeNull();
    });

    test('keeps an existing namespace declaration', () => {
      const svg = sanitizeSvgMarkup(`<svg xmlns="${SVG_NS}" viewBox="0 0 1 1"><path d="M0 0h1"/></svg>`);
      expect(svg?.querySelector('path')?.getAttribute('d')).toBe('M0 0h1');
    });

    test('drops script, foreignObject and style elements', () => {
      const svg = sanitizeSvgMarkup(
        '<svg><script>alert(1)</script><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>' +
        '<style>body{display:none}</style><circle r="1"/></svg>'
      );
      const output = serialize(svg);
      expect(output).not.toContain('script');
      expect(output).not.toContain('foreignObject');
      expect(output).not.toContain('style');
      expect(output).not.toContain('display:none');
      expect(svg?.querySelector('circle')).not.toBeNull();
    });

    test('drops elements outside the SVG namespace', () => {
      const svg = sanitizeSvgMarkup(
        '<svg xmlns:h="http://www.w3.org/1999/xhtml"><h:script>alert(1)</h:script><h:iframe src="https://example.com"/><g/></svg>'
      );
      const output = serialize(svg);
      expect(output).not.toContain('script');
      expect(output).not.toContain('iframe');
      expect(svg?.querySelector('g')).not.toBeNull();
    });

    test('removes every on* event handler attribute, including on the root', () => {
      const svg = sanitizeSvgMarkup('<svg onload="alert(1)"><g onclick="alert(2)"><circle onmouseover="alert(3)" r="2"/></g></svg>');
      expect(serialize(svg)).not.toMatch(/\son[a-z]+=/i);
      expect(svg?.querySelector('circle')?.getAttribute('r')).toBe('2');
    });

    test('removes javascript: and external hrefs but keeps fragment references', () => {
      const svg = sanitizeSvgMarkup(
        '<svg xmlns:xlink="http://www.w3.org/1999/xlink">' +
        '<a href="javascript:alert(1)"><text>a</text></a>' +
        '<a xlink:href=" JaVa&#x0A;Script:alert(2)"><text>b</text></a>' +
        '<image href="https://tracker.example/pixel.png"/>' +
        '<use href="#shape"/>' +
        '</svg>'
      );
      const output = serialize(svg);
      expect(output.toLowerCase()).not.toContain('javascript');
      expect(output).not.toContain('tracker.example');
      expect(svg?.querySelector('use')?.getAttribute('href')).toBe('#shape');
    });

    test('removes attributes that load external resources through url()', () => {
      const svg = sanitizeSvgMarkup(
        '<svg><rect fill="url(https://evil.example/p.svg#g)" style="background:url(https://evil.example/x.png)" width="1"/>' +
        '<rect fill="url(#local)" width="2"/><rect fill="url(\'#quoted\')" width="3"/></svg>'
      );
      const rects = Array.from(svg?.querySelectorAll('rect') ?? []);
      expect(rects[0].hasAttribute('fill')).toBe(false);
      expect(rects[0].hasAttribute('style')).toBe(false);
      expect(rects[0].getAttribute('width')).toBe('1');
      expect(rects[1].getAttribute('fill')).toBe('url(#local)');
      expect(rects[2].getAttribute('fill')).toBe("url('#quoted')");
    });

    test('drops animations that target href or event attributes', () => {
      const svg = sanitizeSvgMarkup(
        '<svg><a><set attributeName="href" to="javascript:alert(1)"/><animate attributeName="onclick" values="alert(1)"/>' +
        '<animate attributeName="opacity" values="0;1" dur="1s"/><text>x</text></a></svg>'
      );
      const animations = Array.from(svg?.querySelectorAll('set, animate') ?? []);
      expect(animations).toHaveLength(1);
      expect(animations[0].getAttribute('attributeName')).toBe('opacity');
    });

    test('returns null for non-svg or malformed markup', () => {
      expect(sanitizeSvgMarkup('<div>x</div>')).toBeNull();
      expect(sanitizeSvgMarkup('<svg><g></svg>')).toBeNull();
      expect(sanitizeSvgMarkup('📝')).toBeNull();
    });

    test('imports the result into the target document', () => {
      const svg = sanitizeSvgMarkup('<svg><circle r="1"/></svg>');
      expect(svg?.ownerDocument).toBe(document);
    });
  });
});
