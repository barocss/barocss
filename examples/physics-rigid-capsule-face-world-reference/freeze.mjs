import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {worldCases,fixture,worldErrorLiterals} from './controls.mjs';
import {worldReferenceGates,literalWorldComparatorControls} from './reference-controls.mjs';
export const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..');
export const chosenBase='b8d4fb1f74e977fe25fa3a7093fa807943f207e6',parentNative='43ea7abcb83475b3beee1ceafbb40e45c94c2551';
export const parentManifestPath='examples/physics-rigid-capsule-ccd-reference/evidence/native-manifest.json';
export const parentManifestSha='aa80b2a2c3dee24f9af44d6c9ac6baf364786f09a98914a4cb6c03098d1b6302';
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function verifyParent(){
 const bytes=await readFile(resolve(root,parentManifestPath));assert.equal(digest(bytes),parentManifestSha,'authentic1280 manifest');const manifest=JSON.parse(bytes);
 assert.equal(manifest.issue,1280);assert.equal(manifest.verdict,'GO');assert.equal(manifest.privateSelectedFaceGO,true);assert.equal(manifest.artifacts.length,28);
 for(const item of manifest.artifacts){const bytes=await readFile(resolve(root,item.path));assert.equal(bytes.length,item.bytes,item.path);assert.equal(digest(bytes),item.sha256,item.path);}
 const adoption=JSON.parse(await readFile(resolve(here,'adoption-receipt.json'))),provenance=JSON.parse(await readFile(resolve(here,'parent-provenance.json')));
 assert.equal(adoption.chosenBase,chosenBase);assert.equal(adoption.nativeHead,parentNative);assert.equal(adoption.paths,46);assert.equal(adoption.exactModesAndBlobs,true);assert.equal(adoption.nativeArtifactsVerified,true);assert.equal(adoption.nativeArtifactCount,28);assert.equal(adoption.nativeManifestSha256,parentManifestSha);assert.deepEqual(adoption.artifactMismatches,[]);
 assert.equal(provenance.nativeSourceFreezeSHA,manifest.sourceFreezeSha256);assert.equal(provenance.historicalPinsVerifiedAtNative,276);assert.deepEqual(provenance.changedCurrentPaths,['packages/barocss-cad/src/index.ts']);assert.equal(provenance.historicalPinsRewritten,false);assert.equal(provenance.historicalProducerReplayed,false);
 assert.equal(execFileSync('git',['merge-base','--is-ancestor',chosenBase,'HEAD'],{cwd:root}).length,0,'chosen adopted base ancestry');
 return {manifestSha256:parentManifestSha,artifactsVerified:28,historicalSourcePins:276,adoptionPaths:46,historicalCADIndexNotReplayed:true};
}
export async function verifySource(){const freeze=JSON.parse(await readFile(resolve(here,'source-freeze.json')));assert.equal(process.version,'v22.22.0');assert.equal(freeze.base,chosenBase);for(const row of freeze.sources){const bytes=await readFile(resolve(root,row.path));assert.equal(bytes.length,row.bytes,row.path);assert.equal(digest(bytes),row.sha256,row.path);}return freeze;}
export async function verifyEmitted(out){
 const bytes=await readFile(resolve(out,'emitted-pre-consumer.json')),freeze=JSON.parse(bytes);assert.equal(freeze.node,'v22.22.0');assert.equal(freeze.preConsumer,true);assert.equal(freeze.buildExit,0);assert.equal(freeze.strictTypesExit,0);assert.equal(freeze.measuredSource,execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim());assert.ok(Array.isArray(freeze.emitted)&&freeze.emitted.length>0);
 for(const row of freeze.emitted){const bytes=await readFile(resolve(root,row.path));assert.equal(bytes.length,row.bytes,row.path);assert.equal(digest(bytes),row.sha256,row.path);}return {...freeze,ledgerSha256:digest(bytes)};
}
async function allFiles(directory){const result=[];for(const name of await readdir(directory,{withFileTypes:true})){const path=resolve(directory,name.name);if(name.isDirectory())result.push(...await allFiles(path));else if(name.isFile())result.push(path);}return result;}
export async function collectSourceFreeze(){
 assert.equal(process.version,'v22.22.0');const parent=await verifyParent();
 const inputs={issue:1298,base:chosenBase,fixture,worldCases,worldErrorLiterals,worldReferenceGates,literalWorldComparatorControls,command:'ordinary empty only',observerPhase:'post8passes/events before original validation/new diagnostic/fixed pose gate/commit',firstFailure:'preserve attempt/prior accepted; stop physical graph prefix; repeat same prefix across graphs; no retries',fullHalf:'body metadata/pose/velocity/time +firstabsolutecontact only; fullcursor1 halfcursor2, no whole-state equality',rawZero:'live JS andFloat64LE exact; JSONzero-loss separate'};
 await writeFile(resolve(here,'input-freeze.json'),JSON.stringify(inputs,null,2)+'\n');
 const paths=new Set([...await allFiles(here),...await allFiles(resolve(root,'packages/barocss-physics/src')),...await allFiles(resolve(root,'packages/barocss-cad/src')),...await allFiles(resolve(root,'examples/physics-rigid-capsule-ccd-reference'))]);
 for(const path of ['examples/physics-rigid-engine-reference/fixtures.mjs','examples/physics-rigid-engine-reference/build-local.mjs','packages/barocss-physics/package.json','packages/barocss-physics/tsconfig.json','packages/barocss-cad/package.json','packages/barocss-cad/tsconfig.json','package.json','pnpm-lock.yaml','pnpm-workspace.yaml'])paths.add(resolve(root,path));
 paths.delete(resolve(here,'source-freeze.json'));const sources=[];for(const path of [...paths].sort()){const bytes=await readFile(path);sources.push({path:relative(root,path),bytes:bytes.length,sha256:digest(bytes)});}
 const data=JSON.stringify({issue:1298,base:chosenBase,node:process.version,preBuildPreTrial:true,scope:'ONLY NEW examples/physics-rigid-capsule-face-world-reference/**',parent,preparationHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sources},null,2)+'\n';await writeFile(resolve(here,'source-freeze.json'),data);return {file:resolve(here,'source-freeze.json'),sha256:digest(data),sources:sources.length,inputSha256:digest(await readFile(resolve(here,'input-freeze.json')))};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){assert.equal(process.argv[2],'source','only source data collection is supported');console.log(JSON.stringify(await collectSourceFreeze()));}
