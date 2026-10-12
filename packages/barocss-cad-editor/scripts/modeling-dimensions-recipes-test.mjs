// Exact public authoring-call equality; provider stubs, no native geometry execution.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..'), provider = resolve(process.env.CAD_MODEL_ROOT ?? root);
const output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-dimensions-recipes'); mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const enginePath = resolve(root, 'packages/barocss-cad-editor/src/modeling-engine.ts');
const downloadPath = resolve(root, 'apps/library-docs/docs/public/examples/modeling-dimensions.ts');
const fixturePath = resolve(provider, 'packages/barocss-cad/test/modeling-dimensions-fixture.mjs');
const cad = { model() {
  const calls = [];
  const record = (kind, values) => { const index = calls.length; calls.push({ kind, ...values }); return index; };
  const shape = index => ({ index,
    split(options) { const node = record('split', { parent: index, ...options }); return { negative: { index: node, side: 'negative' }, positive: { index: node, side: 'positive' } }; },
    edges(query) { const selection = record('edges', { owner: index, query }); return { one() { return { owner: index, selection }; } }; },
    chamfer(selection, distance) { assert.equal(selection.owner, index, 'Selector must belong to the exact chamfer parent'); return shape(record('chamfer', { parent: index, selection, distance })); },
  });
  const sketch = (kind, profile) => { const index = record(kind, { profile }); return { extrude(height) { return shape(record('extrude', { sketch: index, height })); } }; };
  return { dimension: { add(left, right) { record('add', { left, right }); return { op: 'add', left, right }; }, scale(value, factor) { record('scale', { value, factor }); return { op: 'scale', value, factor }; } }, parameter(name, value) { record('parameter', { name, value }); return { parameter: name }; },
    sketch: { polygon: points => sketch('polygon', points), rectangle: bounds => sketch('rectangle', bounds) },
    build(outputs) { return structuredClone({ calls, outputs: Object.fromEntries(Object.entries(outputs).map(([name, body]) => [name, { index: body.index, side: body.side }])) }); } };
} };
globalThis.__dimensionRecipeCad = cad;
const bundle = await require('esbuild').build({ stdin:{contents:`export { createCadEditorDerivedSplitModel } from '${enginePath}'; export { makeCenteredSplit } from '${downloadPath}';`,resolveDir:root},
  bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'record-public-authoring-only',setup(build){
    build.onResolve({filter:/^@barocss\/cad$/},()=>({path:'cad',namespace:'stub'}));
    build.onResolve({filter:/^\.\/prism-feature-engine\.js$/},()=>({path:'legacy',namespace:'stub'}));
    build.onLoad({filter:/.*/,namespace:'stub'},args=>({contents:args.path==='cad' ? 'export const cad=globalThis.__dimensionRecipeCad; export class CadModelError extends Error {} export function tessellateConvexPlanarSolid(){throw new Error("No native geometry in recipe check");}' : 'export function createPrismFeatureEngine(){throw new Error("No legacy execution in recipe check");}'}));
  }}]});
writeFileSync(resolve(output,'recipes.mjs'),bundle.outputFiles[0].text);
const { createCadEditorDerivedSplitModel, makeCenteredSplit } = await import(pathToFileURL(resolve(output,'recipes.mjs')));
const { derivedRail } = await import(pathToFileURL(fixturePath));
const editor = createCadEditorDerivedSplitModel(), download = makeCenteredSplit(), nativeRecipe = derivedRail(cad).build();
assert.deepEqual(editor, nativeRecipe); assert.deepEqual(download, nativeRecipe);
assert.deepEqual(editor.calls.slice(0,4).map(call=>[call.name,call.value]), [['width',32],['offset',0],['frontDistance',1],['backDistance',2]]);
assert.deepEqual(editor.calls.map(call=>call.kind), ['parameter','parameter','parameter','parameter','scale','add','rectangle','extrude','edges','chamfer','edges','chamfer','split']);
assert.deepEqual(editor.calls[4], {kind:'scale',value:{parameter:'width'},factor:0.5});
const formula = {op:'add',left:{op:'scale',value:{parameter:'width'},factor:0.5},right:{parameter:'offset'}};
assert.deepEqual(editor.calls[12].at,formula); assert.equal(editor.calls[12].axis,'x');
assert.equal(editor.calls[9].parent,7);assert.equal(editor.calls[11].parent,9);assert.equal(editor.calls[11].selection.owner,9);assert.equal(editor.calls[12].parent,11);
assert.deepEqual(editor.outputs,{negative:{index:12,side:'negative'},positive:{index:12,side:'positive'}});
const result={ok:true,scope:'identical13 public construction calls, nested add/scale intent, exact owned shape chain and output mapping; stubbed authoring only',editorSHA256:hash(enginePath),downloadSHA256:hash(downloadPath),providerFixtureSHA256:hash(fixturePath),calls:13,numericDriversOnly:['width','offset','frontDistance','backDistance'],formula,nativeGeometryRun:false};
writeFileSync(resolve(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
