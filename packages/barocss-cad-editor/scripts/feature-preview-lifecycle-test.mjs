import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../../..');
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const built = await require('esbuild').build({
  entryPoints: [resolve(root, 'packages/barocss-cad-editor/src/feature-preview-lifecycle.ts')],
  bundle: true, platform: 'node', format: 'esm', write: false,
});
const { createCadEditorPreviewLifecycle: create } = await import(
  'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64')
);
let state = { generation: 1, displayGeneration: 2, graphId: 'g', revision: 3, selectedFeatureId: 'extrusion' };
const gate = create(() => state);
let checks = 0;
const first = gate.begin();
assert.equal(gate.isCurrent(first), true); checks++;
const second = gate.begin();
assert.equal(gate.isCurrent(first), false); checks++;
assert.equal(gate.isCurrent(second), true); checks++;
state = {...state, selectedFeatureId: 'other'};
assert.equal(gate.isCurrent(second), false); checks++;
state = {...state, selectedFeatureId: 'extrusion'};
const third = gate.begin();
for (const [field, value] of [
  ['generation', 4], ['displayGeneration', 5], ['graphId', 'other'],
  ['revision', 4], ['selectedFeatureId', 'other'],
]) {
  state = {...state, [field]: value};
  assert.equal(gate.isCurrent(third), false, field); checks++;
  state = {...third.epoch};
}
gate.cancel();
assert.equal(gate.isCurrent(third), false); checks++;
assert.equal(gate.isCurrent(gate.begin()), true); checks++;
gate.dispose(); gate.dispose();
assert.equal(gate.isCurrent(second), false); checks++;
assert.throws(() => gate.begin(), /DISPOSED/); checks++;
assert.throws(() => gate.cancel(), /DISPOSED/); checks++;
const malformed = create(() => ({...state, generation: -1}));
assert.throws(() => malformed.begin(), /qualified/); checks++;
const independent = create(() => state);
assert.equal(independent.isCurrent(independent.begin()), true); checks++;
console.log(JSON.stringify({status:'PASS',checks,boundary:'async preview lease only; no Native/renderer acceptance'}));
