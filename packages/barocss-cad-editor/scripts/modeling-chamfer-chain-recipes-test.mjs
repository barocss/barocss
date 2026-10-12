// Exact public authoring-call equality; provider stubs, no native geometry execution.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..'), provider = resolve(process.env.CAD_MODEL_ROOT ?? root);
const output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-chamfer-chain-recipes'); mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const enginePath = resolve(root, 'packages/barocss-cad-editor/src/modeling-engine.ts');
const downloadPath = resolve(root, 'apps/library-docs/docs/public/examples/modeling-chamfer-chain.ts');
const fixturePath = resolve(provider, 'packages/barocss-cad/test/modeling-chamfer-chain-fixture.mjs');
const cad = { model() {
  const calls = [];
  const record = (kind, values) => { const index = calls.length; calls.push({ kind, ...values }); return index; };
  const shape = index => ({ index,
    edges(query) { const selection = record('edges', { owner: index, query }); return { one() { return { owner: index, selection }; } }; },
    chamfer(selection, distance) { assert.equal(selection.owner, index, 'Selector must belong to the exact chamfer parent'); return shape(record('chamfer', { parent: index, selection, distance })); },
  });
  const sketch = (kind, profile) => { const index = record(kind, { profile }); return { extrude(height) { return shape(record('extrude', { sketch: index, height })); } }; };
  return { parameter(name, value) { record('parameter', { name, value }); return { parameter: name }; },
    sketch: { polygon: points => sketch('polygon', points), rectangle: bounds => sketch('rectangle', bounds) },
    build(outputs) { return structuredClone({ calls, outputs: Object.fromEntries(Object.entries(outputs).map(([name, body]) => [name, { index: body.index, side: body.side }])) }); } };
} };
globalThis.__chamferRecipeCad = cad;
const bundle = await require('esbuild').build({ stdin:{contents:`export { createCadEditorChamferChainModel } from '${enginePath}'; export { makeTwoChamferPart } from '${downloadPath}';`,resolveDir:root},
  bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'record-public-authoring-only',setup(build){
    build.onResolve({filter:/^@barocss\/cad$/},()=>({path:'cad',namespace:'stub'}));
    build.onResolve({filter:/^\.\/prism-feature-engine\.js$/},()=>({path:'legacy',namespace:'stub'}));
    build.onLoad({filter:/.*/,namespace:'stub'},args=>({contents:args.path==='cad' ? 'export const cad=globalThis.__chamferRecipeCad; export class CadModelError extends Error {} export function tessellateSurface(){throw Error("No native panel execution");}export function tessellateOwnPlateCircularHole(){throw new Error("No native hole geometry in recipe check");} export function tessellateConvexPlanarSolid(){throw new Error("No native geometry in recipe check");}' : 'export function createPrismFeatureEngine(){throw new Error("No legacy execution in recipe check");}'}));
  }}]});
writeFileSync(resolve(output,'recipes.mjs'),bundle.outputFiles[0].text);
const { createCadEditorChamferChainModel, makeTwoChamferPart } = await import(pathToFileURL(resolve(output,'recipes.mjs')));
const { chamferPart } = await import(pathToFileURL(fixturePath));
const editor = createCadEditorChamferChainModel(), download = makeTwoChamferPart(), providerRecipe = chamferPart(cad).build();
assert.deepEqual(editor, providerRecipe); assert.deepEqual(download, providerRecipe);
assert.deepEqual(editor.calls.slice(0,3).map(call => [call.name, call.value]), [['frontDistance',1],['backDistance',2],['backY',24]]);
assert.deepEqual(editor.calls.map(call => call.kind), ['parameter','parameter','parameter','rectangle','extrude','edges','chamfer','edges','chamfer']);
assert.equal(editor.calls[6].parent, 4); assert.equal(editor.calls[8].parent, 6);
assert.equal(editor.calls[7].owner, 6); assert.equal(editor.calls[8].selection.owner, 6);
assert.deepEqual(Object.keys(editor.outputs), ['part']); assert.equal(editor.outputs.part.index, 8);
const result = {ok:true,scope:'identical public parameter/rectangle/extrude/owned-edge/chamfer/build calls, including exact second-result ownership; stubbed authoring only',editorSHA256:hash(enginePath),downloadSHA256:hash(downloadPath),providerFixtureSHA256:hash(fixturePath),callCountPerRecipe:9,secondSelectorOwnerIsFirstResult:true,nativeGeometryRun:false};
writeFileSync(resolve(output,'result.json'),JSON.stringify(result,null,2)); console.log(JSON.stringify(result));
