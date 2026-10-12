// Exact public handle-call equality against the adopted provider fixture; no native execution.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root=resolve(import.meta.dirname,'../../..'),provider=resolve(process.env.CAD_MODEL_ROOT??root),output=resolve(process.env.EVIDENCE_DIR??'/tmp/cad-hole-recipes');mkdirSync(output,{recursive:true});
const require=createRequire(resolve(process.env.REPO_DEPS_ROOT??root,'package.json'));
const enginePath=resolve(root,'packages/barocss-cad-editor/src/modeling-engine.ts'),downloadPath=resolve(root,'apps/library-docs/docs/public/examples/modeling-hole.ts'),fixturePath=resolve(provider,'packages/barocss-cad/test/modeling-hole-fixture.mjs');
const cad={model(){const calls=[];const record=(kind,fields)=>{const index=calls.length;calls.push({kind,...fields});return index;};
 const shape=index=>({index,hole(options){return shape(record('hole',{parent:index,...options}));}});
 return {parameter(name,value){record('parameter',{name,value});return{parameter:name};},sketch:{rectangle(profile){const index=record('rectangle',{profile});return{extrude(height){return shape(record('extrude',{sketch:index,height}));}};}},
 build(outputs){return structuredClone({calls,outputs:Object.fromEntries(Object.entries(outputs).map(([name,body])=>[name,{index:body.index}]))});}};}};
globalThis.__holeRecipeCad=cad;
const bundle=await require('esbuild').build({stdin:{contents:`export {createCadEditorMountingPlateModel} from '${enginePath}'; export {makeMountingPlate} from '${downloadPath}';`,resolveDir:root},bundle:true,platform:'node',format:'esm',write:false,
 plugins:[{name:'authoring-only',setup(build){build.onResolve({filter:/^@barocss\/cad$/},()=>({path:'cad',namespace:'stub'}));build.onResolve({filter:/^\.\/prism-feature-engine\.js$/},()=>({path:'legacy',namespace:'stub'}));
 build.onLoad({filter:/.*/,namespace:'stub'},args=>({contents:args.path==='cad'?'export const cad=globalThis.__holeRecipeCad;export class CadModelError extends Error{} export function tessellateConvexPlanarSolid(){throw Error("No geometry");}export function tessellateOwnPlateCircularHole(){throw Error("No geometry");}':'export function createPrismFeatureEngine(){throw Error("No legacy execution");}'}));}}]});
writeFileSync(resolve(output,'recipes.mjs'),bundle.outputFiles[0].text);
const {createCadEditorMountingPlateModel,makeMountingPlate}=await import(pathToFileURL(resolve(output,'recipes.mjs'))),{mountingPlate}=await import(pathToFileURL(fixturePath));
const editor=createCadEditorMountingPlateModel(),download=makeMountingPlate(),reference=mountingPlate(cad).build();assert.deepEqual(editor,reference);assert.deepEqual(download,reference);
assert.deepEqual(editor.calls,[{kind:'parameter',name:'width',value:80},{kind:'parameter',name:'depth',value:40},{kind:'parameter',name:'height',value:8},
 {kind:'parameter',name:'centerX',value:40},{kind:'parameter',name:'centerY',value:20},{kind:'parameter',name:'radius',value:5},
 {kind:'rectangle',profile:{width:{parameter:'width'},height:{parameter:'depth'}}},{kind:'extrude',sketch:6,height:{parameter:'height'}},
 {kind:'hole',parent:7,center:[{parameter:'centerX'},{parameter:'centerY'}],radius:{parameter:'radius'}}]);
assert.deepEqual(editor.outputs,{blank:{index:7},plate:{index:8}});
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');const result={ok:true,calls:9,numericDrivers:['width','depth','height','centerX','centerY','radius'],outputs:['blank','plate'],editorSHA256:hash(enginePath),downloadSHA256:hash(downloadPath),providerFixtureSHA256:hash(fixturePath),scope:'exact editor/download/provider public-call equality; no native geometry'};
writeFileSync(resolve(output,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
