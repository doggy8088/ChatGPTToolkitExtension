import { describe, test, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');

/**
 * `dist/` is not committed, so a checkout that has not been rebuilt only has an older `dist/` (or none).
 * These two bundles predate the rule; everything else a page needs must be a committed file, so the pages
 * keep their styles and the link builder keeps working until the next build.
 */
const ALLOWED_DIST_ASSETS = ['dist/options.js', 'dist/theme-init.js'];

function localAssets(page: string): string[] {
  const html = readFileSync(resolve(ROOT, page), 'utf8');
  return [...html.matchAll(/<(?:script|link)\b[^>]*?\s(?:src|href)="([^"#]+)"/g)]
    .map((match) => match[1])
    .filter((path) => !/^[a-z]+:/i.test(path));
}

describe('extension pages', () => {
  test.each(['options.html', 'link-builder.html'])('%s only loads committed files (plus the existing dist bundles)', (page) => {
    const assets = localAssets(page);
    expect(assets.length).toBeGreaterThan(0);
    assets.forEach((path) => {
      if (path.startsWith('dist/')) {
        expect(ALLOWED_DIST_ASSETS).toContain(path);
      } else {
        expect(existsSync(resolve(ROOT, path))).toBe(true);
      }
    });
  });

  test('link-builder.html loads the shared codec before its bundle', () => {
    const assets = localAssets('link-builder.html');
    expect(assets.indexOf('scripts/content-utils.js')).toBeGreaterThan(-1);
    expect(assets.indexOf('scripts/content-utils.js')).toBeLessThan(assets.indexOf('scripts/link-builder.js'));
  });
});
