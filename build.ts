import { build } from 'bun';

console.log('Building TypeScript files...');

const debugEnv = (process.env.CHATGPT_TOOLKIT_DEBUG || '').toLowerCase();
const debugDefine = debugEnv === '0' || debugEnv === 'false' ? 'false' : 'true';

const updateOptionsVersion = async (): Promise<void> => {
  const manifest = await Bun.file('manifest.json').json() as { version?: string };
  const version = manifest.version;
  if (!version || typeof version !== 'string') {
    throw new Error('manifest.json is missing a valid version field.');
  }

  const optionsPath = 'options.html';
  const optionsHtml = await Bun.file(optionsPath).text();
  const versionPattern = /(<span id="appVersion">)([^<]*)(<\/span>)/;
  if (!versionPattern.test(optionsHtml)) {
    throw new Error('options.html is missing <span id="appVersion"> for version injection.');
  }

  const updatedOptionsHtml = optionsHtml.replace(versionPattern, `$1${version}$3`);
  if (updatedOptionsHtml !== optionsHtml) {
    await Bun.write(optionsPath, updatedOptionsHtml);
    console.log(`- options.html version updated to ${version}`);
  } else {
    console.log(`- options.html already at version ${version}`);
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
    name: 'content',
    entrypoints: ['./src/content/index.ts'],
    outdir: './scripts',
    format: 'iife',
    naming: { entry: 'content.js' },
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
  await updateOptionsVersion();
} else {
  console.error('✗ Build failed');
  process.exit(1);
}
