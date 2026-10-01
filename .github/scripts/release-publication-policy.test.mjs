import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const release = readFileSync('.github/workflows/npm-release.yml', 'utf8');
const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
const mainChecker = readFileSync('.github/scripts/check-release-main.mjs', 'utf8');

function assertManualOidcPublication(source) {
  assert.doesNotMatch(source, /(?:^|\n)  push:\n/);
  assert.match(source, /pull_request:\n {4}branches: \[main\]/);
  assert.match(source, /workflow_dispatch:\n {4}inputs:\n {6}publish:/);
  assert.match(source, /type: boolean\n {8}default: false/);
  assert.match(source, /^ {2}build:\n {4}name: build/m);
  assert.match(source, /^ {2}test:\n {4}name: test/m);
  assert.match(source, /if: github\.repository == 'barocss\/barocss' && github\.event_name == 'workflow_dispatch' && inputs\.publish == true && github\.ref == 'refs\/heads\/main'/);
  assert.doesNotMatch(source, /needs: \[build, test\]/);
  assert.match(source, /test "\$GITHUB_ACTOR" = easylogic/);
  assert.match(source, /test "\$GITHUB_SHA" = "\$EXPECTED_MAIN_SHA"/);
  assert.match(source, /node \.github\/scripts\/check-release-main\.mjs/);
  assert.ok(
    source.indexOf('node .github/scripts/check-release-main.mjs')
      < source.indexOf('node .github/scripts/check-publication-state.mjs'),
    'PM and main provenance checks must run before any published-state shortcut',
  );
  assert.match(source, /environment: npm\n {4}permissions:\n {6}contents: write[\s\S]*? {6}id-token: write/);
  assert.match(source, /npm install --global npm@11\.5\.1/);
  assert.match(source, /node-version: '22\.22\.0'/);
  assert.match(source, /PACK_OUTPUT_DIR: /);
  assert.match(source, /npm publish "\$RUNNER_TEMP\/barocss-packs\/barocss-\$name-\$RELEASE_VERSION\.tgz"/);
  assert.doesNotMatch(source, /NPM_RELEASE_ENABLED/);
  assert.doesNotMatch(source, /secrets\.NPM_TOKEN|secrets\.NPM_PUBLISH_TOKEN|npm whoami|pnpm changeset publish|changesets\/action/);
}

test('PR runs checks and only explicit manual true can publish', () => {
  assertManualOidcPublication(release);
  assert.doesNotMatch(ci, / {6}- main\n|^ {2}publish:|^ {2}build:|^ {2}test:/m);
  const publishJobStart = release.indexOf('  publish:\n    name: Publish npm packages');
  assert.ok(publishJobStart > 0, 'publish job section is missing');
  const pullRequestBuild = release.slice(release.indexOf('  build:'), release.indexOf('  test:'));
  const pullRequestTest = release.slice(release.indexOf('  test:'), publishJobStart);
  const publish = release.slice(publishJobStart);
  assert.match(pullRequestBuild, /if: github\.event_name == 'pull_request'/);
  assert.match(pullRequestBuild, /docs:build/);
  assert.match(pullRequestTest, /if: github\.event_name == 'pull_request'/);
  assert.match(pullRequestTest, /run: pnpm test/);
  assert.match(publish, /run: pnpm build:library/);
  assert.doesNotMatch(publish, /run: pnpm check/);
  assert.doesNotMatch(publish, /docs:build/);
  assert.match(mainChecker, /verifySameSourceTree\(mainTree, candidateTree\)/);
  assert.match(mainChecker, /verifyReleasePullRequestRun\(/);
  assert.match(mainChecker, /verifyReleasePullRequestJobs\(/);
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

test('postflight allows bounded npm registry processing time', () => {
  const attempts = Number(release.match(/max_attempts=(\d+)/)?.[1]);
  const interval = Number(release.match(/sleep (\d+)/)?.[1]);
  assert.ok((attempts - 1) * interval >= 300, 'wait at least five minutes for npm processing');
  assert.ok((attempts - 1) * interval <= 600, 'stop within ten minutes if state stays incomplete');
  assert.match(release, /if \[ "\$attempt" -eq "\$max_attempts" \]; then[\s\S]*?exit 1/);
});

test('there is no separate promotion dispatch or approval-triggered publishing path', () => {
  assert.equal(existsSync('.github/workflows/npm-promote.yml'), false);
  for (const name of readdirSync('.github/workflows').filter((file) => file.endsWith('.yml'))) {
    const source = readFileSync(`.github/workflows/${name}`, 'utf8');
    assert.doesNotMatch(source, /create-github-app-token|BARO_PROMOTION_APP|promotion_pr:|gh pr merge|create-promotion-pr|pull_request_review|issue_comment|secrets\.NPM_TOKEN|secrets\.NPM_PUBLISH_TOKEN/, name);
    if (name !== 'npm-release.yml') {
      assert.doesNotMatch(source, /^\s+(?:npm publish|pnpm changeset publish)\b/m, name);
    }
  }
});

test('manual publication checks previous main ancestry of the merged develop candidate', () => {
  assert.match(mainChecker, /verifyMainAncestry\(parents\[0\], candidateSha\)/);
});

test('render is published first and all four packages get tags only after publication succeeds', () => {
  assert.equal((release.match(/for name in render kit browser server; do/g) || []).length, 2);
  assert.match(release, /name: Create package tags and GitHub Releases\n {8}if: steps\.oidc_publish\.outcome == 'success'/);
  assert.match(mainChecker, /verifyReadiness\(comment.body, candidateSha, version\)/);
  assert.match(mainChecker, /verifyRenderEvidence\(renderComment, renderEvidence.slice\('Render: '.length\), candidateSha, version\)/);
  assert.match(mainChecker, /main.protected, true/);
});
