import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const repo = resolve(fileURLToPath(new URL('../../../', import.meta.url)));

test('actual native Split source produces validated scoped Face reference resolutions', { timeout: 180000 }, () => {
  const script = resolve(repo, 'packages/barocss-cad/scripts/native-split-reference-replay.mjs');
  const output = execFileSync(process.execPath, [script], {
    cwd: repo, encoding: 'utf8', timeout: 170000,
    maxBuffer: 1024 * 1024,
  });
  const summary = JSON.parse(output.trim().split('\n').at(-1));
  assert.equal(summary.caseId, 'native-convex-split-face-reference-v1');
  assert.equal(summary.nativeSplitValidated, true);
  assert.equal(summary.sourceMode, 'actual-native-source');
  assert.equal(summary.namingCertified, false);
  assert.ok(summary.statuses.ambiguous + summary.statuses.resolved + summary.statuses.missing > 0);
  assert.equal(summary.documentColdRebuild, 'unrun');
  assert.equal(summary.browser, 'unrun');
  assert.equal(summary.loader, 'unrun');
});
