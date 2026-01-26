import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifestPath = resolve(process.cwd(), 'manifest.json');
const manifestContents = readFileSync(manifestPath, 'utf8');
const versionMatch = manifestContents.match(
  /"version"\s*:\s*"(\d+)\.(\d+)\.(\d+)"/,
);

if (!versionMatch) {
  console.error('Unable to find manifest.json version field.');
  process.exit(1);
}

const [, major, minor, patch] = versionMatch;
const nextVersion = `${major}.${minor}.${Number(patch) + 1}`;
const updatedContents = manifestContents.replace(
  versionMatch[0],
  `"version": "${nextVersion}"`,
);

writeFileSync(manifestPath, updatedContents);
console.log(`Bumped manifest.json version to ${nextVersion}`);
