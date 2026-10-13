// Exact public recipe and actual UI predicate controls; never runs native geometry.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..');
const output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-1826-recipes'); mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const engine = resolve(root, 'packages/barocss-cad-editor/src/modeling-engine.ts');
const download = resolve(root, 'apps/library-docs/docs/public/examples/modeling-top-pocket.ts');
const fixture = resolve(root, 'packages/barocss-cad/test/modeling-offset-fixture.mjs');
const cad = { model() {
  const calls = [], record = (kind, data) => { const index = calls.length; calls.push({ kind, ...data }); return index; };
  const shape = index => ({ index, cut(other) { return shape(record('cut', { parent: index, tool: other.index })); } });
  return {
    parameter(name, value) { record('parameter', { name, value }); return { parameter: name }; },
    dimension: {
      add(left, right) { record('add', { left, right }); return { op: 'add', left, right }; },
      scale(value, factor) { record('scale', { value, factor }); return { op: 'scale', value, factor }; },
    },
    sketch: { rectangle(profile) { const sketch = record('rectangle', { profile }); return {
      extrude(height, options) { return shape(record('extrude', { sketch, height, ...(options === undefined ? {} : { options }) })); },
    }; } },
    build(outputs) { return structuredClone({ calls, outputs: Object.fromEntries(Object.entries(outputs).map(([name, body]) => [name, body.index])) }); },
  };
} };
globalThis.__topPocketRecipe = cad;
const built = await require('esbuild').build({ stdin: { contents: `export {createCadEditorTopPocketModel} from '${engine}';export {makeTopEntryPocket} from '${download}';`, resolveDir: root }, bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'authoring-only', setup(build) {
    build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'cad', namespace: 'stub' }));
    build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'stub' }));
    build.onLoad({ filter: /.*/, namespace: 'stub' }, a => ({ contents: a.path === 'cad'
      ? 'export const cad=globalThis.__topPocketRecipe;export class CadModelError extends Error{};export function tessellateSurface(){throw Error("No native");}export const tessellateConvexPlanarSolid=tessellateSurface,tessellateOwnPlateCircularHole=tessellateSurface,tessellateXYCirclePrismShell=tessellateSurface;'
      : 'export function createPrismFeatureEngine(){throw Error("No legacy");}' }));
  } }] });
writeFileSync(resolve(output, 'recipes.mjs'), built.outputFiles[0].text);
const api = await import(pathToFileURL(resolve(output, 'recipes.mjs')));
const { topPocket } = await import(pathToFileURL(fixture));
const actual = api.createCadEditorTopPocketModel(), expected = topPocket(cad).build();
assert.deepEqual(actual, expected); assert.deepEqual(api.makeTopEntryPocket(), expected);
assert.equal(actual.calls.length, 11); assert.deepEqual(actual.outputs, { plate: 4, tool: 9, part: 10 });
assert.ok(Object.is(actual.calls[3].profile.min[0], -0));
assert.equal(Object.hasOwn(actual.calls[4], 'options'), false);
assert.deepEqual(actual.calls[9].options.from, actual.calls[6] && { op: 'add', left: 8, right: { op: 'scale', value: { parameter: 'depth' }, factor: -1 } });
const transfer = JSON.parse(readFileSync(resolve(root, 'packages/barocss-cad/test/modeling-offset-evidence/baseline-transfer.json'), 'utf8'));
const authored = JSON.parse(transfer.text), accepted = { source: 'model', parameters: transfer.parameters };
const uiPath = resolve(root, 'packages/barocss-cad-editor/src/react/modeling-editor.tsx'), ui = readFileSync(uiPath, 'utf8');
const initializer = ui.match(/ {2}const topPocketDrivers = ([\s\S]*?);\n {2}const holeModel/)[1];
const classify = new Function('differenceModel', 'accepted', 'authored', `return ${initializer}`);
const controls = [];
const check = (name, data, summary, flag, want) => { assert.equal(classify(flag, summary, data), want, name); controls.push(name); };
check('exact baseline', authored, accepted, true, true);
check('not difference', authored, accepted, false, false);
check('legacy source', authored, { ...accepted, source: 'legacy' }, true, false);
for (const [name, mutate] of [
  ['literal lower origin', d => d.nodes[3].from = 4], ['omitted origin', d => delete d.nodes[3].from],
  ['different fixed top', d => d.nodes[3].from.left = 9], ['different scale', d => d.nodes[3].from.right.factor = -2],
  ['different depth reference', d => d.nodes[3].from.right.value.parameter = 'toolY'],
  ['different operation', d => d.nodes[3].from.op = 'scale'], ['offset plate', d => d.nodes[1].from = 0],
  ['different plate height', d => d.nodes[1].height = 9], ['different plate width', d => d.nodes[0].max[0] = 33],
  ['different cutter X', d => d.nodes[2].min[0] = 9], ['different span reference', d => d.nodes[2].max[1].right.parameter = 'toolY'],
  ['different cutter height', d => d.nodes[3].height.parameter = 'toolSpanY'], ['wrong parent', d => d.nodes[4].parent.node = 3],
  ['wrong side', d => d.nodes[4].tool.side = 'negative'], ['part only', d => d.outputs = { part: d.outputs.part }],
  ['aliased part', d => { d.outputs.result = d.outputs.part; delete d.outputs.part; }],
  ['wrong plate output', d => d.outputs.plate.node = 3], ['wrong tool output side', d => d.outputs.tool.side = 'negative'],
]) { const wrong = structuredClone(authored); mutate(wrong); check(name, wrong, accepted, true, false); }
check('extra numeric driver', authored, { ...accepted, parameters: { ...accepted.parameters, extra: 0 } }, true, false);
check('missing numeric driver', authored, { ...accepted, parameters: { depth: 4, toolY: 8 } }, true, false);
check('edited numeric values retain formula', authored, { ...accepted, parameters: { depth: 6, toolY: 9, toolSpanY: 7 } }, true, true);
assert.ok(ui.includes("topPocketDrivers && name === 'depth' ? 'Pocket depth downward from top Z=8'"));
assert.ok(ui.includes('{(pocketSavedOutputs || topPocketDrivers) && <p>'));
assert.ok(ui.includes('{topPocketDrivers && <p>Depth is measured downward from top Z=8.'));
// Execute the actual file-stage body and replacement callbacks after #1828.
// This is a pure callback race control, without React, a browser or physical files.
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const stageBody = ui.match(/const stageModelFile = async \(file\?: File\) => \{([\s\S]*?)\n {2}\};\n {2}const action/)[1];
const stageFile = new AsyncFunction('file', 'snapshot', 'fileReadEpoch', 'controller', 'setConfirmed', 'setError', 'readModelingFileText', 'setSource', stageBody);
const retryBody = ui.match(/onClick=\{\(\) => \{([^\n]*?)\}\}>Retry model/)[1];
const retry = new Function('fileReadEpoch', 'action', 'initialAuthoredText', retryBody);
const loadBody = ui.match(/onClick=\{\(\) => action\(async s => \{([\s\S]*?)\n {6}\}\)\}>Load example/)[1];
const load = new AsyncFunction('s', 'fileReadEpoch', 'example', 'splitAxis', 'setReplaceExample', loadBody);
const replacementControls = [];
for (const mode of ['retry-default', 'retry-initial', 'load-top-entry', 'load-split']) {
  const epoch = { current: 0 }, commands = [], replacements = [], sources = [], errors = [];
  const session = { example(...args) { commands.push(['example', ...args]); }, open(text) { commands.push(['open', text]); }, getSnapshot() { return { error: null }; } };
  let finishRead; const pendingRead = new Promise(resolve => { finishRead = resolve; });
  const pending = stageFile({}, { busy: false }, epoch, { current: session }, () => {}, value => errors.push(value), () => pendingRead, value => sources.push(value));
  assert.equal(epoch.current, 1);
  if (mode.startsWith('retry')) retry(epoch, operation => operation(session), mode === 'retry-initial' ? 'initial bytes' : undefined);
  else await load(session, epoch, mode === 'load-top-entry' ? 'top-entry-pocket' : 'horizontal-split', 'y', value => replacements.push(value));
  assert.equal(epoch.current, 2); finishRead('late file bytes'); await pending;
  assert.deepEqual(sources, []); assert.deepEqual(errors, [null]);
  assert.deepEqual(commands, mode === 'retry-initial' ? [['open', 'initial bytes']] : mode === 'retry-default' ? [['example']] : mode === 'load-top-entry' ? [['example', 'top-entry-pocket', undefined]] : [['example', 'horizontal-split', 'y']]);
  assert.deepEqual(replacements, mode.startsWith('load') ? [false] : []); replacementControls.push(mode);
}
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const result = { ok: true, nativeCalls: 0, authoringCalls: actual.calls.length, controls, replacementControls, sourceHashes: Object.fromEntries([engine, download, fixture, uiPath].map(p => [p.slice(root.length + 1), hash(p)])), trace: actual, scope: 'exact editor/download/provider authoring and actual UI initializer; no React runtime or native geometry' };
writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result));
