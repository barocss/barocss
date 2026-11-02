import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {writeFileSync,openSync,writeSync,closeSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {authenticateFreeze,preparePublicProvider,listFiles} from './public-provider.mjs';
import {authenticateClothOracle} from './oracle-reader.mjs';
import {sha} from './public-values.mjs';
import {qualifyPublic} from './public-cohorts.mjs';
const HERE=dirname(fileURLToPath(import.meta.url)),ROOT=resolve(HERE,'../..');
const json=x=>JSON.stringify(x,null,2)+'\n';
const ledgerKeys=['factoryAttempts','worlds','creationRefusals','stepEntries','accepted','syntheticFailures','typedNumericControls','initializers','reads','disposes','domainQueries','domainRecorderAttachAttempts','rigidRecorderAttachAttempts','rigidRecorderSaveCalls','disposedReadRefusals','hostExternalSubmitFailures'];
async function main(){
 const [graph,out,freezePath,freezeSha,token]=process.argv.slice(2);assert.equal(token,'--authorized-public-child');assert(['source','native'].includes(graph));assert(/^v22\./.test(process.version));assert.equal(typeof global.gc,'function');assert.equal(new Uint8Array(new Uint16Array([1]).buffer)[0],1);
 let phase='authenticate',firstFailure=null,armed=null,written=0,highestCursor=0;const ledger=Object.fromEntries(ledgerKeys.map(k=>[k,0])),helpers={},states=new WeakMap(),events=[];
 const fd=openSync(resolve(out,'actual-counters-u64le.bin'),'wx'),counterBytes=Buffer.alloc(ledgerKeys.length*8);
 const flush=()=>{for(let i=0;i<ledgerKeys.length;i++)counterBytes.writeBigUInt64LE(BigInt(ledger[ledgerKeys[i]]),i*8);writeSync(fd,counterBytes,0,counterBytes.length,0);};
 const progress=async label=>{flush();writeFileSync(resolve(out,'progress.json'),json({phase,label,ledger,helpers,highestCursor,armed:armed?.site??null,events}));};
 const write=async(name,data)=>{const b=typeof data==='string'||Buffer.isBuffer(data)||data instanceof Uint8Array?data:json(data);written+=Buffer.byteLength(b);assert(written<=16*1024*1024,'authored16MiB;native32MiB;logs4MiB;oracle4MiB;emergency8MiB');await mkdir(dirname(resolve(out,name)),{recursive:true});await writeFile(resolve(out,name),b,{flag:'wx'});};
 const arm=(site,error)=>{assert.equal(armed,null,'one fault at a time');armed={site,error};};
 globalThis.__p5Public={
  hit(name){helpers[name]=(helpers[name]??0)+1;if(name==='initializeCloth'||name==='initializeFluid')ledger.initializers++;if(name==='reads')ledger.reads++;if(name==='disposes')ledger.disposes++;if(name==='solverReturns')ledger.solverReturns=(ledger.solverReturns??0)+1;},
  factory(){ledger.factoryAttempts++;assert(ledger.factoryAttempts<=101,'factory budget');flush();},
  returned(w,snapshot){ledger.worlds++;assert(ledger.worlds<=37);states.set(w,snapshot);flush();},
  step(){ledger.stepEntries++;assert(ledger.stepEntries<=6334,'step entry budget');flush();},
  accepted(cursor){ledger.accepted++;highestCursor=Math.max(highestCursor,cursor);assert(ledger.accepted<=6281,'accepted budget');flush();},
  fault(site){if(armed?.site===site){const error=armed.error;assert(error instanceof Error);armed=null;events.push({site,stepEntry:ledger.stepEntries,identityPreserved:'checked by owning cohort'});throw error;}},
  numeric(positions){if(armed?.site==='numeric'){armed=null;events.push({site:'actual-private-NUMERIC_LIMIT',stepEntry:ledger.stepEntries});positions[0]=NaN;}}
 };
 let result;
 try{
  const freeze=await authenticateFreeze(ROOT,resolve(freezePath),freezeSha);assert.equal(freeze.graph,graph,'graph-specific external freeze');assert.equal(freeze.authorization,'PUBLIC_P5B_EXACT_COHORT');
  const names=['public-run.mjs','public-trial.mjs','public-provider.mjs','public-instrument.mjs','public-cohorts.mjs','public-values.mjs','PUBLIC-RECIPES.json','P5B-PLAN.json','P5B-CONTROL-RECIPES.json','oracle-reader.mjs'];for(const n of names)assert(freeze.files[relative(ROOT,resolve(HERE,n))],`missing harness pin ${n}`);
  if(graph==='native'){assert(freeze.reviewedSourcePass,'native requires explicit reviewed source PASS');const receipt=await readFile(resolve(ROOT,freeze.reviewedSourcePass.path));assert.equal(sha(receipt),freeze.reviewedSourcePass.sha256);assert.equal(JSON.parse(receipt).status,'PASS_PUBLIC_P5B_BOUNDED_QUALIFICATION');}
  const recipe=JSON.parse(await readFile(resolve(HERE,'P5B-CONTROL-RECIPES.json'),'utf8'));
  for(const required of ['examples/physics-scene/fluid-cad-shelf.barocad','examples/physics-scene/evidence/cloth-978-final-world-2026-10-09.json','examples/physics-scene/fluid-release-criteria.mjs','examples/physics-cloth-viewer/metrics.mjs'])assert(freeze.files[required],'missing authority pin '+required);
  const methods=JSON.parse(await readFile(resolve(HERE,'PUBLIC-RECIPES.json'),'utf8'));assert.equal(methods.perGraph.stepEntries,6334);
  const oracle=await authenticateClothOracle(resolve(HERE,'evidence/oracle-01/summary.json'),'42123f80b9a8de4db7d7860fc2ade5642cc8ca9114af9ad36c336e4ab6fb7db4');
  const modelPath=resolve(ROOT,'examples/physics-model-data-2276/model-data.mjs');assert.equal(sha(await readFile(modelPath)),'ccd3aff04c93027a0c4561d9aab1757e6a6a6f0b7bc54ec13885ff4b4d59e604');assert(freeze.files[relative(ROOT,modelPath)]);
  // DATA-only import is after authorization, with no regeneration or numerical provider call.
  const {copyPhysicsModelPreset:preset}=await import(pathToFileURL(modelPath).href);
  phase='provider';await progress('before-import');const provider=await preparePublicProvider({root:ROOT,out,graph,freeze,write});await authenticateFreeze(ROOT,resolve(freezePath),freezeSha);
  phase='cohorts';result=await qualifyPublic({provider,preset,oracle,recipe,write,ledger,arm,progress,captureFailure(e){if(!firstFailure)firstFailure={name:e?.name,message:e?.message,stack:e?.stack,phase,ledger:{...ledger},helpers:{...helpers},armed:armed?.site??null,beforeCleanup:true};},hidden(w){const get=states.get(w);assert(get,'actual instrumented World identity');return get();},shelfSource:await readFile(resolve(ROOT,'examples/physics-scene/fluid-cad-shelf.barocad'),'utf8'),historicalCloth:JSON.parse(await readFile(resolve(ROOT,'examples/physics-scene/evidence/cloth-978-final-world-2026-10-09.json'),'utf8'))});
  assert.equal(armed,null);ledger.refusedSteps=ledger.stepEntries-ledger.accepted-ledger.syntheticFailures;
  const expected={factoryAttempts:101,worlds:37,creationRefusals:64,stepEntries:6334,accepted:6281,syntheticFailures:13,refusedSteps:40,typedNumericControls:4,initializers:35,disposes:41,domainQueries:8,domainRecorderAttachAttempts:8,rigidRecorderAttachAttempts:3,rigidRecorderSaveCalls:3,disposedReadRefusals:4,hostExternalSubmitFailures:1};
  for(const[k,v]of Object.entries(expected))assert.equal(ledger[k],v,'actual '+k);assert(ledger.reads<=512);assert.equal(events.length,17);assert.equal(helpers.assertCadProxyCurrent,483);assert(helpers.admitCadFluidStaticData<=5);assert(helpers.admitCadSurfaceProxy<=5);assert(helpers.compileCadModel<=3);
  const exactHelpers={prepareCloth:1217,prepareFluid:5076,ClothSolverSteps:1217,PbfSolverSteps:5076,ClothSolverConstructions:1217,PbfSolverConstructions:5076,initializeCloth:13,initializeFluid:22};for(const [k,n]of Object.entries(exactHelpers))assert.equal(helpers[k],n,'actual helper '+k);
  if(graph==='native'){const source=JSON.parse(await readFile(resolve(ROOT,freeze.reviewedSourcePass.path),'utf8'));assert.notEqual(result.cloth[0].samples[0].identity.providerDigest,source.result.cloth[0].samples[0].identity.providerDigest,'source/native actual provider distinction');}
  await authenticateFreeze(ROOT,resolve(freezePath),freezeSha);
  let size=0;for(const p of await listFiles(out))size+=(await readFile(p)).length;assert(size+4194304<=52*1024*1024,'oracle4MiB+logs4MiB+emergency8MiB within64MiB');await write('resource-summary.json',{actualBytesBeforeSummary:size,cap:67108864,emergencyReserve:8388608,authoredWrites:written,argv:process.argv,execArgv:process.execArgv,counterKeys:ledgerKeys,counterFormat:'unsigned64LE;one fixed file updated on actual entry/commit;updates included in public step timing',unknownOldDiagnosticZeroSigns:'UNKNOWN'});
 }catch(e){firstFailure??={name:e?.name,message:e?.message,stack:e?.stack,phase,ledger:{...ledger},helpers:{...helpers},armed:armed?.site??null};}
 finally{ledger.refusedSteps=ledger.stepEntries-ledger.accepted-ledger.syntheticFailures;await progress('final');closeSync(fd);delete globalThis.__p5Public;}
 const summary={status:firstFailure?'FAIL':'PASS_PUBLIC_P5B_BOUNDED_QUALIFICATION',graph,ledger,helpers,events,firstFailure,scope:'frozen6334publicstepentries;separatecompile/docs/browser/product/releaseNOT_RUN',result};await writeFile(resolve(out,'summary.json'),json(summary),{flag:'wx'});if(firstFailure)process.exitCode=1;
}
await main();
