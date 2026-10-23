import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Genuine native source Split construction is performed by the existing
 * convex-planar-solid-split-demo. This consumer replays its source result,
 * validates through the unchanged native split provider, projects existing
 * lineage, and resolves authored references. No new geometric proof is claimed.
 *
 * Run from repository root after pnpm installation:
 * node packages/barocss-cad/scripts/native-split-reference-replay.mjs
 */
const root = resolve('.');
const dir = mkdtempSync(join(tmpdir(), 'barocss-native-split-reference-'));
try {
  const demo = resolve(root, 'examples/cad-nurbs/convex-planar-solid-split-demo.mjs');
  execFileSync(process.execPath, [demo, '--source', dir], {
    cwd: root, stdio: 'pipe', timeout: 120000,
  });
  const result = JSON.parse(readFileSync(join(dir, 'source-result.json'), 'utf8'));
  const bundle = await build({
    entryPoints: [resolve(root, 'packages/barocss-cad/src/index.ts'),
      resolve(root, 'packages/barocss-cad/src/split-face-evolution.ts'),
      resolve(root, 'packages/barocss-cad/src/exact-proof/persistent-face-reference-v1.ts')],
    bundle: true, platform: 'node', format: 'esm', target: 'es2022',
    outdir: dir, outExtension: { '.js': '.mjs' }, write: true,
  });
  assert.equal(bundle.errors.length, 0);
  const api = await import(pathToFileURL(join(dir, 'index.mjs')));
  const { projectConvexPlanarSplitFaceEvolution: project } =
    await import(pathToFileURL(join(dir, 'split-face-evolution.mjs')));
  const { resolveAuthoredFaceAfterSplitV1: resolveRef } =
    await import(pathToFileURL(join(dir, 'exact-proof', 'persistent-face-reference-v1.mjs')));
  assert.deepEqual(api.validateConvexPlanarSolidSplit(result), result.report);
  const receipt = project(result);
  assert.equal(receipt.namingCertified, false);
  assert.equal(receipt.nativeStatus, 'split');
  assert.ok(receipt.faces.length > 0 && receipt.generatedCaps.length > 0);
  const original = structuredClone(result);
  const statuses = { resolved: 0, ambiguous: 0, missing: 0 };
  for (const [index, row] of receipt.faces.entries()) {
    const authored = { version: 1, featureId: 'nativeFeature' + index,
      outputRole: 'face', target: row.parent };
    const resolution = resolveRef(authored, receipt);
    assert.equal(resolution.status, row.resolution === 'unique' ? 'resolved'
      : row.resolution === 'ambiguous' ? 'ambiguous' : 'missing');
    statuses[resolution.status]++;
  }
  assert.ok(statuses.ambiguous + statuses.resolved + statuses.missing > 0);
  assert.deepEqual(result, original, 'read-only receipt/lookup may not edit native Split');
  const summary = { caseId: 'native-convex-split-face-reference-v1',
    nativeSplitValidated: true, sourceMode: 'actual-native-source',
    namingCertified: false, statuses,
    documentColdRebuild: 'unrun', browser: 'unrun', loader: 'unrun' };
  writeFileSync(join(dir, 'reference-summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
