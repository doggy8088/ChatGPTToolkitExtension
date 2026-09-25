import { build } from 'bun';

console.log('Building TypeScript files...');

const debugEnv = (process.env.CHATGPT_TOOLKIT_DEBUG || '').toLowerCase();
const debugDefine = debugEnv === '0' || debugEnv === 'false' ? 'false' : 'true';

// Extension pages that show the version in their footer (<span id="appVersion">).
const VERSIONED_PAGES = ['options.html', 'link-builder.html'];

const updatePageVersions = async (): Promise<void> => {
  const manifest = await Bun.file('manifest.json').json() as { version?: string };
  const version = manifest.version;
  if (!version || typeof version !== 'string') {
    throw new Error('manifest.json is missing a valid version field.');
  }

  const versionPattern = /(<span id="appVersion">)([^<]*)(<\/span>)/;
  for (const pagePath of VERSIONED_PAGES) {
    const pageHtml = await Bun.file(pagePath).text();
    if (!versionPattern.test(pageHtml)) {
      throw new Error(`${pagePath} is missing <span id="appVersion"> for version injection.`);
    }

    const updatedHtml = pageHtml.replace(versionPattern, `$1${version}$3`);
    if (updatedHtml !== pageHtml) {
      await Bun.write(pagePath, updatedHtml);
      console.log(`- ${pagePath} version updated to ${version}`);
    } else {
      console.log(`- ${pagePath} already at version ${version}`);
    }
  }
};

const targets = [
  {
    name: 'options',
    entrypoints: ['./src/options/OptionsController.ts'],
    outdir: './dist',
    format: 'esm',
    naming: { entry: 'options.js' },
  },
  {
    // Committed like content.js, so the page works in a checkout that has not been rebuilt.
    name: 'link-builder',
    entrypoints: ['./src/linkBuilder/LinkBuilderController.ts'],
    outdir: './scripts',
    format: 'esm',
    naming: { entry: 'link-builder.js' },
  },
  {
    // Classic script loaded synchronously in the extension pages' <head> to apply the theme before first paint.
    name: 'theme-init',
    entrypoints: ['./src/options/themeInit.ts'],
    outdir: './dist',
    format: 'iife',
    naming: { entry: 'theme-init.js' },
  },
  {
    name: 'content',
    entrypoints: ['./src/content/index.ts'],
    outdir: './scripts',
    format: 'iife',
    naming: { entry: 'content.js' },
  },
  {
    // MV3 service worker (manifest.json `background.service_worker`).
    name: 'background',
    entrypoints: ['./src/background/index.ts'],
    outdir: './scripts',
    format: 'iife',
    naming: { entry: 'background.js' },
  },
];

const results = [];
for (const target of targets) {
  console.log(`- ${target.name}`);
  const result = await build({
    entrypoints: target.entrypoints,
    outdir: target.outdir,
    target: 'browser',
    format: target.format as 'esm' | 'iife',
    define: {
      __CHATGPT_TOOLKIT_DEBUG__: debugDefine,
    },
    minify: false,
    sourcemap: 'external',
    naming: target.naming,
  });
  results.push(result);
}

if (results.every((result) => result.success)) {
  console.log('✓ Build successful!');
  results.forEach((result) => {
    console.log('Output:', result.outputs.map((o) => o.path).join(', '));
  });
  await updatePageVersions();
} else {
  console.error('✗ Build failed');
  process.exit(1);
}
