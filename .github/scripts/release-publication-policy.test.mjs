import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const release = readFileSync('.github/workflows/npm-release.yml', 'utf8');
const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
const preflight = readFileSync('.github/workflows/npm-promote.yml', 'utf8');

function assertManualOidcPublication(source) {
  assert.match(source, /push:\n    branches: \[main\]/);
  assert.match(source, /pull_request:\n    branches: \[main\]/);
  assert.match(source, /workflow_dispatch:\n    inputs:\n      publish:/);
  assert.match(source, /type: boolean\n        default: false/);
  assert.match(source, /^  build:\n    name: build/m);
  assert.match(source, /^  test:\n    name: test/m);
  assert.match(source, /if: github\.repository == 'barocss\/barocss' && github\.event_name == 'workflow_dispatch' && inputs\.publish == true && github\.ref == 'refs\/heads\/main'/);
  assert.match(source, /needs: \[build, test\]/);
  assert.match(source, /test "\$GITHUB_ACTOR" = easylogic/);
  assert.match(source, /test "\$GITHUB_SHA" = "\$EXPECTED_MAIN_SHA"/);
  assert.match(source, /node \.github\/scripts\/check-release-main\.mjs/);
  assert.ok(
    source.indexOf('node .github/scripts/check-release-main.mjs')
      < source.indexOf('node .github/scripts/check-publication-state.mjs'),
    'PM and main provenance checks must run before any published-state shortcut',
  );
  assert.match(source, /environment: npm\n    permissions:\n      contents: write[\s\S]*?      id-token: write/);
  assert.match(source, /npm install --global npm@11\.5\.1/);
  assert.match(source, /node-version: '22\.22\.0'/);
  assert.match(source, /PACK_OUTPUT_DIR: /);
  assert.match(source, /npm publish "\$RUNNER_TEMP\/barocss-packs\/barocss-\$name-\$RELEASE_VERSION\.tgz"/);
  assert.doesNotMatch(source, /NPM_RELEASE_ENABLED/);
  assert.doesNotMatch(source, /secrets\.NPM_TOKEN|secrets\.NPM_PUBLISH_TOKEN|npm whoami|pnpm changeset publish|changesets\/action/);
}

test('main push and PR run checks but only explicit manual true can publish', () => {
  assertManualOidcPublication(release);
  assert.doesNotMatch(ci, /      - main\n|^  publish:|^  build:|^  test:/m);
});

test('default, event, and branch gates fail closed', () => {
  assert.throws(() => assertManualOidcPublication(release.replace('default: false', 'default: true')));
  assert.throws(() => assertManualOidcPublication(release.replace("github.event_name == 'workflow_dispatch'", "github.event_name == 'push'")));
  assert.throws(() => assertManualOidcPublication(release.replace("github.ref == 'refs/heads/main'", "github.ref == 'refs/heads/develop'")));
});

test('OIDC publication requires the protected npm environment', () => {
  assert.throws(() => assertManualOidcPublication(release.replace('environment: npm', 'environment: other')));
  assert.throws(() => assertManualOidcPublication(release.replace('      id-token: write', '      id-token: read')));
});

test('preflight has no App or write token and cannot create or merge a PR', () => {
  assert.match(preflight, /name: Npm release preflight/);
  assert.match(preflight, /node \.github\/scripts\/check-promotion-ready\.mjs/);
  assert.doesNotMatch(preflight, /create-github-app-token|BARO_PROMOTION_APP|promotion_pr:|gh pr merge|create-promotion-pr/);
  assert.doesNotMatch(preflight, /contents: write|pull-requests: write|id-token: write/);
});
