import { CASES } from './fixture.mjs';
import { createSnapshot } from './snapshot.mjs';
import { referenceSweep,closestSegmentBox,referencePointBox } from './reference.mjs';
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
function referenceCase(fixture){const hits=[];
 for(const box of fixture.scene.boxes){if(box.id===fixture.query.excludeId)continue;
  const hit=referenceSweep(fixture.query.centerM,fixture.query.displacementM,box);if(hit)hits.push({...hit,bodyId:box.id});
 }
 if(!hits.length)return null;const minimum=Math.min(...hits.map(hit=>hit.fraction));
 return hits.filter(hit=>hit.fraction<=minimum+1e-9).sort((a,b)=>a.bodyId<b.bodyId?-1:a.bodyId>b.bodyId?1:0)[0];
}
export function observe(){return CASES.map(fixture=>{
 const snapshot=createSnapshot(fixture.scene);let hit=null,error=null,reference=null,referenceError=null;
 try{hit=snapshot.query(fixture.query);}catch(e){error={code:e.code??'UNEXPECTED',message:String(e)};}
 try{reference=referenceCase(fixture);}catch(e){referenceError=String(e);}
 const checks={},errors={};
 if(fixture.error){checks.expectedRefusal=error?.code===fixture.error;checks.independentInitialOverlap=fixture.scene.boxes.some(b=>b.id!==fixture.query.excludeId && closestSegmentBox(fixture.query.centerM,b).distanceM-.15 < -1e-12);}
 else {
  checks.noRefusal=error===null;checks.independentReferenceResolved=referenceError===null;checks.hitPresence=!!hit===!!reference;
  if(hit && reference && !error){
   errors.fraction=Math.abs(hit.fraction-reference.fraction);errors.normal=distance(hit.normalM,reference.normalM);
   checks.referenceFraction=errors.fraction<=1e-6;checks.referenceNormal=errors.normal<=1e-6;checks.bodyId=hit.bodyId===reference.bodyId;
   const at=fixture.query.centerM.map((v,i)=>v+fixture.query.displacementM[i]*hit.fraction),box=fixture.scene.boxes.find(b=>b.id===hit.bodyId);
   const independent=closestSegmentBox(at,box);
   errors.witnessGapM=Math.abs(distance(hit.segmentM,hit.pointM)-.15);errors.independentGapM=Math.abs(independent.distanceM-.15);
   errors.centrelineM=Math.max(Math.abs(hit.segmentM[0]-at[0]),Math.abs(hit.segmentM[2]-at[2]),Math.max(0,Math.abs(hit.segmentM[1]-at[1])-.35));
   errors.unitNormal=Math.abs(Math.hypot(...hit.normalM)-1);
   const inferredNormal=hit.segmentM.map((v,i)=>(v-hit.pointM[i])/.15);
   errors.witnessNormal=distance(inferredNormal,hit.normalM);
   const membership=referencePointBox(hit.pointM,box);errors.boxMembershipM=membership.distanceM;errors.boxBoundaryM=membership.boundaryResidualM;
   checks.witness=errors.witnessGapM<=1e-6 && errors.independentGapM<=1e-6 && errors.centrelineM<=1e-6 && errors.witnessNormal<=1e-6 && errors.boxMembershipM<=1e-6 && errors.boxBoundaryM<=1e-6;
   checks.unitNormal=errors.unitNormal<=1e-10;checks.finiteBounded=Object.values(hit).filter(v=>Array.isArray(v)).flat().every(Number.isFinite)&&hit.fraction>=0&&hit.fraction<=1&&hit.iterations<=64;
  }
  if(fixture.analytic)checks.analyticHitExists=!!hit;
  if(fixture.analytic && hit){errors.analyticFraction=Math.abs(hit.fraction-fixture.analytic.fraction);errors.analyticNormal=distance(hit.normalM,fixture.analytic.normalM);
   checks.analyticFraction=errors.analyticFraction<=1e-6;checks.analyticNormal=errors.analyticNormal<=1e-6;
   if(fixture.analytic.pointM){errors.uniquePointM=distance(hit.pointM,fixture.analytic.pointM);checks.uniquePoint=errors.uniquePointM<=1e-6;}
   if(fixture.analytic.bodyId)checks.analyticBodyId=hit.bodyId===fixture.analytic.bodyId;
  }
 }
 const accepted=snapshot.getSnapshot();snapshot.dispose();
 return {name:fixture.name,scene:fixture.scene,query:fixture.query,analytic:fixture.analytic,expectedError:fixture.error,
  hit,error,reference,referenceError,errors,checks,passed:Object.values(checks).every(Boolean),snapshotRetained:JSON.stringify(accepted)===JSON.stringify(fixture.scene)};
});}
const percentile95=values=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1];
export function timingTrials(){
 const fixtures=CASES.filter(c=>c.error===null),worlds=fixtures.map(f=>createSnapshot(f.scene));
 for(let i=0;i<fixtures.length;i++)worlds[i].query(fixtures[i].query);
 const trials=[];
 for(let trial=0;trial<3;trial++){
  const times=fixtures.map(()=>[]);for(let repeat=0;repeat<100;repeat++)for(let i=0;i<fixtures.length;i++){
   const start=performance.now();worlds[i].query(fixtures[i].query);times[i].push(performance.now()-start);
  }
  trials.push(fixtures.map((f,i)=>({name:f.name,N:times[i].length,p95Ms:percentile95(times[i]),passed:percentile95(times[i])<=2})));
 }
 for(const world of worlds)world.dispose();
 return {trials,passed:trials.flat().every(t=>t.passed),medianAndSpread:fixtures.map((f,i)=>{const p=trials.map(t=>t[i].p95Ms).sort((a,b)=>a-b);return {name:f.name,median:p[1],minimum:p[0],maximum:p[2]};})};
}
export function packOutputs(observations){const values=[];
 for(const o of observations){values.push(o.hit?1:0,o.error?1:0);if(o.hit)values.push(o.hit.fraction,...o.hit.normalM,...o.hit.pointM,...o.hit.segmentM,o.hit.iterations);}
 return Float64Array.from(values);
}
export function packInputs(observations){const values=[];for(const o of observations){values.push(o.scene.boxes.length);for(const box of o.scene.boxes)values.push(...box.centerM,...box.halfExtentsM,...box.orientationXYZW);values.push(...o.query.centerM,...o.query.displacementM);}return Float64Array.from(values);}
