// Exact public authoring-call equality; provider stubs, no native geometry execution.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..'), provider = resolve(process.env.CAD_MODEL_ROOT ?? root);
const output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-suppression-recipes'); mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const enginePath = resolve(root, 'packages/barocss-cad-editor/src/modeling-engine.ts');
const downloadPath = resolve(root, 'apps/library-docs/docs/public/examples/modeling-suppression.ts');
const fixturePath = resolve(provider, 'packages/barocss-cad/test/modeling-suppression-fixture.mjs');
const cad = { model() {
  const calls = [];
  const record = (kind, values) => { const index = calls.length; calls.push({ kind, ...values }); return index; };
  const shape = index => ({ index,
    split(options) { const node = record('split', { parent: index, ...options }); return { negative: { index: node, side: 'negative' }, positive: { index: node, side: 'positive' } }; },
    edges(query) { const selection = record('edges', { owner: index, query }); return { one() { return { owner: index, selection }; } }; },
    chamfer(selection, distance, options) { assert.equal(selection.owner, index, 'Selector must belong to the exact chamfer parent'); return shape(record('chamfer', { parent: index, selection, distance, options })); },
  });
  const sketch = (kind, profile) => { const index = record(kind, { profile }); return { extrude(height) { return shape(record('extrude', { sketch: index, height })); } }; };
  return { dimension: { add(left, right) { record('add', { left, right }); return { op: 'add', left, right }; }, scale(value, factor) { record('scale', { value, factor }); return { op: 'scale', value, factor }; } }, parameter(name, value) { record('parameter', { name, value }); return { parameter: name }; },
    sketch: { polygon: points => sketch('polygon', points), rectangle: bounds => sketch('rectangle', bounds) },
    build(outputs) { return structuredClone({ calls, outputs: Object.fromEntries(Object.entries(outputs).map(([name, body]) => [name, { index: body.index, side: body.side }])) }); } };
} };
globalThis.__suppressionRecipeCad = cad;
const bundle = await require('esbuild').build({ stdin:{contents:`export { createCadEditorConfigurableFinishesModel } from '${enginePath}'; export { makeConfigurableRail } from '${downloadPath}';`,resolveDir:root},
  bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'record-public-authoring-only',setup(build){
    build.onResolve({filter:/^@barocss\/cad$/},()=>({path:'cad',namespace:'stub'}));
    build.onResolve({filter:/^\.\/prism-feature-engine\.js$/},()=>({path:'legacy',namespace:'stub'}));
    build.onLoad({filter:/.*/,namespace:'stub'},args=>({contents:args.path==='cad' ? 'export const cad=globalThis.__suppressionRecipeCad; export class CadModelError extends Error {} export function tessellateOwnPlateCircularHole(){throw new Error("No native hole geometry in recipe check");} export function tessellateConvexPlanarSolid(){throw new Error("No native geometry in recipe check");}' : 'export function createPrismFeatureEngine(){throw new Error("No legacy execution in recipe check");}'}));
  }}]});
writeFileSync(resolve(output,'recipes.mjs'),bundle.outputFiles[0].text);
const { createCadEditorConfigurableFinishesModel, makeConfigurableRail } = await import(pathToFileURL(resolve(output,'recipes.mjs')));
const { configurableRail } = await import(pathToFileURL(fixturePath));
const editor = createCadEditorConfigurableFinishesModel(), download = makeConfigurableRail(), nativeRecipe = configurableRail(cad).build();
assert.deepEqual(editor, nativeRecipe); assert.deepEqual(download, nativeRecipe);
assert.deepEqual(editor.calls, [
 {kind:'parameter',name:'frontDistance',value:1},{kind:'parameter',name:'backDistance',value:2},{kind:'parameter',name:'backY',value:24},
 {kind:'rectangle',profile:{width:32,height:24}},{kind:'extrude',sketch:3,height:8},
 {kind:'edges',owner:4,query:{parallelTo:'x',at:{y:0,z:'max'}}},
 {kind:'chamfer',parent:4,selection:{owner:4,selection:5},distance:{parameter:'frontDistance'},options:{name:'frontFinish'}},
 {kind:'edges',owner:6,query:{parallelTo:'x',at:{y:{parameter:'backY'},z:'max'}}},
 {kind:'chamfer',parent:6,selection:{owner:6,selection:7},distance:{parameter:'backDistance'},options:{name:'backFinish'}},
 {kind:'split',parent:8,axis:'x',at:16},
]);
assert.deepEqual(editor.outputs,{negative:{index:9,side:'negative'},positive:{index:9,side:'positive'}});
const result={ok:true,scope:'identical ten public construction calls, named result-owned chamfers, fixed X16 split and named output mapping; stubbed authoring only',editorSHA256:hash(enginePath),downloadSHA256:hash(downloadPath),providerFixtureSHA256:hash(fixturePath),calls:10,numericDriversOnly:['frontDistance','backDistance','backY'],names:['frontFinish','backFinish'],nativeGeometryRun:false};
writeFileSync(resolve(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
