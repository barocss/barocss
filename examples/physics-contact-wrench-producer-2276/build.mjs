import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,cpSync,readdirSync,realpathSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {producerTransform} from './producer-transform.mjs';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..'),id=process.argv[2];assert(/^[a-z0-9][a-z0-9-]{0,63}$/.test(id??''));
const out=resolve(home,'evidence',id),stage=resolve(out,'stage'),src=resolve(stage,'physics/src'),hash=b=>createHash('sha256').update(b).digest('hex'),pin=p=>{const b=readFileSync(p);return{bytes:b.length,sha256:hash(b)};},put=(n,v)=>writeFileSync(resolve(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
mkdirSync(resolve(home,'evidence'),{recursive:true});mkdirSync(out);mkdirSync(stage);
const designHome=resolve(root,'examples/physics-contact-wrench-contract-2276'),contract=JSON.parse(readFileSync(resolve(designHome,'validation.json')));for(const[p,v]of Object.entries(contract.sourceAndEvidencePins))assert.deepEqual(pin(resolve(root,p)),v,'Breaking design dependency drift: '+p);
const sourceFreeze=JSON.parse(readFileSync(resolve(home,'SOURCE-PINS-03.json')));assert.equal(sourceFreeze.format,'private-contact-wrench-source-freeze-v1');for(const[p,v]of Object.entries(sourceFreeze.files))assert.deepEqual(pin(resolve(root,p)),v,'Authored producer freeze drift: '+p);
const audit=JSON.parse(readFileSync(resolve(root,'examples/physics-contact-phase-wrench-2276/source-audit.json')));for(const[p,v]of Object.entries(audit.sourcePins)){assert.deepEqual(pin(resolve(root,p)),v,'Nine-file source audit drift: '+p);}
for(const receipt of audit.existingReceiptsRead)assert.deepEqual(pin(resolve(root,receipt.path)),{bytes:receipt.bytes,sha256:receipt.sha256},'Prerequisite receipt drift: '+receipt.path);
const dependencies=JSON.parse(readFileSync(resolve(root,'examples/physics-box-quantized-witness-2276/dependencies.json')));for(const[p,v]of Object.entries(dependencies.pins))assert.deepEqual(pin(resolve(root,p)),v);
const bPins=JSON.parse(readFileSync(resolve(root,'examples/physics-box-quantized-witness-2276/evidence/build-01/source-pins.json')));assert.deepEqual(pin(resolve(root,'examples/physics-box-quantized-witness-2276/candidate.ts')),bPins['candidate.ts']);
const own=Object.fromEntries(['private-phase.ts','producer.ts','producer-transform.mjs','encoding.mjs','trace_decode.py','build.mjs','run.mjs','observer.py','IMPLEMENTATION.md','IMPLEMENTATION-MAPPING.md','ENCODING-FORECAST.json','SOURCE-PINS-03.json'].map(n=>[n,pin(resolve(home,n))]));
const tree=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?tree(resolve(p,e.name)):[resolve(p,e.name)]);
const original=Object.fromEntries(tree(resolve(root,'packages/barocss-physics/src')).map(p=>[relative(root,p),pin(p)]));put('input-pins.json',{observedHead:audit.observedHead,currentHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),own,original,bCandidate:pin(resolve(root,'examples/physics-box-quantized-witness-2276/candidate.ts')),nativeCandidate:pin(resolve(root,'examples/physics-box-contact-features-2276/candidate.ts'))});
cpSync(resolve(root,'packages/barocss-physics/src'),src,{recursive:true});for(const[name,expected]of Object.entries(original)){assert.deepEqual(pin(resolve(src,name.slice('packages/barocss-physics/src/'.length))),expected,'Copied closure changed before patch: '+name);}
mkdirSync(resolve(stage,'B'));cpSync(resolve(root,'examples/physics-box-contact-features-2276/candidate.ts'),resolve(stage,'B/native.ts'));
writeFileSync(resolve(stage,'B/candidate.ts'),readFileSync(resolve(root,'examples/physics-box-quantized-witness-2276/candidate.ts'),'utf8').replace("'../physics-box-contact-features-2276/candidate.js'","'./native.js'"));cpSync(resolve(home,'private-phase.ts'),resolve(src,'private-phase.ts'));
function edit(name,patch){const p=resolve(src,name);let s=readFileSync(p,'utf8');s=patch(s);writeFileSync(p,s);}
function once(s,a,b){assert.equal(s.split(a).length-1,1,'Unique staged source anchor: '+a);return s.replace(a,b);}
edit('persistent-box-contact.ts',s=>{
 s="import { bodyWords, phaseKind, phaseApplyBefore, phaseApplyAfter, phaseNoNormal, phaseCorrectionBefore, phaseCorrectionAfter } from './private-phase.js';\n"+s;
 s=once(s,'  const armA = sub(pointM, a.positionM), armB = sub(pointM, b.positionM);\n  a.velocityMps', '  const traceApply = phaseApplyBefore(a,b,pointM,impulse);\n  const armA = sub(pointM, a.positionM), armB = sub(pointM, b.positionM);\n  a.velocityMps');
 s=once(s,'    inverseInertia(b, cross(armB, impulse)));\n}', '    inverseInertia(b, cross(armB, impulse)));\n  phaseApplyAfter(traceApply,a,b);\n}');
 s=once(s,'  apply(a, b, pointM, add(scale(normal, impulse.normalNs), impulse.tangentNs));', "  phaseKind('warm',{actualPriorApplication:true});\n  apply(a, b, pointM, add(scale(normal, impulse.normalNs), impulse.tangentNs));");
 s=once(s,'  if (deltaNormal !== 0) apply(a, b, pointM, scale(normal, deltaNormal));',"  phaseKind('normal',{normalTargetMps,normalSpeed,normalMass,deltaNormal});\n  if (deltaNormal !== 0) apply(a, b, pointM, scale(normal, deltaNormal)); else phaseNoNormal();");
 s=once(s,'  apply(a, b, pointM, deltaTangent);',"  phaseKind('tangent',{tangentSpeed,requestedMagnitude,staticLimit,dynamicLimit,branch:requestedMagnitude<=staticLimit?'static':'dynamic'});\n  apply(a, b, pointM, deltaTangent);");
 s=once(s,'  const correction = scale(normal, penetration / inverseTotal);','  const traceCorrection=phaseCorrectionBefore(a,b,normal,penetration);\n  const correction = scale(normal, penetration / inverseTotal);');
 s=once(s,'  b.positionM = add(b.positionM, scale(correction, b.inverseMass));','  b.positionM = add(b.positionM, scale(correction, b.inverseMass));\n  phaseCorrectionAfter(traceCorrection,a,b);');return s;
});
edit('world.ts',s=>{
 s="// @ts-nocheck\nimport { bodyWords, phaseWorld, phaseBegin, phaseBodies, phaseBody, phasePass, phaseQuery, phaseCacheInit, phasePoint, phasePrepare } from './private-phase.js';\n"+s;
 s=once(s,'  let stepIndex = 0;','  let stepIndex = 0;\n  const phaseContext=phaseWorld(()=>({bodies:bodies.map(bodyWords),persistentPoints:[...persistentPoints],activePairs:[...activePairs],sleepFrames:[...sleepFrames],stepIndex}));');
 s=once(s,'      const next = bodies.map(copyBody);','      phaseBegin(phaseContext,stepIndex+1,bodies);\n      const next = bodies.map(copyBody);');
 s=once(s,'          const preparedRotation = prepareForcedRotation',"          const traceRotation=bodyWords(body);\n          const preparedRotation = prepareForcedRotation");
 s=once(s,'          body.orientation = preparedRotation.orientation;','          body.orientation = preparedRotation.orientation;\n          phaseBody(\'rotation\',traceRotation,body);\n          const traceKick=bodyWords(body);');
 s=once(s,'          if (Math.hypot(...body.velocityMps) * dt > MAX_STEP_DISPLACEMENT_M)',"          phaseBody('gravity-kick',traceKick,body,{gravity,dt});\n          const traceDrift=bodyWords(body);\n          if (Math.hypot(...body.velocityMps) * dt > MAX_STEP_DISPLACEMENT_M)");
 s=once(s,'          for (let i = 0; i < 3; i++) body.positionM[i] += body.velocityMps[i] * dt;',"          for (let i = 0; i < 3; i++) body.positionM[i] += body.velocityMps[i] * dt;\n          phaseBody('drift',traceDrift,body,{dt});");
 s=once(s,'      for (let pass = 0; pass < SOLVER_PASSES; pass++) {','      for (let pass = 0; pass < SOLVER_PASSES; pass++) {\n        phasePass(pass);');
 s=once(s,'          const hit = detect(a, b);','          const hit = usePersistentBox && a.shape.kind===\'box\' && b.shape.kind===\'box\' ? phaseQuery(a,b) : detect(a, b);');
 s=once(s,'          const manifold = usePersistentBox ? boxFaceManifold(a, b, hit) : null;',"          // Explicit private delta: BOTH FACE and EDGE native B point lists use existing law.\n          const manifold = hit._phase ? hit._phase.result.points : usePersistentBox ? boxFaceManifold(a,b,hit) : null;");
 s=once(s,'                if (prior) warmStartPoint(a, b, point.pointM, hit.normal, impulse);',"                phaseCacheInit(pointKey,point,hit.normal,hit,impulse,prior);\n                if (prior) { phasePoint(pointKey,point,hit.normal,hit,impulse,-1,-1); warmStartPoint(a, b, point.pointM, hit.normal, impulse); }");
 s=once(s,'                solvePersistentPoint(a, b, point.pointM, hit.normal, impulse,', '                phasePoint(pointKey,point,hit.normal,hit,impulse,iteration,order.indexOf(point));\n                solvePersistentPoint(a, b, point.pointM, hit.normal, impulse,');
 s=once(s,'      const state = publicState(next, nextContacts, nextEvents, nextJoints, nextCcdHits, nextPairStats, stepIndex + 1, dt, identity, colliderIds);',"      for (const [aIndex,bIndex] of pairs) phaseQuery(next[aIndex],next[bIndex],true);\n      const state = publicState(next, nextContacts, nextEvents, nextJoints, nextCcdHits, nextPairStats, stepIndex + 1, dt, identity, colliderIds);\n      const preparedPhase=phasePrepare(phaseContext,nextPersistentPoints);");
 s=once(s,'      persistentPoints = nextPersistentPoints;','      persistentPoints = nextPersistentPoints;\n      phaseContext.accepted = preparedPhase;');return s;
});
producerTransform({stage,src,edit,once});
writeFileSync(resolve(stage,'entry.ts'),"export * from './physics/src/index.js';\nexport * from './physics/src/replay.js';\nexport {phaseHistory,phasePrivateSnapshot,phaseFault,unknownMarker} from './physics/src/private-phase.js';\nexport {encodeRecordingData as privateEncodeRecording,decodeRecordingData as privateDecodeRecording} from './physics/src/replay-json.js';\n");
const stagedPins=Object.fromEntries(tree(stage).filter(p=>p!==resolve(src,'provider-manifest.generated.ts')).map(p=>[relative(stage,p),pin(p)]));const manifest={format:'barocss-physics-private-phase-provider',version:1,graph:'SOURCE_PRIVATE',files:stagedPins,deltas:['B native geometry plus represented-line gap export','FACE+EDGE unchanged persistent law','producer-owned actual contribution returns','canonical STATE2 accepted contacts and pair wrenches','RECORDING2 and BCPHREC2 only','independent trace instrumentation'],law:'UNCHANGED_8_OUTER_8_INNER_NORMAL_TANGENT_CACHE'};
writeFileSync(resolve(src,'provider-manifest.generated.ts'),'export const providerManifest = '+JSON.stringify(manifest,null,2)+' as const;\n');

const result=await build({entryPoints:[resolve(stage,'entry.ts')],outfile:resolve(out,'source.mjs'),bundle:true,platform:'node',format:'esm',target:'node22',metafile:true,logLevel:'silent'});for(const input of Object.keys(result.metafile.inputs))assert(realpathSync(resolve(root,input)).startsWith(stage+'/'),'Staged graph escaped stage');
put('metafile.json',result.metafile);put('result.json',{status:'PASS_PRIVATE_PHASE_BUILD',WorldCalls:0,own,original,modelBuilder:pin(resolve(root,'examples/physics-model-input/model.mjs')),staged:{...stagedPins,'physics/src/provider-manifest.generated.ts':pin(resolve(src,'provider-manifest.generated.ts'))},manifest,source:pin(resolve(out,'source.mjs'))});console.log(JSON.stringify({status:'PASS_PRIVATE_PHASE_BUILD',WorldCalls:0,stagedFiles:Object.keys(stagedPins).length}));
