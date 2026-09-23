import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyLinkedSourceVersions } from './release-manifests.mjs';

const names = ['barocss', 'barocss-browser', 'barocss-server'];
const manifests = names.map((name) =>
  JSON.parse(readFileSync(new URL(`../../packages/${name}/package.json`, import.meta.url))),
);
const version = manifests[0].version;

test('source workspace dependencies are valid when packed dependencies resolve to the version', () => {
  assert.doesNotThrow(() => verifyLinkedSourceVersions(manifests, version));
});

test('a mismatched internal source dependency fails before promotion', () => {
  const changed = structuredClone(manifests);
  changed[1].dependencies['@barocss/kit'] = '0.0.3';
  assert.throws(() => verifyLinkedSourceVersions(changed, version), /unexpected kit dependency/);
});
