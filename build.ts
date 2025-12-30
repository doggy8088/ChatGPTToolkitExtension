import { build } from 'bun';

console.log('Building TypeScript files...');

const result = await build({
  entrypoints: ['./src/options/OptionsController.ts'],
  outdir: './dist',
  target: 'browser',
  format: 'esm',
  minify: false,
  sourcemap: 'external',
  naming: {
    entry: 'options.js',
  },
});

if (result.success) {
  console.log('✓ Build successful!');
  console.log('Output:', result.outputs.map(o => o.path).join(', '));
} else {
  console.error('✗ Build failed');
  process.exit(1);
}
