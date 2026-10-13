import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../../..');
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const built = await require('esbuild').build({
  entryPoints: [resolve(root, 'packages/barocss-cad-editor/src/feature-preview-epoch.ts')],
  bundle: true, platform: 'node', format: 'esm', write: false,
});
const {captureCadEditorPreviewEpoch: capture, isCadEditorPreviewEpochCurrent: current} =
  await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
const epoch = {generation: 1, displayGeneration: 2, graphId: 'graph', revision: 3, selectedFeatureId: 'extrusion'};
const captured = capture(epoch);
assert.equal(Object.isFrozen(captured), true);
assert.equal(current(captured, epoch), true);
epoch.generation = 4;
assert.equal(captured.generation, 1);
assert.equal(current(captured, epoch), false);
let checks = 3;
for (const [field, value] of [
  ['generation', 2], ['displayGeneration', 9], ['graphId', 'other'], ['revision', 7],
  ['selectedFeatureId', 'other'],
]) {
  const mismatch = {...captured, [field]: value};
  assert.equal(current(captured, mismatch), false, field); checks++;
}
for (const [field, value] of [
  ['generation', -1], ['generation', 0.5], ['displayGeneration', Infinity],
  ['revision', NaN], ['graphId', ''], ['selectedFeatureId', ''],
]) {
  assert.throws(() => capture({...captured, [field]: value}), TypeError, field); checks++;
}
assert.equal(current(captured, {...captured}), true); checks++;
console.log(JSON.stringify({status:'PASS', checks, boundary:'epoch-only; no native geometry, UI or GPU acceptance'}));
