import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../../..');
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const built = await require('esbuild').build({
  entryPoints: [resolve(root, 'packages/barocss-cad-editor/src/feature-preview-advisory.ts')],
  bundle: true, platform: 'node', format: 'esm', write: false,
});
const { runCadEditorPreviewAdvisory: run } = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64')
);
const { createCadEditorPreviewLifecycle: create } = await import(
  'data:text/javascript;base64,' + Buffer.from((await require('esbuild').build({
    entryPoints: [resolve(root, 'packages/barocss-cad-editor/src/feature-preview-lifecycle.ts')],
    bundle: true, platform: 'node', format: 'esm', write: false,
  })).outputFiles[0].text).toString('base64')
);
let epoch = {generation:1,displayGeneration:1,graphId:'graph',revision:1,selectedFeatureId:'extrusion'};
const gate = create(() => epoch);
let resolveOne, rejectTwo;
const first = run(gate, () => new Promise(resolve => {resolveOne=resolve;}));
const second = run(gate, () => new Promise((_resolve,reject) => {rejectTwo=reject;}));
resolveOne('old-success');
rejectTwo(new Error('old-error'));
assert.deepEqual(await first, {status:'stale'});
assert.equal((await second).status, 'error');
let checks=2;
const third = run(gate, async () => 'accepted-preview');
assert.deepEqual(await third, {status:'current',value:'accepted-preview'});checks++;
const fourth = run(gate, async () => {throw new Error('current failure');});
assert.equal((await fourth).status,'error');checks++;
const fifth = run(gate, async () => {epoch={...epoch,revision:2};return 'outdated';});
assert.deepEqual(await fifth, {status:'stale'});checks++;
const sixth = run(gate, async () => {gate.cancel();throw Error('late failure');});
assert.deepEqual(await sixth, {status:'stale'});checks++;
const seventh = run(gate, async () => {gate.dispose();return 'late success';});
assert.deepEqual(await seventh, {status:'stale'});checks++;
await assert.rejects(() => run(gate, async () => 'never'),/DISPOSED/);checks++;
console.log(JSON.stringify({status:'PASS',checks,boundary:'advisory-only; no Native or GPU acceptance'}));
