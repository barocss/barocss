import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { releasePackages, verifyLinkedSourceVersions } from './release-manifests.mjs';

const root = resolve(import.meta.dirname, '../..');
const read = (name) => readFileSync(resolve(root, name), 'utf8');

test('Changesets plans the coordinated first render release without versioning this task', async () => {
  const manifests = releasePackages.map(({ directory }) => JSON.parse(read(`packages/${directory}/package.json`)));
  if (!existsSync(resolve(root, '.changeset/public-render.md'))) {
    // After the separate version step, source release versions must match.
    verifyLinkedSourceVersions(manifests, manifests[0].version);
    return;
  }
  const deps = createRequire(resolve(process.env.REPO_DEPS_ROOT || root, 'package.json'));
  const getReleasePlan = deps('@changesets/get-release-plan').default;
  const plan = await getReleasePlan(root);
  assert.deepEqual(plan.releases.filter(({ type }) => type !== 'none').map(({ name, newVersion }) => [name, newVersion]).sort(),
    releasePackages.map(({ name }) => [name, '0.12.0']).sort());
  assert.equal(manifests[3].version, '0.0.0-private-prototype');
});

test('Docs staged form is the complete packaged authored example', () => {
  const guide = read('apps/barocss-docs/docs/guide/render.md');
  assert.ok(guide.includes(read('packages/barocss-render/examples/profile-form.tsx').trim()));
  assert.match(guide, /runtime\.observe\(document\.body, \{ scan: true \}\)/);
  assert.match(guide, /runtime\.destroy\(\)/);
  const version = JSON.parse(read('apps/barocss-docs/published-version.json')).version;
  const source = JSON.parse(read('packages/barocss/package.json')).version;
  if (version !== source || existsSync(resolve(root, '.changeset/public-render.md'))) {
    assert.match(guide, /not yet available on npm/);
    assert.doesNotMatch(guide, /pnpm add @barocss\/render@__BAROCSS_VERSION__/);
  }
  assert.doesNotMatch(read('packages/barocss-render/README.md'), /\/Users\/|private-\d+-run/);
});
