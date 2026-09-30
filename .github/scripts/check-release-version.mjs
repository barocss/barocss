import { readFileSync, readdirSync } from 'node:fs';
import { releasePackages, verifyLinkedSourceVersions } from './release-manifests.mjs';

const expected = process.env.EXPECTED_VERSION;
if (!expected || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(expected)) {
  throw new Error('EXPECTED_VERSION must be an exact semver version.');
}

const manifests = releasePackages.map(({ directory }) =>
  JSON.parse(readFileSync(`packages/${directory}/package.json`, 'utf8')),
);
verifyLinkedSourceVersions(manifests, expected);

const pending = readdirSync('.changeset').filter(
  (name) => name.endsWith('.md') && name !== 'README.md',
);
if (pending.length > 0) {
  throw new Error(`Version the pending changesets before publishing: ${pending.join(', ')}`);
}

console.log(`Release version ${expected} is consistent across all four packages.`);
