import { build } from 'bun';

console.log('Building TypeScript files...');

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
} else {
  console.error('✗ Build failed');
  process.exit(1);
}
