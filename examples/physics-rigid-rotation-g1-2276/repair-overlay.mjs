/** Frozen DATA transforms. Never imports or evaluates a numerical provider. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=text=>createHash('sha256').update(text).digest('hex');
function once(source,anchor,replacement){assert.equal(source.split(anchor).length,2,'unique staged anchor '+anchor);return source.replace(anchor,replacement);}
const importControl="import { g1Control } from './g1-test-control.js';\n";
const fields=['dispatch','prepare','null','eligible','zero','nonzero','validate','inheritedAdvanceOrientation','sharedSin','sharedCos','bodySin','bodyCos','F01Site','F02Site','F03Site','faultThrows','guardReplacements','attachments','releases','cacheReads'];
export const EXPECTED_PER_GRAPH=Object.freeze({dispatch:850,prepare:850,null:420,eligible:430,zero:2,nonzero:428,validate:430,inheritedAdvanceOrientation:848,sharedSin:848,sharedCos:848,bodySin:428,bodyCos:428,F01Site:427,F02Site:426,F03Site:845,faultThrows:3,guardReplacements:3,attachments:10,releases:10,cacheReads:11});
export function controlSource(){return `/** Private staged test control. No public package export or production hook. */
import type { FreeRotationResult } from './rigid-free-rotation.js';
type Name = ${fields.map(x=>JSON.stringify(x)).join(' | ')};
const counts: Record<Name,number> = ${JSON.stringify(Object.fromEntries(fields.map(x=>[x,0])))};
const readers = new WeakMap<object,()=>Record<string,unknown>>();
const owned = new Set<object>();
let armed: {kind:string; marker?:Error; replacement?:[number,number,number]} | null = null;
export const g1Control = {
  count(name:Name):void { counts[name]++; },
  trig(name:'sharedSin'|'sharedCos'|'bodySin'|'bodyCos',result:number):number { counts[name]++; return result; },
  attach(world:object,reader:()=>Record<string,unknown>):void { if(readers.has(world))throw new Error('duplicate staged observer');readers.set(world,reader);owned.add(world);counts.attachments++; },
  release(world:object):void { if(!owned.delete(world))throw new Error('missing staged observer');readers.delete(world);counts.releases++; },
  cache(world:object):Record<string,unknown> { const read=readers.get(world);if(!read)throw new Error('missing staged observer');counts.cacheReads++;return read(); },
  arm(kind:string,marker?:Error,replacement?:[number,number,number]):void { if(armed)throw new Error('staged control already armed');armed={kind,marker,replacement}; },
  pending():boolean { return armed!==null; },
  cancel():void { armed=null; },
  replace(result:FreeRotationResult):void { if(armed?.kind.startsWith('N')){const value=armed.replacement;if(!value)throw new Error('missing guard replacement');result.angularVelocityRadps=[...value];armed=null;counts.guardReplacements++;} },
  hit(kind:'F01'|'F02'|'F03'):void { counts[(kind+'Site') as Name]++;if(armed?.kind===kind){const marker=armed.marker;armed=null;counts.faultThrows++;throw marker;} },
  stats():Record<Name,number> { return {...counts}; },
  assertReleased():void { if(owned.size||armed)throw new Error('staged observer/control leak'); }
};\n`;}
export function makeRepairOverlay({world,math,candidate}){
  const originals={world,math,candidate};
  const originalStatement='          body.orientation = advanceOrientation(body.orientation, body.angularVelocityRadps, dt);';
  const dispatch=`          g1Control.count('dispatch');
          const preparedRotation = prepareAxisymmetricFreeRotation(body, dt);
          if (preparedRotation === null) {
            g1Control.count('null');
${originalStatement}
          } else {
            g1Control.replace(preparedRotation);
            validateFreeRotationResult(preparedRotation, dt);
            body.angularVelocityRadps = preparedRotation.angularVelocityRadps;
            g1Control.hit('F01');
            body.orientation = preparedRotation.orientation;
            g1Control.hit('F02');
          }`;
  world=once(world,originalStatement,dispatch);
  world=once(world,'      // Shared commit: assignments only. No allocation or callback.',"      g1Control.hit('F03');\n      // Shared commit: assignments only. No allocation or callback.");
  world=once(world,'  return world;\n}',`  g1Control.attach(world, () => ({ bodies, contacts, events, jointStates, ccdHits, pairStats,
    activePairs, persistentPoints, sleepFrames, stepIndex, owner, advancingOwner, running, disposed,
    modelCopy, optionsCopy, identity }));
  return world;\n}`);
  world=importControl+"import { prepareAxisymmetricFreeRotation, validateFreeRotationResult } from './rigid-free-rotation.js';\n"+world;
  math=once(math,'export function advanceOrientation(orientation: Quat, angularVelocity: Vec3, dt: number): Quat {',"export function advanceOrientation(orientation: Quat, angularVelocity: Vec3, dt: number): Quat {\n  g1Control.count('inheritedAdvanceOrientation');");
  math=once(math,'Math.sin(halfAngle)',"g1Control.trig('sharedSin', Math.sin(halfAngle))");
  math=once(math,'Math.cos(halfAngle)',"g1Control.trig('sharedCos', Math.cos(halfAngle))");
  math=importControl+math;
  const anchors={G1_FREE_PREPARE_ENTRY:'prepare',G1_AXISYMMETRIC_ENTRY:'eligible',G1_ZERO_SPIN_RETURN:'zero',G1_NONZERO_SYMMETRIC_FLOW:'nonzero',G1_FREE_VALIDATE_ENTRY:'validate'};
  for(const [anchor,name]of Object.entries(anchors)){
    const lines=candidate.split('\n').filter(line=>line.includes('// '+anchor+':'));assert.equal(lines.length,1,'unique candidate marker '+anchor);
    candidate=once(candidate,lines[0],lines[0]+`\n  g1Control.count('${name}');`);
  }
  candidate=once(candidate,'Math.sin(halfAngle)',"g1Control.trig('bodySin', Math.sin(halfAngle))");
  candidate=once(candidate,'Math.cos(halfAngle)',"g1Control.trig('bodyCos', Math.cos(halfAngle))");
  candidate=importControl+candidate;
  const control=controlSource();
  return{world,math,candidate,control,sourceEntry:"export * from './package/src/index.js';\nexport { g1Control } from './package/src/g1-test-control.js';\n",proof:{originalSha256:Object.fromEntries(Object.entries(originals).map(([k,v])=>[k,sha(v)])),effectiveSha256:{world:sha(world),math:sha(math),candidate:sha(candidate),control:sha(control)},isotropicFallbackStatement:originalStatement,policy:'Only world dispatch and private observation/counter imports/wrappers differ. Trig wrappers return the already evaluated original Math result, no extra math. All other package src bytes copied exact.',labels:['STAGED_COMMON_WORLD_SOURCE','STAGED_EMITTED_PUBLIC_ENTRY'],nativeCanonicalRootBundling:'NOT_RUN',productionActivation:'NOT_RUN'}};
}
