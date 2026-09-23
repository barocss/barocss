import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const release = readFileSync('.github/workflows/npm-release.yml', 'utf8');
const ci = readFileSync('.github/workflows/ci.yml', 'utf8');

function assertMainOnlyPublication(releaseSource, ciSource) {
  assert.match(releaseSource, /workflow_dispatch:/);
  assert.match(releaseSource, /github\.ref == 'refs\/heads\/main' && \(github\.event_name == 'push' \|\| github\.event_name == 'workflow_dispatch'\)/);
  assert.match(releaseSource, /^  publish:\n    if: github\.event_name == 'push' && needs\.preflight\.outputs\.publication_state == 'unpublished'/m);
  assert.match(releaseSource, /^  auth_dry_run:\n    if: github\.event_name == 'workflow_dispatch'/m);
  assert.doesNotMatch(releaseSource, /refs\/heads\/develop/);
  assert.doesNotMatch(releaseSource, /if: inputs\.publish/);
  assert.match(ciSource, /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.match(ciSource, /needs: \[build, test\]/);
  assert.match(ciSource, /uses: \.\/\.github\/workflows\/npm-release\.yml/);
}

test('only a checked main push can reach publication', () => {
  assertMainOnlyPublication(release, ci);
});

test('develop dispatch cannot reach publication', () => {
  const unsafe = release.replace("github.ref == 'refs/heads/main'", "github.ref == 'refs/heads/develop'");
  assert.throws(() => assertMainOnlyPublication(unsafe, ci));
});

test('manual dispatch cannot reach publication', () => {
  const unsafe = release.replace(
    "if: github.event_name == 'push' && needs.preflight.outputs.publication_state == 'unpublished'",
    "if: github.event_name == 'workflow_dispatch' && needs.preflight.outputs.publication_state == 'unpublished'",
  );
  assert.throws(() => assertMainOnlyPublication(unsafe, ci));
});
