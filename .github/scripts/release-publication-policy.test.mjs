import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const release = readFileSync('.github/workflows/npm-release.yml', 'utf8');
const ci = readFileSync('.github/workflows/ci.yml', 'utf8');

function assertMainOnlyOidcPublication(releaseSource, ciSource) {
  assert.match(releaseSource, /push:\n    branches: \[main\]/);
  assert.match(releaseSource, /pull_request:\n    branches: \[main\]/);
  assert.doesNotMatch(releaseSource, /workflow_dispatch:|workflow_call:/);
  assert.match(releaseSource, /^  build:\n    name: build/m);
  assert.match(releaseSource, /^  test:\n    name: test/m);
  assert.match(releaseSource, /if: github\.repository == 'barocss\/barocss' && github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.match(releaseSource, /needs: \[build, test\]/);
  assert.match(releaseSource, /environment: npm\n    permissions:\n      contents: write\n      id-token: write/);
  assert.match(releaseSource, /npm install --global npm@11\.5\.1/);
  assert.match(releaseSource, /node-version: '22\.22\.0'/);
  assert.match(releaseSource, /node \.github\/scripts\/check-promotion-merge\.mjs/);
  assert.match(releaseSource, /PACK_OUTPUT_DIR: /);
  assert.match(releaseSource, /npm publish "\$RUNNER_TEMP\/barocss-packs\/barocss-\$name-\$RELEASE_VERSION\.tgz"/);
  assert.doesNotMatch(releaseSource, /secrets\.NPM_TOKEN|secrets\.NPM_PUBLISH_TOKEN|npm whoami|pnpm changeset publish|changesets\/action/);
  assert.doesNotMatch(ciSource, /      - main\n|^  publish:|^  build:|^  test:/m);
}

test('only a checked main push can use direct npm OIDC publication', () => {
  assertMainOnlyOidcPublication(release, ci);
});

test('a pull request cannot reach npm publication', () => {
  const unsafe = release.replace("github.event_name == 'push'", "github.event_name == 'pull_request'");
  assert.throws(() => assertMainOnlyOidcPublication(unsafe, ci));
});

test('OIDC publication requires the npm environment and id-token permission', () => {
  assert.throws(() => assertMainOnlyOidcPublication(release.replace('environment: npm', 'environment: other'), ci));
  assert.throws(() => assertMainOnlyOidcPublication(release.replace('      id-token: write', '      id-token: read'), ci));
});
