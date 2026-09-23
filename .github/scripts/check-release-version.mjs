import { readFileSync, readdirSync } from 'node:fs';

const expected = process.env.EXPECTED_VERSION;
if (!expected || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(expected)) {
  throw new Error('EXPECTED_VERSION must be an exact semver version.');
}

const packages = [
  'packages/barocss',
  'packages/barocss-browser',
  'packages/barocss-server',
];

for (const directory of packages) {
  const manifest = JSON.parse(readFileSync(`${directory}/package.json`, 'utf8'));
  if (manifest.version !== expected) {
    throw new Error(`${manifest.name} is ${manifest.version}, expected ${expected}.`);
  }
}

const pending = readdirSync('.changeset').filter(
  (name) => name.endsWith('.md') && name !== 'README.md',
);
if (pending.length > 0) {
  throw new Error(`Version the pending changesets before publishing: ${pending.join(', ')}`);
}

console.log(`Release version ${expected} is consistent across all three packages.`);
