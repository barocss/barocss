// Exact public authoring-call equality; provider stubs, no native geometry execution.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..'), provider = resolve(process.env.CAD_MODEL_ROOT ?? root);
const output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-split-recipes'); mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const enginePath = resolve(root, 'packages/barocss-cad-editor/src/modeling-engine.ts');
const downloadPath = resolve(root, 'apps/library-docs/docs/public/examples/modeling-split.ts');
const fixturePath = resolve(provider, 'packages/barocss-cad/test/modeling-split-fixture.mjs');
const cad = { model() {
  const calls = [];
  const record = (kind, values) => { const index = calls.length; calls.push({ kind, ...values }); return index; };
  const shape = index => ({ index, split(options) { const node = record('split', { parent: index, ...options }); return { negative: { index: node, side: 'negative' }, positive: { index: node, side: 'positive' } }; } });
  const sketch = (kind, profile) => { const index = record(kind, { profile }); return { extrude(height) { return shape(record('extrude', { sketch: index, height })); } }; };
  return { parameter(name, value) { record('parameter', { name, value }); return { parameter: name }; },
    sketch: { polygon: points => sketch('polygon', points), rectangle: bounds => sketch('rectangle', bounds) },
    build(outputs) { return structuredClone({ calls, outputs: Object.fromEntries(Object.entries(outputs).map(([name, body]) => [name, { index: body.index, side: body.side }])) }); } };
} };
globalThis.__splitRecipeCad = cad;
const bundle = await require('esbuild').build({ stdin:{contents:`export { createCadEditorSplitModel } from '${enginePath}'; export { makeSplitPart } from '${downloadPath}';`,resolveDir:root},
  bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'record-public-authoring-only',setup(build){
    build.onResolve({filter:/^@barocss\/cad$/},()=>({path:'cad',namespace:'stub'}));
    build.onResolve({filter:/^\.\/prism-feature-engine\.js$/},()=>({path:'legacy',namespace:'stub'}));
    build.onLoad({filter:/.*/,namespace:'stub'},args=>({contents:args.path==='cad' ? 'export const cad=globalThis.__splitRecipeCad; export class CadModelError extends Error {} export function tessellateConvexPlanarSolid(){throw new Error("No native geometry in recipe check");}' : 'export function createPrismFeatureEngine(){throw new Error("No legacy execution in recipe check");}'}));
  }}]});
writeFileSync(resolve(output,'recipes.mjs'),bundle.outputFiles[0].text);
const { createCadEditorSplitModel, makeSplitPart } = await import(pathToFileURL(resolve(output,'recipes.mjs')));
const { splitPart } = await import(pathToFileURL(fixturePath));
const editor = createCadEditorSplitModel(), download = makeSplitPart(), providerRecipe = splitPart(cad).build();
assert.deepEqual(editor, providerRecipe); assert.deepEqual(download, providerRecipe);
assert.ok(Object.is(editor.calls.find(call => call.kind === 'polygon').profile[0][0], -0), 'Preserve exact signed-zero input');
const result = {ok:true,scope:'identical public parameter/sketch/extrude/split/build calls, including signed zero; stubbed authoring only',editorSHA256:hash(enginePath),downloadSHA256:hash(downloadPath),providerFixtureSHA256:hash(fixturePath),callCount:editor.calls.length,nativeGeometryRun:false};
writeFileSync(resolve(output,'result.json'),JSON.stringify(result,null,2)); console.log(JSON.stringify(result));
