import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const home=dirname(fileURLToPath(import.meta.url));
export function transformCoupledStage(stage){
 const src=resolve(stage,'physics/src');mkdirSync(resolve(stage,'C'));
 copyFileSync(resolve(home,'candidate.ts'),resolve(stage,'C/candidate.ts'));
 copyFileSync(resolve(home,'coupled-plan.ts'),resolve(src,'coupled-plan.ts'));
 const edit=(name,f)=>{const p=resolve(src,name);writeFileSync(p,f(readFileSync(p,'utf8')));};
 const once=(s,a,b)=>{assert.equal(s.split(a).length-1,1,'Unique exact qualified source anchor');return s.replace(a,b);};
 edit('private-phase.ts',s=>s+"\nexport function phaseCoupledPlan(data){emit('coupled-plan',data);}\n");
 edit('persistent-box-contact.ts',s=>{
  s="import type {CoupledPlan} from './coupled-plan.js';\n"+s;
  const start=s.indexOf('export function solvePersistentPoint('),end=s.indexOf('\nexport function correctPersistentPair',start);assert(start>=0&&end>start);
  return s.slice(0,start)+`export function solvePersistentPoint(a: Body, b: Body, pointM: Vec3, normal: Vec3,
  impulse: PointImpulse, normalTargetMps: number, plan: CoupledPlan): PairContribution {
  if(normalTargetMps!==0)throw new Error('Coupled static target forbids restitution');
  const first=!plan.applied;plan.slots++;
  if(first){impulse.normalNs=plan.target.normalNs;impulse.tangentNs=[...plan.target.tangentNs];}
  phaseKind('coupled-static',{targetApplied:first,zeroSlot:!first,slot:plan.slots,hostStep:plan.hostStep,key:plan.key,nativeNormal:plan.target.certificate.nativeUnitNormal,normalNs:plan.target.normalNs,tangentNs:plan.target.tangentNs,worldImpulseNs:plan.target.worldImpulseNs});
  const contribution=apply(a,b,pointM,first?[...plan.target.worldImpulseNs]:[0,0,0]);
  plan.applied=true;return contribution;
}
`+s.slice(end);
 });
 edit('producer.ts',s=>{
  s="import type {PhaseHit} from './phase-hit.js';\n"+s;
  s=once(s,'colliderIds:ReadonlyMap<string,string>):Contact[] {','colliderIds:ReadonlyMap<string,string>,verify:(a:Body,b:Body,hit:PhaseHit|null)=>void):Contact[] {');
  return once(s,'hit=phaseQuery(a,b,true);if(!hit)continue;','hit=phaseQuery(a,b,true);verify(a,b,hit);if(!hit)continue;');
 });
 edit('world.ts',s=>{
  s="import {prepareCoupledPlan,guardCoupledPlan,guardCoupledIdentity,CoupledContactError,type CoupledPlan} from './coupled-plan.js';\n"+s;
  s=once(s,'acceptedGeometry(bodies,pairs,colliderIds)',"acceptedGeometry(bodies,pairs,colliderIds,(_a,_b,hit)=>{if(hit)throw new CoupledContactError('COUPLED_PROFILE_UNSUPPORTED','Initial contact must be cold separated MISS');})");
  s=once(s,'      const actions = parseCommands(admittedCommands, bodies);',`      const actions = parseCommands(admittedCommands, bodies);
      if(stepIndex!==0||persistentPoints.size!==0||admittedCommands.length!==0||pairs.length!==1||gravity.some(v=>v!==0))throw new CoupledContactError('COUPLED_PROFILE_UNSUPPORTED','Only one first cold interval without commands/gravity is supported');`);
  s=once(s,'      const persistentNormalTargets = new Map<string, number>();',`      const persistentNormalTargets = new Map<string, number>();
      const coupledPlans = new Map<string,CoupledPlan>();`);
  s=once(s,'          if (manifold) {',`          if (manifold) {
            if(!isPhaseHit(hit)||manifold.length!==1)throw new CoupledContactError('COUPLED_PROFILE_UNSUPPORTED','Exactly one actual native point is required before any application');
            const coupledPoint=hit._phase.result.points[0];
            const coupledKey=key+'\\u0000'+coupledPoint.id;
            let coupledPlan=coupledPlans.get(coupledKey);
            if(!coupledPlan){
              if(coupledPlans.size!==0||pass!==0||persistentPoints.size!==0)throw new CoupledContactError('COUPLED_PROFILE_UNSUPPORTED','Cold single point must be eligible in first force pass');
              coupledPlan=prepareCoupledPlan(coupledKey,stepIndex+1,a,b,hit,coupledPoint);
              coupledPlans.set(coupledKey,coupledPlan);
            }
            guardCoupledPlan(coupledPlan,coupledKey,stepIndex+1,a,b,hit,coupledPoint);`);
  s=once(s,'                phasePoint(pointKey,point,hit.normal,hit,impulse,iteration,order.indexOf(point));',`                guardCoupledPlan(coupledPlan,pointKey,stepIndex+1,a,b,hit,coupledPoint);
                phasePoint(pointKey,point,hit.normal,hit,impulse,iteration,order.indexOf(point));`);
  s=once(s,'                  persistentNormalTargets.get(pointKey)!));','                  persistentNormalTargets.get(pointKey)!,coupledPlan));');
  s=once(s,'      const nextContacts=acceptedGeometry(next,pairs,colliderIds);',`      if(coupledPlans.size!==1||[...coupledPlans.values()].some(p=>!p.applied||p.slots!==64))throw new CoupledContactError('COUPLED_PROFILE_UNSUPPORTED','One frozen target and all original64slots are required');
      const nextContacts=acceptedGeometry(next,pairs,colliderIds,(a,b,hit)=>{
        if(!hit||hit._phase.result.points.length!==1)throw new CoupledContactError('COUPLED_PROFILE_UNSUPPORTED','Final native geometry must retain one frozen point');
        const point=hit._phase.result.points[0],key=a.id+'\\u0000'+b.id+'\\u0000'+point.id,plan=coupledPlans.get(key);
        if(!plan)throw new CoupledContactError('COUPLED_PROFILE_UNSUPPORTED','Final point ownership changed');
        guardCoupledIdentity(plan,key,stepIndex+1,a,b,hit,point);
      });`);
  return s;
 });
 const entry=resolve(stage,'entry.ts');writeFileSync(entry,readFileSync(entry,'utf8')+"export {coupledStaticTarget} from './C/candidate.js';\nexport {CoupledContactError} from './physics/src/coupled-plan.js';\n");
}
