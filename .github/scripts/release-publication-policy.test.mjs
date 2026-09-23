import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
const version = readFileSync('.github/workflows/release.yml', 'utf8');
const preflight = readFileSync('.github/workflows/npm-promote.yml', 'utf8');

test('main sync leaves no npm publication workflow before the reviewed OIDC PR', () => {
  assert.equal(existsSync('.github/workflows/npm-release.yml'), false);
  assert.doesNotMatch(ci, /- main\s*(?:\n|$)|^  publish:|uses: \.\/\.github\/workflows\/npm-release\.yml/m);
  assert.match(ci, /name: Test and Build/);
  assert.match(ci, /node --test \.github\/scripts\/\*\.test\.mjs/);
  assert.match(ci, /node \.github\/scripts\/check-packages\.mjs/);
});

test('retained release workflow only creates develop version PRs', () => {
  assert.match(version, /workflow_dispatch:/);
  assert.match(version, /github\.ref == 'refs\/heads\/develop'/);
  assert.match(version, /version: pnpm changeset:version/);
  assert.doesNotMatch(version, /npm publish|changeset publish|NPM_TOKEN|NODE_AUTH_TOKEN|id-token: write/);
});

test('sync tree has no App promotion, approval arm, token, or npm publish job', () => {
  assert.equal(existsSync('.github/workflows/npm-arm-promotion.yml'), false);
  for (const script of [
    'arm-promotion-pr.mjs', 'create-promotion-pr.mjs', 'check-main-protection.mjs',
    'check-promotion-merge.mjs', 'promotion-review-policy.test.mjs',
  ]) {
    assert.equal(existsSync(`.github/scripts/${script}`), false);
  }
  assert.match(preflight, /name: Npm release preflight/);
  assert.match(preflight, /node \.github\/scripts\/check-promotion-ready\.mjs/);
  assert.doesNotMatch(preflight, /promotion_pr:|create-github-app-token|BARO_PROMOTION_APP|gh pr merge/);
  for (const file of readdirSync('.github/workflows').filter((name) => name.endsWith('.yml'))) {
    const source = readFileSync(`.github/workflows/${file}`, 'utf8');
    assert.doesNotMatch(source, /NPM_TOKEN|NODE_AUTH_TOKEN|changeset publish|^  publish:|create-github-app-token|BARO_PROMOTION_APP|pull_request_review:|^\s*-\s*run:.*npm publish/m, file);
  }
});
