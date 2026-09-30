import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { releasePackages, verifyLinkedSourceVersions, verifyReadiness, verifyRenderEvidence } from './release-manifests.mjs';

const version = '0.12.0';
const manifests = releasePackages.map(({ directory }) => ({
  ...JSON.parse(readFileSync(new URL(`../../packages/${directory}/package.json`, import.meta.url))),
  version,
}));
const sha = 'a'.repeat(40);
const readiness = `BAROCSS_RELEASE_READY SHA=${sha} VERSION=${version}
Packages: @barocss/kit @barocss/browser @barocss/server @barocss/render
Guard: https://github.com/barocss/barocss/issues/471#issuecomment-1
Ship: https://github.com/barocss/barocss/issues/471#issuecomment-2
Render: https://github.com/barocss/barocss/issues/471#issuecomment-3`;

test('all four versioned source manifests allow workspace kit dependencies', () => {
  assert.doesNotThrow(() => verifyLinkedSourceVersions(manifests, version));
});

test('wrong package names, versions, private flags, or missing render fail before promotion', () => {
  assert.throws(() => verifyLinkedSourceVersions(manifests.slice(0, 3), version), /four/);
  for (const field of ['name', 'version', 'private']) {
    const changed = structuredClone(manifests);
    changed[3][field] = field === 'private' ? true : 'incorrect';
    assert.throws(() => verifyLinkedSourceVersions(changed, version));
  }
  const changed = structuredClone(manifests);
  changed[1].dependencies['@barocss/kit'] = '0.0.3';
  assert.throws(() => verifyLinkedSourceVersions(changed, version), /unexpected kit dependency/);
});

test('release-ready evidence must bind all four packages and render to the exact candidate', () => {
  assert.doesNotThrow(() => verifyReadiness(readiness, sha, version));
  assert.throws(() => verifyReadiness(readiness, 'b'.repeat(40), version), /merged develop SHA/);
  assert.throws(() => verifyReadiness(readiness, sha, '0.11.2'), /version/);
  assert.throws(() => verifyReadiness(readiness.replace(' @barocss/render', ''), sha, version), /four packages/);
  assert.throws(() => verifyReadiness(readiness.replace(/\nRender:.*$/, ''), sha, version), /Render evidence/);
  assert.throws(() => verifyReadiness(readiness.replace('issues/471#issuecomment-3', 'issues/471'), sha, version), /Render evidence/);
});

test('packed render evidence rejects another author, URL, version or candidate', () => {
  const url = 'https://github.com/barocss/barocss/issues/471#issuecomment-3';
  const comment = { user: { login: 'easylogic' }, html_url: url,
    body: `BAROCSS_RENDER_READY SHA=${sha} VERSION=${version}` };
  assert.doesNotThrow(() => verifyRenderEvidence(comment, url, sha, version));
  assert.throws(() => verifyRenderEvidence({ ...comment, user: { login: 'other' } }, url, sha, version), /owner/);
  assert.throws(() => verifyRenderEvidence(comment, url + '1', sha, version), /URL mismatch/);
  assert.throws(() => verifyRenderEvidence(comment, url, 'b'.repeat(40), version), /exact candidate/);
  assert.throws(() => verifyRenderEvidence(comment, url, sha, '0.11.2'), /exact candidate/);
  assert.throws(() => verifyRenderEvidence({ ...comment, body: '' }, url, sha, version), /exact candidate/);
});
