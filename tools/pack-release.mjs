import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const env = { ...process.env, CHATGPT_TOOLKIT_DEBUG: 'false' };
execSync('bun run build', { stdio: 'inherit', env });

const manifestPath = resolve(process.cwd(), 'manifest.json');
const { version } = JSON.parse(readFileSync(manifestPath, 'utf8'));
const fileName = `ChatGPTToolkitExtension_v${version}.zip`;

execSync(`7z a ${fileName} _locales images scripts dist options.html CHANGELOG.md manifest.json README.md`, {
  stdio: 'inherit',
});

console.log(`Created ${fileName}`);
